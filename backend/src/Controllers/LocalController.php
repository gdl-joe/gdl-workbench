<?php
namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Services\LocalFileService;
use App\Helpers\ResponseHelper;
use Psr\Container\ContainerInterface;
use App\Services\GdlCodeGeneratorService;
use PDO;

class LocalController
{
    private $fileService;
    private $generatorService;
    private $importService;
    private $exportService;
    private $db;

    public function __construct(ContainerInterface $container)
    {
        $rootPath = $container->get('local.workspace.root');
        $db = $container->get(PDO::class);
        $this->db = $db;

        $this->fileService = new LocalFileService($rootPath);
        $this->generatorService = new GdlCodeGeneratorService();
        $this->importService = new \App\Services\LocalImportService($db, $rootPath);
        $this->exportService = new \App\Services\LocalExportService($db);
    }

    private function resolveObjectPath($id)
    {
        error_log("LocalController::resolveObjectPath() called with id: $id");
        
        if (is_numeric($id)) {
            $stmt = $this->db->prepare("SELECT local_file_path FROM gdl_objects WHERE id = ?");
            $stmt->execute([$id]);
            $path = $stmt->fetchColumn();
            if ($path) {
                error_log("LocalController: Resolved numeric ID to path: $path");
                return $path;
            }
        }

        $decoded = base64_decode($id, true);
        if ($decoded !== false && !empty($decoded)) {
            error_log("LocalController: Decoded base64 ID to path: $decoded");
            return $decoded;
        }

        // Fallback for non-base64 numeric or other strings that might be direct paths (though discouraged)
        if (is_dir($id)) {
            error_log("LocalController: Using ID directly as path: $id");
            return $id;
        }

        error_log("LocalController: Could not resolve object path for ID: $id");
        return null;
    }

    public function getProjects(Request $request, Response $response, $args)
    {
        try {
            $projects = $this->fileService->scanProjects();

            // Merge metadata from DB
            $stmt = $this->db->query("SELECT folder_path, status, name, description FROM projects WHERE folder_path IS NOT NULL");
            $dbProjects = $stmt->fetchAll(PDO::FETCH_UNIQUE | PDO::FETCH_ASSOC);

            foreach ($projects as &$p) {
                if (isset($dbProjects[$p['folder_path']])) {
                    $dbInfo = $dbProjects[$p['folder_path']];
                    $p['status'] = $dbInfo['status'] ?: 'active';
                    if (!empty($dbInfo['name']))
                        $p['name'] = $dbInfo['name'];
                    if (!empty($dbInfo['description']))
                        $p['description'] = $dbInfo['description'];
                }
            }
            unset($p);

            $payload = json_encode(['success' => true, 'data' => $projects]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    // Since our Object ID is an absolute path with slashes, we pass it via Query Param 'folder'
    // or we Base64 decode the ID if passed in URL.
    // Simpler: frontend passes local path.
    // GET /local/objects?project_id=...
    public function getObjects(Request $request, Response $response, $args)
    {
        $queryParams = $request->getQueryParams();
        $projectPath = $queryParams['project_id'] ?? null;

        if (!$projectPath) {
            $payload = json_encode(['success' => false, 'error' => 'Missing project_id parameter']);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            $objects = $this->fileService->scanObjects($projectPath);

            // Merge metadata from DB - use local_file_path pattern matching since project_id is INT but we have path
            $stmt = $this->db->prepare("SELECT local_file_path, status, description, name FROM gdl_objects WHERE local_file_path LIKE ? AND local_file_path IS NOT NULL");
            $stmt->execute([$projectPath . '%']);
            $dbObjects = $stmt->fetchAll(PDO::FETCH_UNIQUE | PDO::FETCH_ASSOC);

            foreach ($objects as &$obj) {
                $rawPath = base64_decode($obj['id']);
                if (isset($dbObjects[$rawPath])) {
                    $dbInfo = $dbObjects[$rawPath];
                    $obj['status'] = $dbInfo['status'] ?? 'active';
                    $obj['description'] = $dbInfo['description'] ?? '';
                    if (!empty($dbInfo['name']))
                        $obj['name'] = $dbInfo['name'];
                } else {
                    $obj['status'] = 'active';
                    $obj['description'] = '';
                }
            }
            unset($obj);

            $payload = json_encode(['success' => true, 'data' => $objects]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    // GET /local/gdl-objects/{id_base64}  (ID needs to be encoded because of slashes)
    public function getObject(Request $request, Response $response, $args)
    {
        $id = $args['id'];
        $objectPath = $this->resolveObjectPath($id);

        if (!$objectPath) {
            throw new \Exception("Ungültiges Objekt-ID Format oder Objekt nicht gefunden: $id");
        }

        try {
            // FIXED: Read from DATABASE, not from files!
            // The workflow is: Import files → Work with DB → Export to files
            // Script Editor should read from and write to DATABASE
            
            // Find object in database by path or ID
            $stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE local_file_path = ? OR id = ?");
            $stmt->execute([$objectPath, $id]);
            $dbObject = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$dbObject) {
                // Object not in DB yet - try to import it first
                error_log("LocalController::getObject: Object not in DB, attempting import from: $objectPath");
                
                try {
                    $objectId = $this->importService->importObjectFromFiles($objectPath);
                    
                    // Fetch again after import
                    $stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE id = ?");
                    $stmt->execute([$objectId]);
                    $dbObject = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if (!$dbObject) {
                        throw new \Exception("Object import failed");
                    }
                    
                    error_log("LocalController::getObject: Object imported successfully with ID: $objectId");
                } catch (\Exception $e) {
                    error_log("LocalController::getObject: Import failed: " . $e->getMessage());
                    // Fall back to reading from files if import fails
                    $data = $this->fileService->getObjectDetails($objectPath);
                    $data['status'] = 'active';
                    $data['description'] = '';
                    
                    $payload = json_encode(['success' => true, 'data' => $data, 'source' => 'files']);
                    $response->getBody()->write($payload);
                    return $response->withHeader('Content-Type', 'application/json');
                }
            }

            // Return data from DATABASE
            $data = [
                'id' => $dbObject['id'],
                'name' => $dbObject['name'],
                'project_id' => $dbObject['project_id'],
                'description' => $dbObject['description'] ?? '',
                'status' => $dbObject['status'] ?? 'active',
                'local_file_path' => $dbObject['local_file_path'],
                
                // Scripts from DB
                'script_master' => $dbObject['script_master'] ?? '',
                'script_parameter' => $dbObject['script_parameter'] ?? '',
                'script_2d' => $dbObject['script_2d'] ?? '',
                'script_3d' => $dbObject['script_3d'] ?? '',
                'script_ui' => $dbObject['script_ui'] ?? '',
                'script_properties' => $dbObject['script_properties'] ?? '',
                'script_migration_forward' => $dbObject['script_migration_forward'] ?? '',
                'script_migration_backward' => $dbObject['script_migration_backward'] ?? '',
                
                'ui_config' => $dbObject['ui_config'] ?? '',
                'last_modified' => $dbObject['updated_at'] ? strtotime($dbObject['updated_at']) : time()
            ];

            $payload = json_encode(['success' => true, 'data' => $data, 'source' => 'database']);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            error_log("LocalController::getObject error: " . $e->getMessage());
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }
    }

    public function updateProject(Request $request, Response $response, $args)
    {
        $id = $args['id'];
        $data = json_decode($request->getBody(), true);

        $name = $data['name'] ?? null;
        $description = $data['description'] ?? null;
        $status = $data['status'] ?? null;
        $folderPath = $data['folder_path'] ?? $id;

        try {
            // Try to find in DB by folder_path or ID
            $stmt = $this->db->prepare("SELECT id FROM projects WHERE folder_path = ? OR id = ?");
            $stmt->execute([$id, $id]);
            $dbId = $stmt->fetchColumn();

            if ($dbId) {
                $stmt = $this->db->prepare("
                    UPDATE projects 
                    SET name = ?, description = ?, status = ?, folder_path = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                ");
                $stmt->execute([$name, $description, $status, $folderPath, $dbId]);
            } else {
                // If not in DB yet, create it
                $stmt = $this->db->prepare("
                    INSERT INTO projects (name, description, status, folder_path, created_at, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ");
                $stmt->execute([$name, $description, $status, $folderPath]);
            }

            $payload = json_encode(['success' => true]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    public function createProject(Request $request, Response $response, $args)
    {
        $data = $request->getParsedBody();
        $name = $data['name'] ?? null;
        // Basic validation
        if (!$name) {
            $payload = json_encode(['success' => false, 'error' => 'Project Name is required']);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            $project = $this->fileService->createProject($name); // Description ignored for local structure currently
            $payload = json_encode(['success' => true, 'data' => $project]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }
    public function getParameters(Request $request, Response $response, $args)
    {
        $id = $args['id'];
        $objectPath = $this->resolveObjectPath($id);

        if (!$objectPath) {
            throw new \Exception("Objekt nicht gefunden: $id");
        }

        try {
            // First, try to get the object from database by path
            $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path = ?");
            $stmt->execute([$objectPath]);
            $dbObjectId = $stmt->fetchColumn();

            if ($dbObjectId) {
                // Object exists in DB - load parameters from database (includes ui_code)
                $stmt = $this->db->prepare("
                    SELECT p.*, pt.language_code, pt.description, pt.values_list, pt.ui_tooltip
                    FROM parameters p
                    LEFT JOIN parameter_translations pt ON p.id = pt.param_id
                    WHERE p.gdl_object_id = ?
                    ORDER BY p.sort_order ASC
                ");
                $stmt->execute([$dbObjectId]);
                $rawParams = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $parameters = [];
                foreach ($rawParams as $row) {
                    $paramId = $row['id'];
                    if (!isset($parameters[$paramId])) {
                        $parameters[$paramId] = [
                            'id' => $row['id'],
                            'gdl_name' => $row['gdl_name'],
                            'gdl_type' => $row['gdl_type'],
                            'function_group' => $row['function_group'],
                            'array_type' => $row['array_type'],
                            'array_first_dim' => $row['array_first_dim'],
                            'array_second_dim' => $row['array_second_dim'],
                            'default_value_json' => $row['default_value_json'],
                            'is_fix_name' => (bool) $row['is_fix_name'],
                            'flag_bold' => (bool) $row['flag_bold'],
                            'flag_child' => (bool) $row['flag_child'],
                            'flag_hidden' => (bool) $row['flag_hidden'],
                            'flag_unique' => (bool) $row['flag_unique'],
                            'ui_page' => $row['ui_page'],
                            'is_ui_element' => (bool) $row['is_ui_element'],
                            'ui_code' => $row['ui_code'], // IMPORTANT: Include ui_code from DB!
                            'sort_order' => $row['sort_order'],
                            'created_at' => $row['created_at'],
                            'updated_at' => $row['updated_at'],
                            'translations' => []
                        ];
                    }
                    if ($row['language_code']) {
                        $parameters[$paramId]['translations'][] = [
                            'language_code' => $row['language_code'],
                            'description' => $row['description'],
                            'values_list' => $row['values_list'],
                            'ui_tooltip' => $row['ui_tooltip']
                        ];
                    }
                }

                $payload = json_encode(['success' => true, 'data' => array_values($parameters)]);
                $response->getBody()->write($payload);
                return $response->withHeader('Content-Type', 'application/json');
            }

            // Fallback: Load from files if not in database
            $data = $this->fileService->getObjectDetails($objectPath);
            $parameters = json_decode($data['parameters_json'], true);

            $payload = json_encode(['success' => true, 'data' => $parameters]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }
    public function exportXml(Request $request, Response $response, $args)
    {
        $id = $args['id'];
        $objectPath = $this->resolveObjectPath($id);

        if (!$objectPath) {
            throw new \Exception("Objekt nicht gefunden: $id");
        }

        $objectName = basename($objectPath);
        $xmlPath = $objectPath . '/Parameters.xml';

        // Try to find object in database
        $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path = ?");
        $stmt->execute([$objectPath]);
        $dbObjectId = $stmt->fetchColumn();

        $xmlContent = null;

        if ($dbObjectId) {
            // Object exists in DB - generate XML from database (but don't save to file automatically)
            error_log("exportXml: Generating XML from database for object ID: $dbObjectId");
            $xmlService = new \App\Services\GdlXmlService($this->db);
            $xmlContent = $xmlService->generateParametersXml((int) $dbObjectId);
        } else if (file_exists($xmlPath)) {
            // Fallback: read from local file if not in DB
            error_log("exportXml: Object not in DB, reading from local file: $xmlPath");
            $xmlContent = file_get_contents($xmlPath);
        } else {
            // No DB entry and no local file
            $payload = json_encode(['success' => false, 'error' => 'Parameters.xml not found and object not in database']);
            $response->getBody()->write($payload);
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write($xmlContent);
        return $response
            ->withHeader('Content-Type', 'application/xml')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $objectName . '_parameters.xml"');
    }

    /**
     * POST /local/objects/{id}/parameters/import
     * Body: { "xml": "..." }
     */
    public function importXml(Request $request, Response $response, $args)
    {
        $id = $args['id'];
        $objectPath = $this->resolveObjectPath($id);
        $data = json_decode($request->getBody(), true);

        if (!$objectPath) {
            throw new \Exception("Ungültiges Objekt-ID Format oder Objekt nicht gefunden.");
        }

        if (!isset($data['xml'])) {
            $payload = json_encode(['success' => false, 'error' => 'XML content required']);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            // 1. Save to local Parameters.xml
            $xmlPath = $objectPath . '/Parameters.xml';
            file_put_contents($xmlPath, $data['xml']);

            // 2. Trigger DB Import (re-read from file)
            $objectId = $this->importService->importObjectFromFiles($objectPath);

            $payload = json_encode(['success' => true, 'data' => ['object_id' => $objectId]]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    public function updateScripts(Request $request, Response $response, $args)
    {
        try {
            $id = $args['id'];
            $objectPath = $this->resolveObjectPath($id);

            if (!$objectPath) {
                throw new \Exception("Objekt nicht gefunden: $id");
            }
            $data = json_decode($request->getBody(), true);

            if (!$data) {
                throw new \Exception("Invalid JSON body");
            }

            $results = [];

            // 1. Process Values (Parameter Script)
            if (isset($data['parameters'])) {
                $code = $this->generatorService->generateValuesScript($data['parameters']);
                if (!empty($code)) {
                    $header = "-------- V A L U E S -----------------------------------------";
                    $success = $this->fileService->mergeScript($objectPath, '2-Parameter-Script.gdl', $code, $header);
                    $results['parameter_script'] = $success;
                }
            }

            $payload = json_encode(['success' => true, 'results' => $results]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }
    public function updateObject(Request $request, Response $response, $args)
    {
        $id = $args['id'];
        $objectPath = $this->resolveObjectPath($id);

        if (!$objectPath) {
            throw new \Exception("Objekt nicht gefunden: $id");
        }
        $data = json_decode($request->getBody(), true);

        try {
            // IMPROVED: Detect if this is a full script update from Script Editor
            // or a partial update from UI Designer
            $isFullScriptUpdate = false;
            $scriptFields = ['script_master', 'script_parameter', 'script_2d', 'script_3d', 
                           'script_ui', 'script_properties', 'script_migration_forward', 'script_migration_backward'];
            
            // If ONLY one script field is being updated (typical for Script Editor)
            // and no ui_config is present, treat as full script update
            $updatedScriptCount = 0;
            foreach ($scriptFields as $field) {
                if (isset($data[$field])) {
                    $updatedScriptCount++;
                }
            }
            
            $isFullScriptUpdate = ($updatedScriptCount === 1 && !isset($data['ui_config']));
            
            // Script service and markers needed for both paths
            $scriptService = new \App\Services\GdlScriptService();
            
            $scriptMarkers = [
                'script_parameter' => ['header' => '! --- AUTO GENERATED VALUES ---', 'footer' => '! --- END VALUES ---'],
                'script_master' => ['header' => '! --- AUTO GENERATED ARRAYS ---', 'footer' => '! --- END ARRAYS ---'],
                'script_ui' => ['header' => '! --- UI-DESIGNER AUTO-CODE START ---', 'footer' => '! --- UI-DESIGNER AUTO-CODE END ---'],
                'script_2d' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
                'script_3d' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
                'script_properties' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
                'script_forward_migration' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
                'script_backward_migration' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---']
            ];
            
            if ($isFullScriptUpdate) {
                // Script Editor mode: Direct save without merging
                // User is editing the full script, so respect their changes completely
                error_log("LocalController: Full script update detected - skipping merge");
                $this->fileService->saveObjectDetails($objectPath, $data);
            } else {
                // UI Designer mode: Merge auto-generated blocks
                error_log("LocalController: Partial update detected - using merge logic");
                
                // Read existing scripts from files for merging
                $scriptFileMap = [
                    'script_master' => '1-Master-Script.gdl',
                    'script_parameter' => '2-Parameter-Script.gdl',
                    'script_2d' => '3-2D-Script.gdl',
                    'script_3d' => '4-3D-Script.gdl',
                    'script_ui' => '5-Interface-Script.gdl',
                    'script_properties' => '6-Properties-Script.gdl',
                    'script_forward_migration' => '7-Forward-Script.gdl',
                    'script_backward_migration' => '8-Backward-Script.gdl'
                ];

                // Merge scripts before saving
                foreach ($scriptFileMap as $dataKey => $filename) {
                    $altKey = null;
                    if ($dataKey === 'script_forward_migration') $altKey = 'script_migration_forward';
                    if ($dataKey === 'script_backward_migration') $altKey = 'script_migration_backward';
                    
                    $newContent = $data[$dataKey] ?? ($altKey ? $data[$altKey] ?? null : null);
                    
                    if ($newContent !== null && !$scriptService->isPlaceholderContent($newContent) && !empty(trim($newContent))) {
                        $filePath = $objectPath . '/' . $filename;
                        $existingContent = file_exists($filePath) ? file_get_contents($filePath) : '';
                        
                        $markers = $scriptMarkers[$dataKey] ?? ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'];
                        
                        $mergedContent = $scriptService->mergeContent(
                            $existingContent,
                            $newContent,
                            $markers['header'],
                            $markers['footer']
                        );
                        
                        // Update data with merged content
                        $data[$dataKey] = $mergedContent;
                    }
                }

                // Now save merged scripts to filesystem
                $this->fileService->saveObjectDetails($objectPath, $data);
            }

            // 2. Sync Metadata to Database
            $name = $data['name'] ?? basename($objectPath);
            $description = $data['description'] ?? null;
            $status = $data['status'] ?? null;

            // Check if object exists in DB
            $stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE local_file_path = ? OR id = ?");
            $stmt->execute([$objectPath, $id]);
            $currentDbObject = $stmt->fetch(\PDO::FETCH_ASSOC);
            $dbId = $currentDbObject ? $currentDbObject['id'] : null;

            if ($dbId) {
                // Update existing - merge scripts in DB too
                $sql = "UPDATE gdl_objects SET updated_at = CURRENT_TIMESTAMP";
                $params = [];
                if ($name) {
                    $sql .= ", name = ?";
                    $params[] = $name;
                }
                if ($description !== null) {
                    $sql .= ", description = ?";
                    $params[] = $description;
                }
                if (isset($data['status'])) {
                    $sql .= ", status = ?";
                    $params[] = $status;
                }

                // Sync Scripts to DB (with or without merging depending on context)
                $scriptFieldsList = [
                    'script_master',
                    'script_parameter',
                    'script_2d',
                    'script_3d',
                    'script_ui',
                    'script_properties',
                    'script_migration_forward',
                    'script_migration_backward'
                ];
                
                foreach ($scriptFieldsList as $scriptField) {
                    $val = null;
                    if (isset($data[$scriptField])) {
                        $val = $data[$scriptField];
                    } elseif ($scriptField === 'script_migration_forward' && isset($data['script_forward_migration'])) {
                        $val = $data['script_forward_migration'];
                    } elseif ($scriptField === 'script_migration_backward' && isset($data['script_backward_migration'])) {
                        $val = $data['script_backward_migration'];
                    }

                    if ($val !== null) {
                        if ($isFullScriptUpdate) {
                            // Script Editor mode: Direct update
                            $sql .= ", $scriptField = ?";
                            $params[] = $val;
                        } else {
                            // UI Designer mode: Merge with existing DB content
                            $existingDbContent = $currentDbObject[$scriptField] ?? '';
                            $markers = $scriptMarkers[$scriptField] ?? $scriptMarkers['script_2d'];
                            
                            if (!$scriptService->isPlaceholderContent($val) && !empty(trim($val))) {
                                $mergedDbContent = $scriptService->mergeContent(
                                    $existingDbContent,
                                    $val,
                                    $markers['header'],
                                    $markers['footer']
                                );
                                $sql .= ", $scriptField = ?";
                                $params[] = $mergedDbContent;
                            } elseif (empty($existingDbContent)) {
                                $sql .= ", $scriptField = ?";
                                $params[] = $val;
                            }
                        }
                    }
                }

                // Save ui_config to DB (previously missing – caused "changes disappear" bug)
                if (isset($data['ui_config'])) {
                    $sql .= ", ui_config = ?";
                    $params[] = $data['ui_config'];
                }

                $sql .= " WHERE id = ?";
                $params[] = $dbId;

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
            } else {
                // If it doesn't exist in DB yet, create it (no merge needed for new records)
                $scriptFields = [
                    'script_master',
                    'script_parameter',
                    'script_2d',
                    'script_3d',
                    'script_ui',
                    'script_properties',
                    'script_migration_forward',
                    'script_migration_backward'
                ];

                $columns = ['name', 'description', 'status', 'local_file_path', 'is_local_sync', 'created_at', 'updated_at'];
                $placeholders = ['?', '?', '?', '?', 1, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'];
                $params = [$name, $description ?: '', $status ?: 'active', $objectPath];

                foreach ($scriptFields as $scriptField) {
                    $val = null;
                    if (isset($data[$scriptField])) {
                        $val = $data[$scriptField];
                    } elseif ($scriptField === 'script_migration_forward' && isset($data['script_forward_migration'])) {
                        $val = $data['script_forward_migration'];
                    } elseif ($scriptField === 'script_migration_backward' && isset($data['script_backward_migration'])) {
                        $val = $data['script_backward_migration'];
                    }

                    if ($val !== null) {
                        $columns[] = $scriptField;
                        $placeholders[] = '?';
                        $params[] = $val;
                    }
                }

                // Save ui_config on INSERT too
                if (isset($data['ui_config'])) {
                    $columns[] = 'ui_config';
                    $placeholders[] = '?';
                    $params[] = $data['ui_config'];
                }

                $sql = "INSERT INTO gdl_objects (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
                $sql = str_replace(["'CURRENT_TIMESTAMP'"], ["CURRENT_TIMESTAMP"], $sql);

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
            }

            $payload = json_encode(['success' => true]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    public function updateParameter(Request $request, Response $response, $args)
    {
        // For local mode, parameter ID is actually md5(parameter_name)
        // We need to find which object this parameter belongs to
        // But we don't have object context in the URL!
        //
        // Solution: Frontend needs to send object_id in the request body
        // OR we change the route to /local/objects/{objectId}/parameters/{paramId}
        //
        // For now, let's expect object_path in request body (base64 encoded or raw)

        $parameterId = $args['id'];
        $body = (string) $request->getBody();
        $data = json_decode($body, true);

        $objectPath = $data['object_path'] ?? null;

        // Debug logging
        $logFile = __DIR__ . '/../../debug_log.txt';
        $logData = date('Y-m-d H:i:s') . " - updateParameter: ID=$parameterId, Path=$objectPath\n";
        file_put_contents($logFile, $logData, FILE_APPEND);

        // If object_path is not in body, try to find it via parameterId if numeric
        if (empty($objectPath) && is_numeric($parameterId)) {
            $stmt = $this->db->prepare("
                SELECT o.local_file_path
                FROM gdl_objects o
                JOIN parameters p ON o.id = p.gdl_object_id
                WHERE p.id = ?
            ");
            $stmt->execute([$parameterId]);
            $objectPath = $stmt->fetchColumn();
        }

        if (empty($objectPath)) {
            $payload = json_encode(['success' => false, 'error' => 'object_path required or object not found for parameter']);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            // Load current ui.json
            $uiJsonPath = $objectPath . '/ui.json';
            $uiData = [];

            if (file_exists($uiJsonPath)) {
                $uiData = json_decode(file_get_contents($uiJsonPath), true) ?: [];
            } else {
                $logData = date('Y-m-d H:i:s') . " - ui.json not found at $uiJsonPath\n";
                file_put_contents($logFile, $logData, FILE_APPEND);
            }

            // Ensure parameters array exists
            if (!isset($uiData['parameters'])) {
                $uiData['parameters'] = [];
            }

            $paramName = null;
            $uiCode = $data['ui_code'] ?? null;

            // Normalize ui_code: ensure it's stored as a JSON string if it's an array, 
            // but keep it as is if it's already a string.
            // However, for VALUES/VALUES2 generation, we need to know the structure.
            // If the frontend sends an object/array, we should encode it.
            if (is_array($uiCode) || is_object($uiCode)) {
                $uiCode = json_encode($uiCode);
            }

            // Find parameter by ID and update ui_code in ui.json
            $paramFound = false;
            foreach ($uiData['parameters'] as &$param) {
                if (isset($param['id']) && $param['id'] === $parameterId) {
                    if (array_key_exists('ui_code', $data)) {
                        $param['ui_code'] = isset($data['ui_code']) && (is_array($data['ui_code']) || is_object($data['ui_code']))
                            ? $data['ui_code'] // Keep as array/object in JSON
                            : $uiCode;        // Use normalized string/null

                        // If it's a string that looks like JSON, try to decode it for ui.json consistency
                        if (is_string($param['ui_code']) && (strpos($param['ui_code'], '{') === 0 || strpos($param['ui_code'], '[') === 0)) {
                            $decoded = json_decode($param['ui_code'], true);
                            if ($decoded !== null) {
                                $param['ui_code'] = $decoded;
                            }
                        }
                    }
                    $paramName = $param['name'] ?? null;
                    $paramFound = true;
                    break;
                }
            }
            unset($param);

            // If parameter not found in ui.json, add it if we are updating ui_code
            if (!$paramFound && array_key_exists('ui_code', $data)) {
                $xmlPath = $objectPath . '/Parameters.xml';
                if (file_exists($xmlPath)) {
                    $details = $this->fileService->getObjectDetails($objectPath);
                    $parameters = json_decode($details['parameters_json'], true);

                    foreach ($parameters as $p) {
                        if ($p['id'] === $parameterId) {
                            $paramName = $p['gdl_name'];
                            $uiData['parameters'][] = [
                                'id' => $parameterId,
                                'name' => $paramName,
                                'ui_code' => $uiCode
                            ];
                            $paramFound = true;
                            break;
                        }
                    }
                }
            }

            // Save ui.json
            file_put_contents($uiJsonPath, json_encode($uiData, JSON_PRETTY_PRINT));

            // CRITICAL: Also update the database if the object is synced
            // We use a broader field update logic here similar to ParameterController
            $allowedFields = [
                'gdl_name',
                'gdl_type',
                'function_group',
                'array_type',
                'array_first_dim',
                'array_second_dim',
                'default_value_json',
                'flag_bold',
                'flag_child',
                'flag_hidden',
                'flag_unique',
                'ui_page',
                'is_ui_element',
                'ui_code'
            ];

            $updateFields = [];
            $updateValues = [];

            foreach ($allowedFields as $field) {
                if (array_key_exists($field, $data)) {
                    $updateFields[] = "$field = ?";
                    $val = $data[$field];
                    if (strpos($field, 'flag_') === 0 || in_array($field, ['is_fix_name', 'is_ui_element'])) {
                        $updateValues[] = (int) $val;
                    } else {
                        if (($field === 'ui_code' || $field === 'default_value_json') && (is_array($val) || is_object($val))) {
                            $val = json_encode($val);
                        }
                        $updateValues[] = $val;
                    }
                    // Capture name if we are updating it
                    if ($field === 'gdl_name')
                        $paramName = $val;
                }
            }

            if (!empty($updateFields)) {
                if (is_numeric($parameterId)) {
                    $updateValues[] = $parameterId;
                    $sql = "UPDATE parameters SET " . implode(', ', $updateFields) . " WHERE id = ?";
                    $stmtDb = $this->db->prepare($sql);
                    $stmtDb->execute($updateValues);

                    $logData = date('Y-m-d H:i:s') . " - Updated by numeric ID: $parameterId\n";
                    file_put_contents($logFile, $logData, FILE_APPEND);
                } else {
                    // Find name if not already known
                    if (!$paramName) {
                        $xmlPath = $objectPath . '/Parameters.xml';
                        $details = $this->fileService->getObjectDetails($objectPath);
                        $parameters = json_decode($details['parameters_json'], true);
                        foreach ($parameters as $p) {
                            if ($p['id'] === $parameterId) {
                                $paramName = $p['gdl_name'];
                                break;
                            }
                        }
                    }

                    if ($paramName) {
                        $dbObjectId = $this->resolveDbObject($objectPath);

                        if ($dbObjectId) {
                            $updateValues[] = $dbObjectId;
                            $updateValues[] = $paramName;
                            $sql = "UPDATE parameters SET " . implode(', ', $updateFields) . " WHERE gdl_object_id = ? AND gdl_name = ?";
                            $stmtDb = $this->db->prepare($sql);
                            $stmtDb->execute($updateValues);

                            $logData = date('Y-m-d H:i:s') . " - Updated by Path: $objectPath (DB ID: $dbObjectId), Param: $paramName\n";
                            file_put_contents($logFile, $logData, FILE_APPEND);
                        } else {
                            $logData = date('Y-m-d H:i:s') . " - DB Object NOT FOUND for path: $objectPath\n";
                            file_put_contents($logFile, $logData, FILE_APPEND);
                        }
                    } else {
                        $logData = date('Y-m-d H:i:s') . " - Param Name NOT FOUND for ID: $parameterId\n";
                        file_put_contents($logFile, $logData, FILE_APPEND);
                    }
                }
            }

            $payload = json_encode(['success' => true]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    /**
     * Import a local object from filesystem into database
     * POST /local/objects/import
     * Body: { "object_path": "/path/to/object" }
     */
    public function importObject(Request $request, Response $response, $args)
    {
        error_log("LocalController::importObject() called");
        $data = json_decode($request->getBody(), true);
        error_log("Import request data: " . json_encode($data));

        if (!isset($data['object_path'])) {
            error_log("Import failed: object_path missing");
            $payload = json_encode(['success' => false, 'error' => 'object_path required']);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            $objectPath = $data['object_path'];
            error_log("Importing object from path: $objectPath");
            
            $objectId = $this->importService->importObjectFromFiles($objectPath);
            error_log("Object imported successfully with ID: $objectId");

            // Fetch ui_config if ui.json exists
            $uiConfig = [];
            $uiJsonPath = $objectPath . '/ui.json';
            if (file_exists($uiJsonPath)) {
                $uiConfig = json_decode(file_get_contents($uiJsonPath), true) ?: [];
            }

            $payload = json_encode([
                'success' => true,
                'data' => [
                    'object_id' => $objectId,
                    'ui_config' => $uiConfig,
                    'last_modified' => is_dir($objectPath) && file_exists($objectPath) ? @filemtime($objectPath) : time()
                ]
            ]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            error_log("Import failed with exception: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    /**
     * Export database object back to filesystem
     * POST /local/objects/{id}/export
     */
    public function exportObject(Request $request, Response $response, $args)
    {
        $objectId = $args['id'];

        // If ID is Base64 encoded path, decode it
        if (!is_numeric($objectId)) {
            $objectPath = base64_decode($objectId, true);
            if ($objectPath !== false) {
                // Find ID in DB
                $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path = ?");
                $stmt->execute([$objectPath]);
                $dbId = $stmt->fetchColumn();
                if ($dbId) {
                    $objectId = $dbId;
                } else {
                    // Fallback: pass the path to export service if it supports it
                    $objectId = $objectPath;
                }
            }
        }

        try {
            $this->exportService->exportObjectToFiles($objectId);

            $payload = json_encode(['success' => true, 'message' => 'Object exported successfully']);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }

    public function runTask(Request $request, Response $response, $args)
    {
        $data = json_decode($request->getBody(), true);
        $taskKey = $data['task'] ?? '';
        $projectPath = $data['project_path'] ?? '';

        if (empty($taskKey) || empty($projectPath)) {
            $payload = json_encode(['success' => false, 'error' => 'task and project_path required']);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // Map task keys to gdlconverter.py commands
        $taskMapping = [
            'x2g_all' => 'x2g --all',
            'g2x_all' => 'g2x --all',
            'lcf' => 'g2L --all',
            'images_all' => 'images --all',
            'svg2tiff' => 'svg2tiff --all',
            'paramcsv_all' => 'paramcsv --all',
            'g2h_all' => 'l2hsf --all',
            'h2g_all' => 'h2g --all'
        ];

        if (!isset($taskMapping[$taskKey])) {
            $payload = json_encode(['success' => false, 'error' => 'Unknown task: ' . $taskKey]);
            $response->getBody()->write($payload);
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            // If projectPath is a numeric DB ID, resolve it to the actual folder_path
            if (is_numeric($projectPath)) {
                $stmt = $this->db->prepare("SELECT folder_path FROM projects WHERE id = ?");
                $stmt->execute([(int)$projectPath]);
                $folderPath = $stmt->fetchColumn();
                if ($folderPath) {
                    $projectPath = $folderPath;
                    error_log("runTask: Resolved project ID $projectPath → $folderPath");
                } else {
                    throw new \Exception("Projekt-ID $projectPath nicht in der Datenbank gefunden.");
                }
            }

            // If projectPath is not absolute, build full path
            if ($projectPath[0] !== '/') {
                $basePath = $this->fileService->getBasePath();
                $projectPath = $basePath . '/' . $projectPath;
            }
            
            error_log("runTask: Using project path: $projectPath");

            $pythonCmd = 'python3';
            $scriptPath = $projectPath . '/bin/gdlconverter.py';

            if (!file_exists($scriptPath)) {
                error_log("runTask: Script not found at: $scriptPath");
                throw new \Exception("gdlconverter.py nicht gefunden in $projectPath/bin/");
            }
            
            if (!is_dir($projectPath)) {
                throw new \Exception("Projektverzeichnis nicht gefunden: $projectPath");
            }

            $command = sprintf(
                '%s -u %s %s %s 2>&1',
                escapeshellcmd($pythonCmd),
                escapeshellarg($scriptPath),
                $taskMapping[$taskKey],
                escapeshellarg($projectPath)
            );
            
            error_log("runTask: Executing command: $command");

            // Execute and capture output
            $output = shell_exec($command);

            $payload = json_encode([
                'success' => true,
                'output' => $output,
                'command' => $command
            ]);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (\Exception $e) {
            $payload = json_encode(['success' => false, 'error' => $e->getMessage()]);
            $response->getBody()->write($payload);
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    }
    /**
     * List images from Makros folder
     */
    public function listMakrosImages(Request $request, Response $response, array $args): Response
    {
        $queryParams = $request->getQueryParams();
        $projectId = $queryParams['projectId'] ?? null;

        if (!$projectId) {
            error_log("listMakrosImages: No project ID provided");
            return ResponseHelper::error($response, 'Project ID required', 400);
        }

        error_log("listMakrosImages: Looking for images in project: $projectId");

        // Get project base path
        $basePath = $this->fileService->getBasePath();
        $projectPath = $basePath . '/' . $projectId;
        
        error_log("listMakrosImages: Project path: $projectPath");

        // Try multiple possible Makros folder locations
        $possiblePaths = [
            $projectPath . '/01_gsms/gdl-ui-studio/Makros',  // New structure
            $projectPath . '/Makros',                         // Direct in project root
            $projectPath . '/02_source/Makros'                // Alternative location
        ];
        
        $images = [];
        $foundPath = null;
        
        foreach ($possiblePaths as $makrosPath) {
            if (is_dir($makrosPath)) {
                $foundPath = $makrosPath;
                error_log("listMakrosImages: ✓ Found Makros folder at: $makrosPath");
                
                $files = scandir($makrosPath);
                $allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'gif', 'bmp'];

                foreach ($files as $file) {
                    if ($file === '.' || $file === '..')
                        continue;
                    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                    if (in_array($ext, $allowedExtensions)) {
                        $images[] = $file;
                    }
                }
                break;
            } else {
                error_log("listMakrosImages: ✗ Not found at: $makrosPath");
            }
        }

        if (!$foundPath) {
            error_log("listMakrosImages: WARNING - No Makros folder found in any location!");
        }

        error_log("listMakrosImages: Found " . count($images) . " images");

        return ResponseHelper::success($response, $images);
    }

    /**
     * Serve image from Makros folder
     */
    public function serveMakrosImage(Request $request, Response $response, array $args): Response
    {
        $queryParams = $request->getQueryParams();
        $projectId = $queryParams['projectId'] ?? null;
        $imageName = $queryParams['image'] ?? null;

        if (!$projectId || !$imageName) {
            return $response->withStatus(400)->withHeader('Content-Type', 'text/plain')->write('Missing parameters');
        }

        // Sanitize image name
        $imageName = basename($imageName);

        // Get project base path
        $basePath = $this->fileService->getBasePath();
        $projectPath = $basePath . '/' . $projectId;
        
        // Try multiple possible Makros folder locations
        $possiblePaths = [
            $projectPath . '/01_gsms/gdl-ui-studio/Makros/' . $imageName,
            $projectPath . '/Makros/' . $imageName,
            $projectPath . '/02_source/Makros/' . $imageName
        ];
        
        $imagePath = null;
        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                $imagePath = $path;
                break;
            }
        }
        
        if (!$imagePath) {
            error_log("serveMakrosImage: Image '$imageName' not found in any Makros folder for project $projectId");
            return $response->withStatus(404)->withHeader('Content-Type', 'text/plain')->write('Image not found');
        }

        // Determine content type
        $ext = strtolower(pathinfo($imageName, PATHINFO_EXTENSION));
        $mimeTypes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'bmp' => 'image/bmp'
        ];
        $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

        // Serve the file
        $response->getBody()->write(file_get_contents($imagePath));
        return $response->withHeader('Content-Type', $contentType);
    }

    private function resolveDbObject($objectPath)
    {
        // 1. Try exact path match
        $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path = ?");
        $stmt->execute([$objectPath]);
        $id = $stmt->fetchColumn();
        if ($id)
            return $id;

        // 2. Try partial match with realpath
        $realPath = realpath($objectPath);
        if ($realPath) {
            $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path = ?");
            $stmt->execute([$realPath]);
            $id = $stmt->fetchColumn();
            if ($id)
                return $id;
        }

        // 3. Try LIKE match as fallback (risky but helpful for slight path variations)
        $folderName = basename($objectPath);
        $stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE local_file_path LIKE ?");
        $stmt->execute(["%$folderName"]);
        $id = $stmt->fetchColumn();

        return $id ?: null;
    }
}
