<?php
namespace App\Services;

class LocalFileService
{
    private $workspaceRoot;

    public function __construct($workspaceRoot)
    {
        $this->workspaceRoot = rtrim($workspaceRoot, '/');
    }

    /**
     * Get the workspace base path
     */
    public function getBasePath()
    {
        return $this->workspaceRoot;
    }

    /**
     * Scans workspace for *.project folders
     */
    public function scanProjects()
    {
        if (!is_dir($this->workspaceRoot)) {
            return [];
        }

        $projects = [];
        $dirs = glob($this->workspaceRoot . '/*.project', GLOB_ONLYDIR);

        foreach ($dirs as $dir) {
            $name = basename($dir, '.project');
            $status = 'active'; // Default status for local
            $mtime = filemtime($dir);

            $projects[] = [
                'id' => $dir, // Use path as ID for local
                'name' => $name,
                'description' => 'Lokales Projekt',
                'status' => $status,
                'folder_path' => $dir,
                'created_at' => date('c', $mtime), // ISO 8601
                'updated_at' => date('c', $mtime)
            ];
        }
        return $projects;
    }

    /**
     * Scans a project folder for objects (in 02_source)
     */
    public function scanObjects($projectPath)
    {
        $sourcePath = $projectPath . '/02_source';
        if (!is_dir($sourcePath))
            return [];

        $objects = [];
        // Scan subdirectories in 02_source
        $dirs = glob($sourcePath . '/*', GLOB_ONLYDIR);

        foreach ($dirs as $dir) {
            $name = basename($dir);
            // Check if it looks like a GDL object folder (e.g. has gdl/xml files)
            // User convention: 1-Master-Script.gdl, Parameters.xml, etc.
            if (file_exists($dir . '/Parameters.xml') || glob($dir . '/*.gdl')) {
                $mtime = filemtime($dir);
                $objects[] = [
                    'id' => base64_encode($dir), // Absolute path as ID (Encoded)
                    'project_id' => $projectPath,
                    'name' => $name,
                    'type' => 'object',
                    'updated_at' => date('c', $mtime)
                ];
            }
        }
        return $objects;
    }

    public function getObjectDetails($objectPath)
    {
        error_log("LocalFileService::getObjectDetails() called with path: $objectPath");
        
        if (!is_dir($objectPath))
            throw new \Exception("Objektpfad existiert nicht: $objectPath");

        // 1. Read Parameters.xml
        $paramXmlPath = $objectPath . '/Parameters.xml';
        $parameters = [];
        if (file_exists($paramXmlPath)) {
            $xmlContent = file_get_contents($paramXmlPath);
            // Convert to matching JSON structure of DB
            $parameters = $this->parseParametersXml($xmlContent);
        }

        // 2. Read UI Config (Priority: ui.json > UI Script)
        $uiConfig = null;
        $uiJsonPath = $objectPath . '/ui.json';
        if (file_exists($uiJsonPath)) {
            $uiConfig = file_get_contents($uiJsonPath);

            // 3. Merge ui_code from ui.json into parameters
            try {
                $uiData = json_decode($uiConfig, true);
                if ($uiData && isset($uiData['parameters']) && is_array($uiData['parameters'])) {
                    // Create a map of parameter name -> ui_code
                    $uiCodeMap = [];
                    foreach ($uiData['parameters'] as $paramUi) {
                        if (isset($paramUi['name']) && isset($paramUi['ui_code'])) {
                            $uiCodeMap[$paramUi['name']] = $paramUi['ui_code'];
                        }
                    }

                    // Merge ui_code into parameters array
                    foreach ($parameters as &$param) {
                        if (isset($uiCodeMap[$param['gdl_name']])) {
                            $param['ui_code'] = $uiCodeMap[$param['gdl_name']];
                        }
                    }
                    unset($param); // Break reference
                }
            } catch (\Exception $e) {
                // If ui.json is malformed, just skip merging
                error_log("Failed to merge ui.json: " . $e->getMessage());
            }
        }

        // 3. Read GDL Scripts
        $scripts = [
            'script_master' => '1-Master-Script.gdl',
            'script_parameter' => '2-Parameter-Script.gdl',
            'script_2d' => '3-2D-Script.gdl',
            'script_3d' => '4-3D-Script.gdl',
            'script_ui' => '5-Interface-Script.gdl',
            'script_properties' => '6-Properties-Script.gdl',
            'script_forward_migration' => '7-Forward-Script.gdl',
            'script_backward_migration' => '8-Backward-Script.gdl'
        ];

        $scriptData = [];
        foreach ($scripts as $key => $filename) {
            $filePath = $objectPath . '/' . $filename;
            if (file_exists($filePath)) {
                $scriptData[$key] = file_get_contents($filePath);
            } else {
                // Compatibility check for older naming
                if ($key === 'script_forward_migration') {
                    $altPath = $objectPath . '/7-Forward-Migration-Script.gdl';
                    if (file_exists($altPath))
                        $scriptData[$key] = file_get_contents($altPath);
                    else
                        $scriptData[$key] = '';
                } elseif ($key === 'script_backward_migration') {
                    $altPath = $objectPath . '/8-Backward-Migration-Script.gdl';
                    if (file_exists($altPath))
                        $scriptData[$key] = file_get_contents($altPath);
                    else
                        $scriptData[$key] = '';
                } else {
                    $scriptData[$key] = '';
                }
            }
        }

        // Extract project_id from object path
        // Supports multiple folder structures:
        // 1. New: /base/path/project-folder/01_gsms/gdl-ui-studio/Objects/objectname
        // 2. Old: /base/path/project-folder/02_source/objectname
        // Key: Find the folder ending with '.project'
        $projectId = null;
        
        error_log("LocalFileService: Attempting to extract project_id from: $objectPath");
        
        // Method 1: Find folder ending with .project
        if (preg_match('#([^/]+\.project)/#', $objectPath, $matches)) {
            $projectId = $matches[1];
            error_log("LocalFileService: ✓ Extracted project_id via .project pattern: '$projectId'");
        }
        // Method 2: Try to find 01_gsms or 02_source and use the folder before it
        else if (preg_match('#([^/]+)/(01_gsms|02_source)/#', $objectPath, $matches)) {
            $projectId = $matches[1];
            error_log("LocalFileService: ✓ Extracted project_id via folder pattern: '$projectId'");
        }
        // Method 3: Split path and find project folder
        else {
            $parts = explode('/', $objectPath);
            foreach ($parts as $part) {
                if (strpos($part, '.project') !== false) {
                    $projectId = $part;
                    error_log("LocalFileService: ✓ Extracted via string search: '$projectId'");
                    break;
                }
            }
        }
        
        if (!$projectId) {
            error_log("LocalFileService: ✗ FAILED to extract project_id!");
        }
        
        error_log("LocalFileService: Final project_id = " . ($projectId ?: 'NULL'));

        return array_merge([
            'id' => $objectPath,
            'name' => basename($objectPath),
            'project_id' => $projectId,
            'parameters_json' => json_encode($parameters), // Controller expects JSON string
            'ui_config' => $uiConfig,
            'last_modified' => is_dir($objectPath) ? @filemtime($objectPath) : time()
        ], $scriptData);
    }

    private function parseParametersXml($xmlString)
    {
        // Minimal Parser to match DB structure
        // Returns Array of { id, gdl_name, type, default_value, description, flags, ui_page, etc. }
        @$xml = simplexml_load_string($xmlString);
        if (!$xml || !isset($xml->Parameters)) {
            return [];
        }
        $params = [];

        // Helper to extract values recursively

        foreach ($xml->Parameters->children() as $paramNode) {
            $type = $paramNode->getName(); // e.g. "Length", "Boolean"
            $name = (string) $paramNode['Name'];
            $desc = (string) $paramNode->Description;
            // Remove CDATA wrap if present or simplexml handles it? usually yes.
            // But Description is often <![CDATA["Text"]]> -> "Text"
            // We strip quotes
            $desc = trim($desc, '"');

            $value = (string) $paramNode->Value;

            // Extract flags from XML attributes
            $flagHidden = isset($paramNode['ParNum']) && (string) $paramNode['ParNum'] === '0' ? 1 : 0;
            $flagChild = isset($paramNode['Flags']) && strpos((string) $paramNode['Flags'], 'Child') !== false ? 1 : 0;
            $flagBold = isset($paramNode['Flags']) && strpos((string) $paramNode['Flags'], 'Bold') !== false ? 1 : 0;
            $flagUnique = isset($paramNode['Flags']) && strpos((string) $paramNode['Flags'], 'Unique') !== false ? 1 : 0;

            // Extract UI page (default to 0 if not present)
            $uiPage = isset($paramNode['ParNum']) ? (int) (string) $paramNode['ParNum'] : 0;

            // Determine if it's a UI element (heuristic: has UI-related attributes)
            $isUiElement = 0; // Default to 0, can be enhanced later

            // Determine array type
            $arrayType = 'None';
            if (isset($paramNode->ArrayValues)) {
                // Check if 2D array (has nested arrays)
                $firstChild = $paramNode->ArrayValues->children()[0] ?? null;
                if ($firstChild && $firstChild->count() > 0) {
                    $arrayType = '2D';
                } else {
                    $arrayType = '1D';
                }
            }

            $params[] = [
                'id' => md5($name),
                'gdl_name' => $name,
                'gdl_type' => $type, // Aligned with DB API
                'default_value' => $value,
                'default_value_json' => json_encode($value),
                'description' => $desc,
                'is_array' => isset($paramNode->ArrayValues) ? 1 : 0,
                'array_type' => $arrayType,
                'flag_hidden' => $flagHidden,
                'flag_child' => $flagChild,
                'flag_bold' => $flagBold,
                'flag_unique' => $flagUnique,
                'ui_page' => $uiPage,
                'is_ui_element' => $isUiElement,
                'ui_code' => null, // Will be populated from ui.json if available
                'translations' => [
                    [
                        'language_code' => 'de',
                        'description' => $desc
                    ]
                ]
            ];
        }
        return $params;
    }

    public function createProject($name, $description = '')
    {
        $templatePath = $this->workspaceRoot . '/gdl-nucleus-new.project';
        $newProjectPath = $this->workspaceRoot . '/' . $name . '.project';

        if (!is_dir($templatePath)) {
            throw new \Exception("Template not found at: $templatePath");
        }
        if (is_dir($newProjectPath)) {
            throw new \Exception("Project already exists: $name");
        }

        // 1. Recursive Copy
        $this->recurseCopy($templatePath, $newProjectPath);

        // 2. Rename internal structures
        // Rename folder: 01_gsms/gdl-nucleus-new -> 01_gsms/[NewName]
        $oldInnerDir = $newProjectPath . '/01_gsms/gdl-nucleus-new';
        $newInnerDir = $newProjectPath . '/01_gsms/' . $name;

        if (is_dir($oldInnerDir)) {
            rename($oldInnerDir, $newInnerDir);
        }

        // Rename file: [NewName].code-workspace (Template likely has gdl-nucleus-new.code-workspace or similar)
        // Since we don't know the exact name of the workspace file in template, we look for *.code-workspace
        $workspaceFiles = glob($newProjectPath . '/*.code-workspace');
        foreach ($workspaceFiles as $file) {
            $base = basename($file);
            if ($base !== $name . '.code-workspace') {
                rename($file, $newProjectPath . '/' . $name . '.code-workspace');
            }
        }

        return [
            'id' => $newProjectPath,
            'name' => $name,
            'folder_path' => $newProjectPath
        ];
    }

    private function recurseCopy($src, $dst)
    {
        $dir = opendir($src);
        @mkdir($dst);
        while (false !== ($file = readdir($dir))) {
            if (($file != '.') && ($file != '..')) {
                if (is_dir($src . '/' . $file)) {
                    $this->recurseCopy($src . '/' . $file, $dst . '/' . $file);
                } else {
                    copy($src . '/' . $file, $dst . '/' . $file);
                }
            }
        }
        closedir($dir);
    }

    /**
     * Merges generated GDL code into a file using markers.
     * IMPROVED: Now uses GdlScriptService for proper duplicate handling.
     * 
     * @param string $objectPath The full path to the object folder
     * @param string $scriptFilename e.g. "1-Master-Script.gdl"
     * @param string $newContent The GDL code to insert
     * @param string $markerHeader The header text (without ! lines)
     */
    public function mergeScript($objectPath, $scriptFilename, $newContent, $markerHeader)
    {
        $filePath = $objectPath . '/' . $scriptFilename;

        // Define exact marker block - 3-line format for compatibility
        $headerBlock = "! ---------------------------------------------------------------------- !" . PHP_EOL .
            "!	" . $markerHeader . PHP_EOL .
            "! ---------------------------------------------------------------------- !";

        $endMarker = "! --- END AUTO-GENERATED BLOCK ---";

        // IMPROVED: Use GdlScriptService for robust merging with duplicate detection
        $scriptService = new GdlScriptService();
        
        if (!file_exists($filePath)) {
            // If file doesn't exist, create it with the content
            $fullContent = $headerBlock . PHP_EOL . $newContent . PHP_EOL . $endMarker . PHP_EOL;
            return file_put_contents($filePath, $fullContent) !== false;
        }

        $currentContent = file_get_contents($filePath);

        // Use the improved mergeContent function from GdlScriptService
        // For the 3-line header format, we convert it to a simpler marker
        // that the regex can match reliably
        $simpleHeader = "! --- " . trim($markerHeader) . " ---";
        
        // First, try to find existing 3-line format blocks and replace them
        // with simple format for consistency
        $pattern = '/! -{2,} !\s*\r?\n!\s*' . preg_quote($markerHeader, '/') . '\s*\r?\n! -{2,} !\s*\r?\n(.*?)\r?\n' . preg_quote($endMarker, '/') . '/s';
        if (preg_match($pattern, $currentContent)) {
            // Replace 3-line headers with simple format
            $currentContent = preg_replace($pattern, $simpleHeader . "\n$1\n" . $endMarker, $currentContent);
        }
        
        // Now use the standard merge with simple header format
        $fullContent = $scriptService->mergeContent(
            $currentContent,
            $newContent,
            $simpleHeader,
            $endMarker
        );

        return file_put_contents($filePath, $fullContent) !== false;
    }

    public function saveObjectDetails($objectPath, $data)
    {
        if (!is_dir($objectPath)) {
            throw new \Exception("Object path not found: $objectPath");
        }

        // Save UI Config (ui.json)
        if (isset($data['ui_config'])) {
            $content = is_string($data['ui_config']) ? $data['ui_config'] : json_encode($data['ui_config'], JSON_PRETTY_PRINT);
            file_put_contents($objectPath . '/ui.json', $content);
        }

        // Save GDL Scripts
        $scripts = [
            'script_master' => '1-Master-Script.gdl',
            'script_parameter' => '2-Parameter-Script.gdl',
            'script_2d' => '3-2D-Script.gdl',
            'script_3d' => '4-3D-Script.gdl',
            'script_ui' => '5-Interface-Script.gdl',
            'script_properties' => '6-Properties-Script.gdl',
            'script_forward_migration' => '7-Forward-Script.gdl',
            'script_backward_migration' => '8-Backward-Script.gdl'
        ];

        foreach ($scripts as $key => $filename) {
            if (isset($data[$key])) {
                $filePath = $objectPath . '/' . $filename;

                // Compatibility for older naming if new file doesn't exist but old does
                if ($key === 'script_forward_migration' && !file_exists($filePath)) {
                    $altPath = $objectPath . '/7-Forward-Migration-Script.gdl';
                    if (file_exists($altPath))
                        $filePath = $altPath;
                }
                if ($key === 'script_backward_migration' && !file_exists($filePath)) {
                    $altPath = $objectPath . '/8-Backward-Migration-Script.gdl';
                    if (file_exists($altPath))
                        $filePath = $altPath;
                }

                file_put_contents($filePath, $data[$key]);
            }
        }

        return true;
    }
}
