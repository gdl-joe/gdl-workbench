<?php
namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use \PDO;

class ParameterController
{
	protected PDO $db;

	public function __construct(PDO $db)
	{
		$this->db = $db;
	}

	/**
	 * Check if a parameter name exists for a given object (optionally excluding an id)
	 */
	private function parameterNameExists(int $gdlObjectId, string $gdlName, ?int $excludeId = null): bool
	{
		if ($excludeId) {
			$stmt = $this->db->prepare("SELECT COUNT(*) FROM parameters WHERE gdl_object_id = ? AND LOWER(gdl_name) = LOWER(?) AND id != ?");
			$stmt->execute([$gdlObjectId, $gdlName, $excludeId]);
		} else {
			$stmt = $this->db->prepare("SELECT COUNT(*) FROM parameters WHERE gdl_object_id = ? AND LOWER(gdl_name) = LOWER(?)");
			$stmt->execute([$gdlObjectId, $gdlName]);
		}
		return ((int)$stmt->fetchColumn()) > 0;
	}

	// Helper function to return JSON responses
	private function jsonResponse(Response $response, array $data, int $status = 200): Response
	{
		$response->getBody()->write(json_encode($data));
		return $response
			->withHeader('Content-Type', 'application/json')
			->withStatus($status);
	}

public function importXml(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
			
			if (json_last_error() !== JSON_ERROR_NONE) {
				error_log("JSON Parse Error: " . json_last_error_msg());
				return $this->jsonResponse($response, [
					'success' => false,
					'error' => 'Invalid JSON: ' . json_last_error_msg()
				], 400);
			}
		} else {
			$data = $request->getParsedBody();
		}
	
		$xmlContent = $data['xml_content'] ?? null;
		$gdlObjectId = $data['gdl_object_id'] ?? null;
		$projectId = $data['project_id'] ?? null;
		$objectName = $data['object_name'] ?? null;
	
		error_log("Import XML - GDL Object ID: " . var_export($gdlObjectId, true));
		error_log("Import XML - Project ID: " . var_export($projectId, true));
		error_log("Import XML - Object Name: " . var_export($objectName, true));
	
		if (empty($xmlContent)) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'No XML content provided.'], 400);
		}
	
		// If gdl_object_id is provided, use it directly
		if ($gdlObjectId) {
			// Use existing object
		} elseif (!$projectId || !$objectName) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'gdl_object_id OR (project_id and object_name) are required.'], 400);
		}
	
		// Parse XML first and validate duplicates in the XML
		libxml_use_internal_errors(true);
		$xml = simplexml_load_string($xmlContent);
		if ($xml === false) {
			$xmlErrors = libxml_get_errors();
			$errorMessages = array_map(fn($error) => trim($error->message), $xmlErrors);
			libxml_clear_errors();
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Invalid XML format: ' . implode(', ', $errorMessages)], 400);
		}

		if (!isset($xml->Parameters)) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'XML is missing the <Parameters> root element.'], 400);
		}

		// Validate duplicate parameter names inside the XML (case-insensitive)
		$seenNames = [];
		$duplicates = [];
		foreach ($xml->Parameters->children() as $gdlParameter) {
			$gdlName = trim((string)$gdlParameter['Name']);
			$key = mb_strtolower($gdlName);
			if ($key === '') continue;
			if (isset($seenNames[$key])) {
				$duplicates[] = $gdlName;
			} else {
				$seenNames[$key] = true;
			}
		}
		if (!empty($duplicates)) {
			$uniqueDup = array_values(array_unique($duplicates));
			return $this->jsonResponse($response, [
				'success' => false,
				'error' => 'Duplicate parameter names found in XML: ' . implode(', ', $uniqueDup)
			], 400);
		}

		try {
			$this->db->beginTransaction();

			// If changing name, ensure it doesn't create a duplicate within the same object
			if (array_key_exists('gdl_name', $data)) {
				$stmtObj = $this->db->prepare("SELECT gdl_object_id FROM parameters WHERE id = ?");
				$stmtObj->execute([$parameterId]);
				$gdlObjectId = $stmtObj->fetchColumn();
				if (!$gdlObjectId) {
					$this->db->rollBack();
					return $this->jsonResponse($response, ['error' => 'Parameter not found.'], 404);
				}

				if ($this->parameterNameExists((int)$gdlObjectId, (string)$data['gdl_name'], (int)$parameterId)) {
					$this->db->rollBack();
					return $this->jsonResponse($response, ['error' => 'Another parameter with this name already exists for the object.'], 409);
				}
			}
			// Get or create GDL object
			if (!$gdlObjectId) {
				$stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE project_id = ? AND name = ?");
				$stmt->execute([$projectId, $objectName]);
				$gdlObjectId = $stmt->fetchColumn();

				if (!$gdlObjectId) {
					$stmt = $this->db->prepare("INSERT INTO gdl_objects (project_id, name) VALUES (?, ?)");
					$stmt->execute([$projectId, $objectName]);
					$gdlObjectId = $this->db->lastInsertId();
				}
			}

			// Delete existing parameters for this object
			$deleteTranslationsStmt = $this->db->prepare("DELETE FROM parameter_translations WHERE param_id IN (SELECT id FROM parameters WHERE gdl_object_id = ?)");
			$deleteTranslationsStmt->execute([$gdlObjectId]);
			$deleteParametersStmt = $this->db->prepare("DELETE FROM parameters WHERE gdl_object_id = ?");
			$deleteParametersStmt->execute([$gdlObjectId]);

			$sortOrder = 0;
			foreach ($xml->Parameters->children() as $gdlParameter) {
				$sortOrder++;
				$gdlName = (string)$gdlParameter['Name'];
				$gdlType = $gdlParameter->getName();
				
				$description = '';
				if (isset($gdlParameter->Description)) {
					$description = (string)$gdlParameter->Description;
				}
				
				// WICHTIG: Value korrekt extrahieren als gültiges JSON
				$defaultValue = null;
				if (isset($gdlParameter->Value)) {
					if ($gdlType === 'Dictionary') {
						$defaultValue = json_encode(simplexml_to_array($gdlParameter->Value));
					} else {
						// CDATA und normale Values behandeln
						$valueNode = $gdlParameter->Value;
						$rawValue = trim((string)$valueNode);
						
						// Entferne führende Semikolons und Anführungszeichen (GDL-Konvention)
						$rawValue = preg_replace('/^[";]+|[";]+$/', '', $rawValue);
						
						// Nur setzen wenn nicht leer, sonst NULL lassen
						if ($rawValue !== '') {
							// Als gültiges JSON speichern
							// Zahlen als Zahlen, Rest als String
							if (is_numeric($rawValue)) {
								$defaultValue = json_encode((float)$rawValue);
							} else {
								$defaultValue = json_encode($rawValue);
							}
						}
					}
				} elseif (isset($gdlParameter->ArrayValues)) {
					$arrayValues = [];
					foreach($gdlParameter->ArrayValues->children() as $aVal) {
						$arrayValues[] = (string)$aVal;
					}
					$defaultValue = json_encode($arrayValues);
				}
	
				// Extract flags
				$isFixName = isset($gdlParameter->Fix);
				$flagBold = false;
				$flagChild = false;
				$flagHidden = false;
				$flagUnique = false;
	
				if (isset($gdlParameter->Flags)) {
					foreach ($gdlParameter->Flags->children() as $flag) {
						switch ($flag->getName()) {
							case 'ParFlg_BoldName': $flagBold = true; break;
							case 'ParFlg_Child': $flagChild = true; break;
							case 'ParFlg_Hidden': $flagHidden = true; break;
							case 'ParFlg_Unique': $flagUnique = true; break;
						}
					}
				}
	
				$arrayType = 'None';
				$firstDim = 0;
				$secondDim = 0;
				if (isset($gdlParameter->ArrayValues)) {
					$arrayType = ((int)$gdlParameter->ArrayValues['SecondDimension'] > 0) ? '2D' : '1D';
					$firstDim = (int)$gdlParameter->ArrayValues['FirstDimension'];
					$secondDim = (int)$gdlParameter->ArrayValues['SecondDimension'];
				}
	
				// Insert parameter (mit gdl_object_id statt project_id)
				$stmt = $this->db->prepare("
					INSERT INTO parameters (gdl_object_id, gdl_name, gdl_type, default_value_json, is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique, array_type, array_first_dim, array_second_dim, sort_order)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				");
				$stmt->execute([
					$gdlObjectId, $gdlName, $gdlType, $defaultValue,
					(int)$isFixName, (int)$flagBold, (int)$flagChild, (int)$flagHidden, (int)$flagUnique,
					$arrayType, $firstDim, $secondDim, $sortOrder
				]);
				$paramId = $this->db->lastInsertId();
	
				// Insert translations with values_list from default_value_json
				$valuesList = null;
				if ($defaultValue) {
					$valuesList = json_decode($defaultValue, true);
					if (!is_array($valuesList)) {
						$valuesList = $defaultValue;
					}
				}
				
				$stmt = $this->db->prepare("
					INSERT INTO parameter_translations (param_id, language_code, description, values_list)
					VALUES (?, ?, ?, ?)
				");
				$stmt->execute([$paramId, 'de', $description, $valuesList]);
				$stmt->execute([$paramId, 'en', $description, $valuesList]);
				$stmt->execute([$paramId, 'hu', $description, $valuesList]);
			}
	
			$this->db->commit();
	
			error_log("Import successful! GDL Object ID: " . $gdlObjectId . ", Parameters imported: " . $sortOrder);
			
			// Get object name if not provided
			if (!$objectName) {
				$stmt = $this->db->prepare("SELECT name FROM gdl_objects WHERE id = ?");
				$stmt->execute([$gdlObjectId]);
				$objectName = $stmt->fetchColumn();
			}
	
			return $this->jsonResponse($response, [
				'success' => true,
				'message' => 'Parameters imported successfully.',
				'imported_count' => $sortOrder,
				'gdlObjectId' => $gdlObjectId,
				'objectName' => $objectName
			]);
	
		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error during XML Import: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error during import: ' . $e->getMessage()], 500);
		} catch (\Exception $e) {
			$this->db->rollBack();
			error_log("XML Import Error: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Failed to import parameters: ' . $e->getMessage()], 500);
		}
	}

public function getObjectParameters(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;
	
		if (!$objectId) {
			return $this->jsonResponse($response, ['error' => 'Object ID is required.'], 400);
		}
	
		try {
			$stmt = $this->db->prepare("
				SELECT p.*, pt.language_code, pt.description, pt.values_list, pt.ui_tooltip
				FROM parameters p
				LEFT JOIN parameter_translations pt ON p.id = pt.param_id
				WHERE p.gdl_object_id = ?
				ORDER BY p.sort_order ASC
			");
			$stmt->execute([$objectId]);
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
						'is_fix_name' => (bool)$row['is_fix_name'],
						'flag_bold' => (bool)$row['flag_bold'],
						'flag_child' => (bool)$row['flag_child'],
						'flag_hidden' => (bool)$row['flag_hidden'],
						'flag_unique' => (bool)$row['flag_unique'],
						'ui_page' => $row['ui_page'],
						'is_ui_element' => (bool)$row['is_ui_element'],
						'ui_code' => $row['ui_code'],
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
	
			// Get object name
			$objectStmt = $this->db->prepare("SELECT name FROM gdl_objects WHERE id = ?");
			$objectStmt->execute([$objectId]);
			$objectName = $objectStmt->fetchColumn();
	
			return $this->jsonResponse($response, [
				'success' => true,
				'data' => array_values($parameters),
				'object_name' => $objectName
			]);
	
		} catch (\Exception $e) {
			error_log("Error fetching parameters: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Failed to fetch parameters: ' . $e->getMessage()], 500);
		}
	}
	
public function createParameter(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}
	
		$gdlObjectId = $data['gdl_object_id'] ?? null; // GEÄNDERT
		$gdlName = $data['gdl_name'] ?? null;
		$gdlType = $data['gdl_type'] ?? 'String';
		$insertAfterParamId = $data['insert_after_param_id'] ?? null; // NEU
	
		if (!$gdlObjectId || !$gdlName) {
			return $this->jsonResponse($response, ['error' => 'gdl_object_id and gdl_name are required.'], 400);
		}
	
		try {
			$this->db->beginTransaction();
	
			// Determine sort_order
			if ($insertAfterParamId) {
				// Insert after selected parameter
				$stmt = $this->db->prepare("SELECT sort_order FROM parameters WHERE id = ?");
				$stmt->execute([$insertAfterParamId]);
				$afterSortOrder = $stmt->fetchColumn();
				
				if ($afterSortOrder !== false) {
					// Shift all parameters after this one
					$stmt = $this->db->prepare("UPDATE parameters SET sort_order = sort_order + 1 WHERE gdl_object_id = ? AND sort_order > ?");
					$stmt->execute([$gdlObjectId, $afterSortOrder]);
					$newSortOrder = $afterSortOrder + 1;
				} else {
					// Fallback to end
					$stmt = $this->db->prepare("SELECT MAX(sort_order) as max_order FROM parameters WHERE gdl_object_id = ?");
					$stmt->execute([$gdlObjectId]);
					$newSortOrder = ($stmt->fetchColumn() ?: 0) + 1;
				}
			} else {
				// Insert at end
				$stmt = $this->db->prepare("SELECT MAX(sort_order) as max_order FROM parameters WHERE gdl_object_id = ?");
				$stmt->execute([$gdlObjectId]);
				$newSortOrder = ($stmt->fetchColumn() ?: 0) + 1;
			}
	
			// Insert new parameter
			// Prevent duplicate parameter names for this object
			if ($this->parameterNameExists((int)$gdlObjectId, (string)$gdlName)) {
				$this->db->rollBack();
				return $this->jsonResponse($response, ['success' => false, 'error' => 'Parameter with this name already exists for the object.'], 409);
			}

			$stmt = $this->db->prepare(" 
				INSERT INTO parameters (
					gdl_object_id, gdl_name, gdl_type, default_value_json, 
					is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique, 
					array_type, array_first_dim, array_second_dim, 
					ui_page, is_ui_element, sort_order
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			");
			
			$stmt->execute([
				$gdlObjectId,
				$gdlName,
				$gdlType,
				$data['default_value_json'] ?? null,
				(int)($data['is_fix_name'] ?? false),
				(int)($data['flag_bold'] ?? false),
				(int)($data['flag_child'] ?? false),
				(int)($data['flag_hidden'] ?? false),
				(int)($data['flag_unique'] ?? false),
				$data['array_type'] ?? 'None',
				(int)($data['array_first_dim'] ?? 0),
				(int)($data['array_second_dim'] ?? 0),
				(int)($data['ui_page'] ?? 0),
				(int)($data['is_ui_element'] ?? false),
				$newSortOrder
			]);
	
			$parameterId = $this->db->lastInsertId();
	
			// Insert translations
			$translations = $data['translations'] ?? [];
			if (empty($translations)) {
				$translations = [
					['language_code' => 'de', 'description' => $gdlName],
					['language_code' => 'en', 'description' => $gdlName]
				];
			}
	
			$stmtTrans = $this->db->prepare("
				INSERT INTO parameter_translations (param_id, language_code, description, values_list, ui_tooltip)
				VALUES (?, ?, ?, ?, ?)
			");
	
			foreach ($translations as $trans) {
				$stmtTrans->execute([
					$parameterId,
					$trans['language_code'],
					$trans['description'] ?? '',
					$trans['values_list'] ?? null,
					$trans['ui_tooltip'] ?? null
				]);
			}
	
			$this->db->commit();
	
			return $this->jsonResponse($response, [
				'success' => true,
				'message' => 'Parameter created successfully.',
				'parameterId' => $parameterId
			], 201);
	
		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error creating parameter: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
	
	/**
	 * Update an existing parameter
	 */
	public function updateParameter(Request $request, Response $response, array $args): Response
	{
		$parameterId = $args['parameterId'] ?? null;
	
		if (!$parameterId) {
			return $this->jsonResponse($response, ['error' => 'Parameter ID is required.'], 400);
		}
	
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}
	
		try {
			$this->db->beginTransaction();
	
			// Build UPDATE query dynamically based on provided fields
			$updateFields = [];
			$updateValues = [];
	
			$allowedFields = [
				'gdl_name', 'gdl_type', 'function_group', 'array_type', 
				'array_first_dim', 'array_second_dim', 'default_value_json',
				'is_fix_name', 'flag_bold', 'flag_child', 'flag_hidden', 'flag_unique',
				'ui_page', 'is_ui_element', 'ui_code'
			];
	
			foreach ($allowedFields as $field) {
				if (array_key_exists($field, $data)) {
					$updateFields[] = "$field = ?";
					// Convert boolean fields to int
					if (strpos($field, 'flag_') === 0 || $field === 'is_fix_name' || $field === 'is_ui_element') {
						$updateValues[] = (int)$data[$field];
					} else {
						$updateValues[] = $data[$field];
					}
				}
			}
	
			if (!empty($updateFields)) {
				$updateValues[] = $parameterId;
				$sql = "UPDATE parameters SET " . implode(', ', $updateFields) . " WHERE id = ?";
				$stmt = $this->db->prepare($sql);
				$stmt->execute($updateValues);
			}
	
			// Update translations if provided
			if (isset($data['translations']) && is_array($data['translations'])) {
				$stmtTrans = $this->db->prepare("
					INSERT INTO parameter_translations (param_id, language_code, description, values_list, ui_tooltip)
					VALUES (?, ?, ?, ?, ?)
					ON DUPLICATE KEY UPDATE 
						description = VALUES(description),
						values_list = VALUES(values_list),
						ui_tooltip = VALUES(ui_tooltip)
				");
	
				foreach ($data['translations'] as $trans) {
					$stmtTrans->execute([
						$parameterId,
						$trans['language_code'],
						$trans['description'] ?? null,
						$trans['values_list'] ?? null,
						$trans['ui_tooltip'] ?? null
					]);
				}
			}
	
			$this->db->commit();
	
			return $this->jsonResponse($response, ['message' => 'Parameter updated successfully.']);
	
		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error updating parameter: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
	
	/**
	 * Delete a single parameter
	 */
	public function deleteParameter(Request $request, Response $response, array $args): Response
	{
		$parameterId = $args['parameterId'] ?? null;
	
		if (!$parameterId) {
			return $this->jsonResponse($response, ['error' => 'Parameter ID is required.'], 400);
		}
	
		try {
			$stmt = $this->db->prepare("DELETE FROM parameters WHERE id = ?");
			$stmt->execute([$parameterId]);
	
			if ($stmt->rowCount() === 0) {
				return $this->jsonResponse($response, ['error' => 'Parameter not found.'], 404);
			}
	
			return $this->jsonResponse($response, ['message' => 'Parameter deleted successfully.']);
	
		} catch (\PDOException $e) {
			error_log("DB Error deleting parameter: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
	
	/**
	 * Bulk delete parameters
	 */
	public function bulkDeleteParameters(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}
	
		$parameterIds = $data['parameter_ids'] ?? [];
	
		if (empty($parameterIds) || !is_array($parameterIds)) {
			return $this->jsonResponse($response, ['error' => 'parameter_ids array is required.'], 400);
		}
	
		try {
			$placeholders = str_repeat('?,', count($parameterIds) - 1) . '?';
			$stmt = $this->db->prepare("DELETE FROM parameters WHERE id IN ($placeholders)");
			$stmt->execute($parameterIds);
	
			return $this->jsonResponse($response, [
				'message' => 'Parameters deleted successfully.',
				'deleted_count' => $stmt->rowCount()
			]);
	
		} catch (\PDOException $e) {
			error_log("DB Error bulk deleting parameters: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
	
	/**
	 * Reorder parameters (for drag & drop)
	 */
	public function reorderParameters(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}
	
		$orderedIds = $data['ordered_ids'] ?? [];
	
		if (empty($orderedIds) || !is_array($orderedIds)) {
			return $this->jsonResponse($response, ['error' => 'ordered_ids array is required.'], 400);
		}
	
		try {
			$this->db->beginTransaction();
	
			$stmt = $this->db->prepare("UPDATE parameters SET sort_order = ? WHERE id = ?");
			
			foreach ($orderedIds as $index => $parameterId) {
				$stmt->execute([$index + 1, $parameterId]);
			}
	
			$this->db->commit();
	
			return $this->jsonResponse($response, ['message' => 'Parameters reordered successfully.']);
	
		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error reordering parameters: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Insert parameter at specific position
	 */
	public function insertParameter(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		$gdlObjectId = $data['gdl_object_id'] ?? null;
		$gdlName = $data['gdl_name'] ?? null;
		$gdlType = $data['gdl_type'] ?? 'String';
		$insertPosition = $data['position'] ?? null; // 1-based position

		if (!$gdlObjectId || !$gdlName) {
			return $this->jsonResponse($response, ['error' => 'gdl_object_id and gdl_name are required.'], 400);
		}

		try {
			$this->db->beginTransaction();

			// If position specified, shift existing parameters
			if ($insertPosition !== null && $insertPosition > 0) {
				$stmt = $this->db->prepare("
					UPDATE parameters 
					SET sort_order = sort_order + 1 
					WHERE gdl_object_id = ? AND sort_order >= ?
				");
				$stmt->execute([$gdlObjectId, $insertPosition]);
				$newSortOrder = $insertPosition;
			} else {
				// Insert at end
				$stmt = $this->db->prepare("SELECT MAX(sort_order) as max_order FROM parameters WHERE gdl_object_id = ?");
				$stmt->execute([$gdlObjectId]);
				$newSortOrder = ($stmt->fetchColumn() ?: 0) + 1;
			}

			// Prevent duplicate parameter names for this object
			if ($this->parameterNameExists((int)$gdlObjectId, (string)$gdlName)) {
				$this->db->rollBack();
				return $this->jsonResponse($response, ['success' => false, 'error' => 'Parameter with this name already exists for the object.'], 409);
			}

			// Insert new parameter
			$stmt = $this->db->prepare("
				INSERT INTO parameters (
					gdl_object_id, gdl_name, gdl_type, type_color, default_value_json, 
					is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique, 
					array_type, array_first_dim, array_second_dim, 
					ui_page, is_ui_element, sort_order
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			");
			
			// Get type color if available
			$typeColorStmt = $this->db->prepare("SELECT color FROM parameter_type_colors WHERE gdl_type = ?");
			$typeColorStmt->execute([$gdlType]);
			$typeColor = $typeColorStmt->fetchColumn() ?: null;

			$stmt->execute([
				$gdlObjectId,
				$gdlName,
				$gdlType,
				$typeColor,
				$data['default_value_json'] ?? null,
				(int)($data['is_fix_name'] ?? false),
				(int)($data['flag_bold'] ?? false),
				(int)($data['flag_child'] ?? false),
				(int)($data['flag_hidden'] ?? false),
				(int)($data['flag_unique'] ?? false),
				$data['array_type'] ?? 'None',
				(int)($data['array_first_dim'] ?? 0),
				(int)($data['array_second_dim'] ?? 0),
				(int)($data['ui_page'] ?? 0),
				(int)($data['is_ui_element'] ?? false),
				$newSortOrder
			]);

			$parameterId = $this->db->lastInsertId();

			// Insert translations
			$translations = $data['translations'] ?? [];
			if (empty($translations)) {
				$translations = [
					['language_code' => 'de', 'description' => $gdlName],
					['language_code' => 'en', 'description' => $gdlName]
				];
			}

			$stmtTrans = $this->db->prepare("
				INSERT INTO parameter_translations (param_id, language_code, description, values_list, ui_tooltip)
				VALUES (?, ?, ?, ?, ?)
			");

			foreach ($translations as $trans) {
				$stmtTrans->execute([
					$parameterId,
					$trans['language_code'],
					$trans['description'] ?? '',
					$trans['values_list'] ?? null,
					$trans['ui_tooltip'] ?? null
				]);
			}

			$this->db->commit();

			return $this->jsonResponse($response, [
				'success' => true,
				'message' => 'Parameter inserted successfully.',
				'parameterId' => $parameterId
			], 201);

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error inserting parameter: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Get all parameter type colors
	 */
	public function getTypeColors(Request $request, Response $response): Response
	{
		try {
			$stmt = $this->db->query("SELECT gdl_type, color FROM parameter_type_colors ORDER BY gdl_type");
			$colors = $stmt->fetchAll(PDO::FETCH_ASSOC);

			$colorMap = [];
			foreach ($colors as $row) {
				$colorMap[$row['gdl_type']] = $row['color'];
			}

			return $this->jsonResponse($response, [
				'success' => true,
				'data' => $colorMap
			]);

		} catch (\PDOException $e) {
			error_log("DB Error fetching type colors: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Update parameter type color
	 */
	public function updateTypeColor(Request $request, Response $response, array $args): Response
	{
		$type = $args['type'] ?? null;

		if (!$type) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Type is required.'], 400);
		}

		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		$color = $data['color'] ?? null;

		if (!$color) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Color is required.'], 400);
		}

		try {
			$stmt = $this->db->prepare("
				INSERT INTO parameter_type_colors (gdl_type, color) 
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE color = ?
			");
			$stmt->execute([$type, $color, $color]);

			// Update existing parameters with this type
			$stmt = $this->db->prepare("UPDATE parameters SET type_color = ? WHERE gdl_type = ?");
			$stmt->execute([$color, $type]);

			return $this->jsonResponse($response, [
				'success' => true,
				'message' => 'Type color updated successfully.'
			]);

		} catch (\PDOException $e) {
			error_log("DB Error updating type color: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
	
	/**
	 * Export parameters as XML
	 */
public function exportXml(Request $request, Response $response, array $args): Response
	 {
		 $objectId = $args['objectId'] ?? null; // GEÄNDERT
	 
		 if (!$objectId) {
			 return $this->jsonResponse($response, ['error' => 'Object ID is required.'], 400);
		 }
	 
		 try {
			 // Get object name
			 $stmt = $this->db->prepare("SELECT name FROM gdl_objects WHERE id = ?");
			 $stmt->execute([$objectId]);
			 $objectName = $stmt->fetchColumn();
	 
			 // Get parameters
			 $stmt = $this->db->prepare("
				 SELECT p.*, pt.language_code, pt.description
				 FROM parameters p
				 LEFT JOIN parameter_translations pt ON p.id = pt.param_id AND pt.language_code = 'de'
				 WHERE p.gdl_object_id = ?
				 ORDER BY p.sort_order ASC
			 ");
			 $stmt->execute([$objectId]);
			 $parameters = $stmt->fetchAll(PDO::FETCH_ASSOC);
	 
			 // Build XML
			 $xml = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><ParamSection></ParamSection>');
			 
			 // Add ParamSectHeader
			 $header = $xml->addChild('ParamSectHeader');
			 $header->addChild('AutoHotspots', 'false');
			 $statBits = $header->addChild('StatBits');
			 $statBits->addChild('STBit_FixSize');
			 $header->addChild('WDLeftFrame', '0');
			 $header->addChild('WDRightFrame', '0');
			 $header->addChild('WDTopFrame', '0');
			 $header->addChild('WDBotFrame', '0');
			 $header->addChild('LayFlags', '65535');
			 $header->addChild('WDMirrorThickness', '0');
			 $header->addChild('WDWallInset', '0');
	 
			 // Add Parameters section
			 $paramsSection = $xml->addChild('Parameters');
			 $paramsSection->addAttribute('SectVersion', '27');
			 $paramsSection->addAttribute('SectionFlags', '0');
			 $paramsSection->addAttribute('SubIdent', '0');
	 
			 foreach ($parameters as $param) {
				 $paramNode = $paramsSection->addChild($param['gdl_type']);
				 $paramNode->addAttribute('Name', $param['gdl_name']);
	 
				 // Description
				 if (!empty($param['description'])) {
					 $descNode = $paramNode->addChild('Description');
					 $dom = dom_import_simplexml($descNode);
					 $dom->appendChild($dom->ownerDocument->createCDATASection($param['description']));
				 }
	 
				 // Fix flag
				 if ($param['is_fix_name']) {
					 $paramNode->addChild('Fix');
				 }
	 
				 // Other flags
				 if ($param['flag_bold'] || $param['flag_child'] || $param['flag_hidden'] || $param['flag_unique']) {
					 $flagsNode = $paramNode->addChild('Flags');
					 if ($param['flag_bold']) $flagsNode->addChild('ParFlg_BoldName');
					 if ($param['flag_child']) $flagsNode->addChild('ParFlg_Child');
					 if ($param['flag_hidden']) $flagsNode->addChild('ParFlg_Hidden');
					 if ($param['flag_unique']) $flagsNode->addChild('ParFlg_Unique');
				 }
	 
				 // Value - IMMER hinzufügen außer bei Separator/Title
				 if (!in_array($param['gdl_type'], ['Separator', 'Title'])) {
					 if (!empty($param['default_value_json'])) {
						 // Versuche JSON zu parsen
						 $decodedValue = json_decode($param['default_value_json']);
						 
						 if (json_last_error() === JSON_ERROR_NONE && is_object($decodedValue)) {
							 // Dictionary - rekursiv aufbauen
							 // TODO: Implementiere Dictionary-Export
							 $valueNode = $paramNode->addChild('Value', '');
						 } elseif (json_last_error() === JSON_ERROR_NONE && is_array($decodedValue)) {
							 // Array - wird weiter unten mit ArrayValues behandelt
							 // Kein Value-Tag für Arrays
						 } else {
							 // Einfacher Wert
							 $valueNode = $paramNode->addChild('Value');
							 $valueNode[0] = $param['default_value_json'];
						 }
					 } else {
						 // Kein Wert vorhanden - leeres Value-Tag hinzufügen
						 $paramNode->addChild('Value', '');
					 }
				 }
	 
				 // Array handling (simplified)
				 if ($param['array_type'] !== 'None' && ($param['array_first_dim'] > 0)) {
					 $arrayNode = $paramNode->addChild('ArrayValues');
					 $arrayNode->addAttribute('FirstDimension', $param['array_first_dim']);
					 $arrayNode->addAttribute('SecondDimension', $param['array_second_dim']);
					 
					 // If we have array data in default_value_json, parse and add
					 if (!empty($param['default_value_json'])) {
						 $arrayData = json_decode($param['default_value_json'], true);
						 if (is_array($arrayData)) {
							 foreach ($arrayData as $index => $value) {
								 $aValNode = $arrayNode->addChild('AVal', $value);
								 if ($param['array_type'] === '2D') {
									 // TODO: Add Row/Column attributes for 2D arrays
								 } else {
									 $aValNode->addAttribute('Row', $index + 1);
								 }
							 }
						 }
					 }
				 }
			 }
	 
			 // Format XML nicely
			 $dom = new \DOMDocument('1.0', 'UTF-8');
			 $dom->preserveWhiteSpace = false;
			 $dom->formatOutput = true;
			 $dom->loadXML($xml->asXML());
			 $xmlString = $dom->saveXML();
	 
			 $response->getBody()->write($xmlString);
			 return $response
				 ->withHeader('Content-Type', 'application/xml')
				 ->withHeader('Content-Disposition', 'attachment; filename="' . str_replace('.gsm', '', $objectName) . '_parameters.xml"');
	 
		 } catch (\Exception $e) {
			 error_log("Error exporting XML: " . $e->getMessage());
			 return $this->jsonResponse($response, ['error' => 'Failed to export XML: ' . $e->getMessage()], 500);
		 }
	 }

	
	
	
}

// Helper function to convert SimpleXMLElement to array (for Dictionary)
function simplexml_to_array(\SimpleXMLElement $xml): array
{
	$array = [];
	foreach ($xml->children() as $node) {
		$name = $node->getName();
		if ($node->children()->count() > 0) {
			$array[$name] = simplexml_to_array($node);
		} else {
			$array[$name] = (string)$node;
		}
	}
	return $array;
}
