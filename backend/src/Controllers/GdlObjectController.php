<?php
namespace App\Controllers;

use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use \PDO;

class GdlObjectController
{
	protected PDO $db;

	public function __construct(PDO $db)
	{
		$this->db = $db;
	}

	/**
	 * Get all GDL objects for a project
	 */
	public function getObjectsByProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return ResponseHelper::error($response, 'Project ID is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("
				SELECT g.*, 
					   COUNT(p.id) as parameter_count
				FROM gdl_objects g
				LEFT JOIN parameters p ON g.id = p.gdl_object_id
				WHERE g.project_id = ?
				GROUP BY g.id
				ORDER BY g.updated_at DESC
			");
			$stmt->execute([$projectId]);
			$objects = $stmt->fetchAll(PDO::FETCH_ASSOC);

			return ResponseHelper::success($response, $objects);

		} catch (\PDOException $e) {
			error_log("DB Error fetching GDL objects: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Get a single GDL object
	 */
	public function getObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("
				SELECT g.*, 
					   COUNT(p.id) as parameter_count
				FROM gdl_objects g
				LEFT JOIN parameters p ON g.id = p.gdl_object_id
				WHERE g.id = ?
				GROUP BY g.id
			");
			$stmt->execute([$objectId]);
			$object = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$object) {
				return ResponseHelper::error($response, 'GDL object not found.', 404);
			}

			return ResponseHelper::success($response, $object);

		} catch (\PDOException $e) {
			error_log("DB Error fetching GDL object: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Create a new GDL object
	 */
	public function createObject(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');

		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		$projectId = $data['project_id'] ?? null;
		$objectName = $data['name'] ?? null;
		$description = $data['description'] ?? null;
		$status = $data['status'] ?? 'active';
		$filePath = $data['file_path'] ?? null;

		if (!$projectId || empty($objectName)) {
			return ResponseHelper::error($response, 'project_id and name are required.', 400);
		}

		try {
			// Check if object with this name already exists in project
			$stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE project_id = ? AND name = ?");
			$stmt->execute([$projectId, $objectName]);
			$existingObject = $stmt->fetch(PDO::FETCH_ASSOC);

			if ($existingObject) {
				return ResponseHelper::error($response, 'GDL object with this name already exists in project.', 409);
			}

			// Create new object
			$stmt = $this->db->prepare("
				INSERT INTO gdl_objects (project_id, name, description, status, file_path) 
				VALUES (?, ?, ?, ?, ?)
			");
			$stmt->execute([$projectId, $objectName, $description, $status, $filePath]);
			$objectId = $this->db->lastInsertId();

			return ResponseHelper::success(
				$response,
				['id' => $objectId, 'name' => $objectName],
				'GDL object created successfully.',
				201
			);

		} catch (\PDOException $e) {
			error_log("DB Error creating GDL object: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Update GDL object
	 * IMPROVED: Now merges auto-generated script sections instead of overwriting
	 */
	public function updateObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
		}

		$contentType = $request->getHeaderLine('Content-Type');

		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		try {
			// First, get the current object to merge scripts properly
			$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);
			$currentObject = $stmt->fetch(\PDO::FETCH_ASSOC);

			if (!$currentObject) {
				return ResponseHelper::error($response, 'GDL object not found.', 404);
			}

			// IMPROVED: Detect if this is a full script update from Script Editor
			// or a partial update from UI Designer
			$scriptFieldsList = ['script_master', 'script_parameter', 'script_2d', 'script_3d', 
			                     'script_ui', 'script_properties', 'script_migration_forward', 'script_migration_backward'];
			
			$updatedScriptCount = 0;
			foreach ($scriptFieldsList as $field) {
				if (isset($data[$field])) {
					$updatedScriptCount++;
				}
			}
			
			// If ONLY one script field is being updated and no ui_config, treat as full script update (Script Editor)
			$isFullScriptUpdate = ($updatedScriptCount === 1 && !isset($data['ui_config']));
			
			$scriptService = new \App\Services\GdlScriptService();
			$updateFields = [];
			$updateValues = [];

			if (isset($data['name'])) {
				$updateFields[] = "name = ?";
				$updateValues[] = $data['name'];
			}
			if (isset($data['description'])) {
				$updateFields[] = "description = ?";
				$updateValues[] = $data['description'];
			}
			if (isset($data['status'])) {
				$updateFields[] = "status = ?";
				$updateValues[] = $data['status'];
			}
			if (isset($data['file_path'])) {
				$updateFields[] = "file_path = ?";
				$updateValues[] = $data['file_path'];
			}

			// IMPROVED: Merge scripts OR direct update depending on context
			$scriptFields = [
				'script_parameter' => ['header' => '! --- AUTO GENERATED VALUES ---', 'footer' => '! --- END VALUES ---'],
				'script_master' => ['header' => '! --- AUTO GENERATED ARRAYS ---', 'footer' => '! --- END ARRAYS ---'],
				'script_ui' => ['header' => '! --- UI-DESIGNER AUTO-CODE START ---', 'footer' => '! --- UI-DESIGNER AUTO-CODE END ---'],
				'script_2d' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
				'script_3d' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
				'script_properties' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
				'script_migration_forward' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---'],
				'script_migration_backward' => ['header' => '! --- GDL-UI-STUDIO SCRIPT ---', 'footer' => '! --- END GDL-UI-STUDIO SCRIPT ---']
			];

			foreach ($scriptFields as $field => $markers) {
				if (isset($data[$field])) {
					$newContent = $data[$field];
					$existingContent = $currentObject[$field] ?? '';

					if ($isFullScriptUpdate) {
						// Script Editor mode: Direct update without merging
						// User is editing the full script, so respect their changes completely
						error_log("GdlObjectController: Full script update for $field - direct save");
						$updateFields[] = "$field = ?";
						$updateValues[] = $newContent;
					} else {
						// UI Designer mode: Merge auto-generated blocks
						// Only merge if new content is not empty and not a placeholder
						if (!$scriptService->isPlaceholderContent($newContent) && !empty(trim($newContent))) {
							// Merge new content into existing content
							$mergedContent = $scriptService->mergeContent(
								$existingContent,
								$newContent,
								$markers['header'],
								$markers['footer']
							);
							$updateFields[] = "$field = ?";
							$updateValues[] = $mergedContent;
						} elseif (empty($existingContent)) {
							// If existing is empty and new is not placeholder, use new content directly
							$updateFields[] = "$field = ?";
							$updateValues[] = $newContent;
						}
						// If new content is placeholder or empty, keep existing content (don't update)
					}
				}
			}

			if (isset($data['ui_config'])) {
				$updateFields[] = "ui_config = ?";
				$updateValues[] = $data['ui_config'];
			}

			if (empty($updateFields)) {
				return ResponseHelper::error($response, 'No fields to update.', 400);
			}

			$updateValues[] = $objectId;
			$sql = "UPDATE gdl_objects SET " . implode(', ', $updateFields) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?";
			$stmt = $this->db->prepare($sql);
			$stmt->execute($updateValues);

			return ResponseHelper::success($response, null, 'GDL object updated successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error updating GDL object: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Delete GDL object
	 */
	public function deleteObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("DELETE FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);

			if ($stmt->rowCount() === 0) {
				return ResponseHelper::error($response, 'GDL object not found.', 404);
			}

			return ResponseHelper::success($response, null, 'GDL object deleted successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error deleting GDL object: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Duplicate GDL object with all parameters
	 */
	public function duplicateObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
		}

		try {
			$this->db->beginTransaction();

			// Get original object
			$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);
			$object = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$object) {
				$this->db->rollBack();
				return ResponseHelper::error($response, 'GDL object not found.', 404);
			}

			// Create new object name with "Copy" suffix
			$newName = $object['name'] . ' (Kopie)';
			$counter = 1;

			// Check for name conflicts
			while (true) {
				$stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE project_id = ? AND name = ?");
				$stmt->execute([$object['project_id'], $newName]);
				if (!$stmt->fetch())
					break;
				$counter++;
				$newName = $object['name'] . ' (Kopie ' . $counter . ')';
			}

			// Insert new object
			$stmt = $this->db->prepare("
				INSERT INTO gdl_objects (
					project_id, name, description, status, file_path,
					script_parameter, script_master, script_2d, script_3d, 
					script_properties, script_migration_forward, script_migration_backward, script_ui, ui_config
				) 
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			");
			$stmt->execute([
				$object['project_id'],
				$newName,
				$object['description'],
				$object['status'],
				$object['file_path'],
				$object['script_parameter'],
				$object['script_master'],
				$object['script_2d'],
				$object['script_3d'],
				$object['script_properties'],
				$object['script_migration_forward'],
				$object['script_migration_backward'],
				$object['script_ui'],
				$object['ui_config']
			]);
			$newObjectId = $this->db->lastInsertId();

			// Duplicate all parameters
			$stmt = $this->db->prepare("SELECT * FROM parameters WHERE gdl_object_id = ?");
			$stmt->execute([$objectId]);
			$parameters = $stmt->fetchAll(PDO::FETCH_ASSOC);

			foreach ($parameters as $param) {
				$stmt = $this->db->prepare("
					INSERT INTO parameters (
						gdl_object_id, gdl_name, gdl_type, type_color, function_group, 
						array_type, array_first_dim, array_second_dim, default_value_json,
						is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique,
						ui_page, is_ui_element, ui_code, sort_order
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				");
				$stmt->execute([
					$newObjectId,
					$param['gdl_name'],
					$param['gdl_type'],
					$param['type_color'],
					$param['function_group'],
					$param['array_type'],
					$param['array_first_dim'],
					$param['array_second_dim'],
					$param['default_value_json'],
					$param['is_fix_name'],
					$param['flag_bold'],
					$param['flag_child'],
					$param['flag_hidden'],
					$param['flag_unique'],
					$param['ui_page'],
					$param['is_ui_element'],
					$param['ui_code'],
					$param['sort_order']
				]);
			}

			$this->db->commit();

			return ResponseHelper::success(
				$response,
				['id' => $newObjectId, 'name' => $newName],
				'GDL object duplicated successfully.',
				201
			);

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error duplicating GDL object: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * List images in a directory
	 */
	public function listImages(Request $request, Response $response, array $args): Response
	{
		$queryParams = $request->getQueryParams();
		$subFolder = $queryParams['folder'] ?? '';

		// Sanitize subFolder to prevent directory traversal
		$subFolder = str_replace(['..', '\\'], ['', '/'], $subFolder);
		$subFolder = ltrim($subFolder, '/');

		// Base images directory (relative to backend root)
		$baseImagesDir = __DIR__ . '/../../public/images';
		$targetDir = realpath($baseImagesDir . ($subFolder ? '/' . $subFolder : ''));

		if (!$targetDir || strpos($targetDir, realpath($baseImagesDir)) !== 0) {
			// If directory doesn't exist or is outside base dir, return empty list
			return ResponseHelper::success($response, []);
		}

		$images = [];
		if (is_dir($targetDir)) {
			$files = scandir($targetDir);
			$allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'gif'];

			foreach ($files as $file) {
				if ($file === '.' || $file === '..')
					continue;
				$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
				if (in_array($ext, $allowedExtensions)) {
					$images[] = $file;
				}
			}
		}

		return ResponseHelper::success($response, $images);
	}

	/**
	 * Export GDL object as ZIP (Parameters.xml + all scripts)
	 */
	public function exportZip(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;
		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
		}

		try {
			// Get object details
			$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);
			$object = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$object) {
				return ResponseHelper::error($response, 'GDL object not found.', 404);
			}

			$xmlService = new \App\Services\GdlXmlService($this->db);
			$zipService = new \App\Services\ZipService();
			$generator = new \App\Services\GdlCodeGeneratorService();

			$files = [];

			// 1. Add Parameters.xml
			$files['Parameters.xml'] = $xmlService->generateParametersXml((int) $objectId);

			$scriptService = new \App\Services\GdlScriptService();

			// 2. Add standard scripts from database
			$scriptMap = [
				'script_master' => ['filename' => '1-Master-Script.gdl', 'label' => 'MASTER'],
				'script_parameter' => ['filename' => '2-Parameter-Script.gdl', 'label' => 'PARAMETER'],
				'script_2d' => ['filename' => '3-2D-Script.gdl', 'label' => '2D'],
				'script_3d' => ['filename' => '4-3D-Script.gdl', 'label' => '3D'],
				'script_ui' => ['filename' => '5-Interface-Script.gdl', 'label' => 'UI'],
				'script_properties' => ['filename' => '6-Properties-Script.gdl', 'label' => 'PROPERTIES'],
				'script_migration_forward' => ['filename' => '7-Forward-Script.gdl', 'label' => 'MIGRATION'],
				'script_migration_backward' => ['filename' => '8-Backward-Script.gdl', 'label' => 'MIGRATION'],
			];

			$notes = "Exported via GDL-UI-Studio";
			$parametersChanged = false;

			// Get parameters once
			$stmt = $this->db->prepare("SELECT * FROM parameters WHERE gdl_object_id = ? ORDER BY sort_order");
			$stmt->execute([$objectId]);
			$parameters = $stmt->fetchAll(PDO::FETCH_ASSOC);

			foreach ($scriptMap as $column => $config) {
				$filename = $config['filename'];
				$label = $config['label'];
				$dbScript = trim($object[$column] ?? '');

				$hasDbContent = !empty($dbScript);
				$hasAutoArrays = false;
				$hasAutoValues = false;

				if ($label === 'MASTER') {
					$masterArrays = $generator->generateMasterArrays($parameters);
					$hasAutoArrays = !empty($masterArrays);
				} elseif ($label === 'PARAMETER') {
					$valuesCode = $generator->generateValuesCommands($parameters);
					$hasAutoValues = !empty($valuesCode);
				}

				// If no real content, skip
				if (!$hasAutoArrays && !$hasAutoValues && $scriptService->isPlaceholderContent($dbScript)) {
					continue;
				}

				$content = "";

				// 1. DO NOT touch headers (Rule 1)

				// 2. Merge database content if present (managed code)
				if ($hasDbContent) {
					$content = $scriptService->mergeContent($content, $dbScript, "! --- GDL-UI-STUDIO SCRIPT ---", "! --- END GDL-UI-STUDIO SCRIPT ---");
				}

				// 3. Auto-generated parts (Rule 2 - Master arrays specifically mentioned)
				if ($hasAutoArrays && $label === 'MASTER') {
					$header = $scriptService->generateTimestampedHeader("AUTO GENERATED ARRAYS");
					$content = $scriptService->mergeContent($content, $masterArrays, $header, "! --- END ARRAYS ---");
					if (!$parametersChanged) {
						$notes = "VALUES{2} Arrays created/updated";
						$parametersChanged = true;
					}
				} elseif ($hasAutoValues && $label === 'PARAMETER') {
					$header = $scriptService->generateTimestampedHeader("AUTO GENERATED VALUES");
					$content = $scriptService->mergeContent($content, $valuesCode, $header, "! --- END VALUES ---");
				}

				// 4. Add Release Note (Rule 3 - above END)
				$content = $scriptService->addReleaseNote($content, $notes);

				$files[$filename] = $content;
			}

			// Create ZIP
			$zipContent = $zipService->createZipFromContents($files);
			if ($zipContent === false) {
				throw new \Exception("Failed to create ZIP archive.");
			}

			$objectName = str_replace('.gsm', '', $object['name']);
			$response->getBody()->write($zipContent);
			return $response
				->withHeader('Content-Type', 'application/zip')
				->withHeader('Content-Disposition', 'attachment; filename="' . $objectName . '.zip"');

		} catch (\Exception $e) {
			error_log("Error exporting ZIP: " . $e->getMessage());
			return ResponseHelper::error($response, 'Failed to export ZIP: ' . $e->getMessage(), 500);
		}
	}
}
