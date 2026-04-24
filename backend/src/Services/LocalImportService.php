<?php
namespace App\Services;

use PDO;

class LocalImportService
{
    private $db;
    private $workspaceRoot;

    public function __construct(PDO $db, $workspaceRoot)
    {
        $this->db = $db;
        $this->workspaceRoot = $workspaceRoot;
    }

    /**
     * Import a local object from filesystem into database
     * Returns the database object ID
     */
    public function importObjectFromFiles($objectPath)
    {
        if (!is_dir($objectPath)) {
            throw new \Exception("Object path not found: $objectPath");
        }

        $objectName = basename($objectPath);

        // Check if object already exists in DB
        $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path = ?");
        $stmt->execute([$objectPath]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $objectId = $existing['id'];
            // Update existing object
            $this->updateObject($objectId, $objectPath, $objectName);
        } else {
            // Create new object
            $objectId = $this->createObject($objectPath, $objectName);
        }

        // Import parameters
        $this->importParameters($objectId, $objectPath);

        // Import scripts
        $this->importScripts($objectId, $objectPath);

        // Import images
        $this->importImages($objectName, $objectPath);

        // Update sync time
        $stmt = $this->db->prepare("UPDATE gdl_objects SET last_sync_time = NOW() WHERE id = ?");
        $stmt->execute([$objectId]);

        return $objectId;
    }

    private function importImages($objectName, $sourcePath)
    {
        // Target directory: gdl-ui-studio/public/images/{objectName}/{objectName}
        // Current dir is gdl-ui-studio/backend/src/Services
        $targetBase = dirname(dirname(dirname(__DIR__))) . '/public/images';

        // Ensure object name is safe for filesystem
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $objectName);

        $targetDir = $targetBase . '/' . $safeName . '/' . $safeName;

        // Create target directory if it doesn't exist
        if (!is_dir($targetDir)) {
            if (!mkdir($targetDir, 0755, true)) {
                // Warning only, don't fail the whole import if images can't be created
                return;
            }
        }

        // Files to copy
        $patterns = ['*.png', '*.jpg', '*.gif', '*.jpeg', 'manifest.json'];

        foreach ($patterns as $pattern) {
            $files = glob($sourcePath . '/' . $pattern);
            if ($files) {
                foreach ($files as $file) {
                    $fileName = basename($file);
                    $destPath = $targetDir . '/' . $fileName;
                    copy($file, $destPath);
                }
            }
        }
    }

    private function createObject($objectPath, $objectName)
    {
        // Get or create default project
        $projectId = $this->getOrCreateLocalProject($objectPath);

        $stmt = $this->db->prepare("
            INSERT INTO gdl_objects (project_id, name, local_file_path, is_local_sync, created_at, updated_at)
            VALUES (?, ?, ?, TRUE, NOW(), NOW())
        ");
        $stmt->execute([$projectId, $objectName, $objectPath]);

        return $this->db->lastInsertId();
    }

    private function updateObject($objectId, $objectPath, $objectName)
    {
        $stmt = $this->db->prepare("
            UPDATE gdl_objects 
            SET name = ?, local_file_path = ?, is_local_sync = TRUE, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$objectName, $objectPath, $objectId]);
    }

    private function getOrCreateLocalProject($objectPath)
    {
        // Extract project path (parent of 02_source)
        $projectPath = dirname(dirname($objectPath));
        $projectName = basename($projectPath);

        // Check if project exists
        $stmt = $this->db->prepare("SELECT id FROM projects WHERE folder_path = ?");
        $stmt->execute([$projectPath]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            return $existing['id'];
        }

        // Create project
        $stmt = $this->db->prepare("
            INSERT INTO projects (name, folder_path, created_at, updated_at)
            VALUES (?, ?, NOW(), NOW())
        ");
        $stmt->execute([$projectName, $projectPath]);

        return $this->db->lastInsertId();
    }

    private function importParameters($objectId, $objectPath)
    {
        $xmlPath = $objectPath . '/Parameters.xml';
        $uiJsonPath = $objectPath . '/ui.json';

        if (!file_exists($xmlPath)) {
            return; // No parameters to import
        }

        $xmlContent = file_get_contents($xmlPath);
        $xml = simplexml_load_string($xmlContent);

        if (!$xml) {
            throw new \Exception("Failed to parse Parameters.xml");
        }

        // Load ui_code from ui.json if it exists
        $uiCodeMap = [];
        if (file_exists($uiJsonPath)) {
            $uiData = json_decode(file_get_contents($uiJsonPath), true);
            if ($uiData && isset($uiData['parameters']) && is_array($uiData['parameters'])) {
                foreach ($uiData['parameters'] as $p) {
                    if (isset($p['name']) && isset($p['ui_code'])) {
                        $uiCodeMap[$p['name']] = $p['ui_code'];
                    }
                }
            }
        }

        // Delete existing parameters for this object
        $stmt = $this->db->prepare("DELETE FROM parameters WHERE gdl_object_id = ?");
        $stmt->execute([$objectId]);

        $order = 0;
        foreach ($xml->Parameters->children() as $paramNode) {
            $name = (string) $paramNode['Name'];
            $uiCode = $uiCodeMap[$name] ?? null;
            $this->importParameter($objectId, $paramNode, $order++, $uiCode);
        }
    }

    private function importParameter($objectId, $paramNode, $order, $uiCode = null)
    {
        $type = $paramNode->getName();
        $name = (string) $paramNode['Name'];
        $desc = trim((string) $paramNode->Description, '"');

        // Check for ArrayValues first
        $arrayType = 'None';
        $arrayFirstDim = 0;
        $arraySecondDim = 0;
        $value = null;

        if (isset($paramNode->ArrayValues)) {
            // This is an array parameter
            $arrayValues = $paramNode->ArrayValues;
            $arrayFirstDim = (int) $arrayValues['FirstDimension'];
            $arraySecondDim = (int) $arrayValues['SecondDimension'];

            if ($arraySecondDim > 0) {
                // 2D Array
                $arrayType = '2D';
                $arrayData = [];

                foreach ($arrayValues->AVal as $aval) {
                    $row = (int) $aval['Row'] - 1; // Convert to 0-indexed
                    $col = (int) $aval['Column'] - 1; // Convert to 0-indexed
                    $val = (string) $aval;

                    if (!isset($arrayData[$row])) {
                        $arrayData[$row] = [];
                    }
                    $arrayData[$row][$col] = $val;
                }

                // Fill missing values with defaults
                $isString = in_array(strtoupper($type), ['STRING', 'TEXT']);
                $defaultValue = $isString ? '""' : '0';

                for ($r = 0; $r < $arrayFirstDim; $r++) {
                    if (!isset($arrayData[$r])) {
                        $arrayData[$r] = [];
                    }
                    for ($c = 0; $c < $arraySecondDim; $c++) {
                        if (!isset($arrayData[$r][$c])) {
                            $arrayData[$r][$c] = $defaultValue;
                        }
                    }
                }

                $value = $arrayData;
            } else {
                // 1D Array
                $arrayType = '1D';
                $arrayData = [];

                foreach ($arrayValues->AVal as $aval) {
                    $row = (int) $aval['Row'] - 1; // Convert to 0-indexed
                    $val = (string) $aval;
                    $arrayData[$row] = $val;
                }

                // Fill missing values with defaults
                $isString = in_array(strtoupper($type), ['STRING', 'TEXT']);
                $defaultValue = $isString ? '""' : '0';

                for ($r = 0; $r < $arrayFirstDim; $r++) {
                    if (!isset($arrayData[$r])) {
                        $arrayData[$r] = $defaultValue;
                    }
                }

                $value = $arrayData;
            }
        } else {
            // Regular scalar value
            $value = (string) $paramNode->Value;
        }

        // Extract flags - check both attributes and child elements
        $flagHidden = 0;
        $flagChild = 0;
        $flagBold = 0;
        $flagUnique = 0;

        // Check for Flags child element
        if (isset($paramNode->Flags)) {
            foreach ($paramNode->Flags->children() as $flag) {
                $flagName = $flag->getName();
                if ($flagName === 'ParFlg_Hidden')
                    $flagHidden = 1;
                if ($flagName === 'ParFlg_Child')
                    $flagChild = 1;
                if ($flagName === 'ParFlg_BoldName')
                    $flagBold = 1;
                if ($flagName === 'ParFlg_Unique')
                    $flagUnique = 1;
            }
        }

        // Also check old-style Flags attribute (for backwards compatibility)
        if (isset($paramNode['Flags'])) {
            $flags = (string) $paramNode['Flags'];
            if (strpos($flags, 'Child') !== false)
                $flagChild = 1;
            if (strpos($flags, 'Bold') !== false)
                $flagBold = 1;
            if (strpos($flags, 'Unique') !== false)
                $flagUnique = 1;
        }

        // UI page
        $uiPage = isset($paramNode['ParNum']) ? (int) (string) $paramNode['ParNum'] : 0;

        // If ParNum is 0 or hidden flag is set, mark as hidden
        if ($uiPage === 0 && !$flagHidden) {
            // Check if there's an explicit hidden flag in the Flags element
            $flagHidden = isset($paramNode->Flags->ParFlg_Hidden) ? 1 : 0;
        }

        // Insert parameter
        $stmt = $this->db->prepare("
            INSERT INTO parameters (
                gdl_object_id, gdl_name, gdl_type, default_value_json, ui_code,
                flag_hidden, flag_child, flag_bold, flag_unique,
                ui_page, is_ui_element, array_type, array_first_dim, array_second_dim,
                display_order, sort_order,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NOW(), NOW())
        ");

        $stmt->execute([
            $objectId,
            $name,
            $type,
            json_encode($value),
            $uiCode,
            $flagHidden,
            $flagChild,
            $flagBold,
            $flagUnique,
            $uiPage,
            $arrayType,
            $arrayFirstDim,
            $arraySecondDim,
            $order,
            $order // sort_order
        ]);

        $parameterId = $this->db->lastInsertId();

        // Insert translation
        $stmt = $this->db->prepare("
            INSERT INTO parameter_translations (param_id, language_code, description, created_at, updated_at)
            VALUES (?, 'de', ?, NOW(), NOW())
        ");
        $stmt->execute([$parameterId, $desc]);
    }

    private function importScripts($objectId, $objectPath)
    {
        $scriptFiles = [
            '1-Master-Script.gdl' => 'script_master',
            '2-Parameter-Script.gdl' => 'script_parameter',
            '3-2D-Script.gdl' => 'script_2d',
            '4-3D-Script.gdl' => 'script_3d',
            '5-Interface-Script.gdl' => 'script_ui',
            '6-Properties-Script.gdl' => 'script_properties',
            '7-Forward-Migration-Script.gdl' => 'script_forward_migration',
            '8-Backward-Migration-Script.gdl' => 'script_backward_migration'
        ];

        foreach ($scriptFiles as $filename => $columnName) {
            $filePath = $objectPath . '/' . $filename;

            if (file_exists($filePath)) {
                $content = file_get_contents($filePath);

                $stmt = $this->db->prepare("UPDATE gdl_objects SET $columnName = ? WHERE id = ?");
                $stmt->execute([$content, $objectId]);
            }
        }
    }
}
