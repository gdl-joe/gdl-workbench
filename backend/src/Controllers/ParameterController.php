<?php
namespace App\Controllers;

use App\Helpers\ResponseHelper;
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
		return ((int) $stmt->fetchColumn()) > 0;
	}

	public function importXml(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');

		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);

			if (json_last_error() !== JSON_ERROR_NONE) {
				error_log("JSON Parse Error: " . json_last_error_msg());
				return ResponseHelper::error($response, 'Invalid JSON: ' . json_last_error_msg(), 400);
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
			return ResponseHelper::error($response, 'No XML content provided.', 400);
		}

		// If gdl_object_id is provided, use it directly
		if ($gdlObjectId) {
			// Use existing object
		} elseif (!$projectId || !$objectName) {
			return ResponseHelper::error($response, 'gdl_object_id OR (project_id and object_name) are required.', 400);
		}

		// Parse XML first and validate duplicates in the XML
		libxml_use_internal_errors(true);
		$xml = simplexml_load_string($xmlContent);
		if ($xml === false) {
			$xmlErrors = libxml_get_errors();
			$errorMessages = array_map(fn($error) => trim($error->message), $xmlErrors);
			libxml_clear_errors();
			return ResponseHelper::error($response, 'Invalid XML format: ' . implode(', ', $errorMessages), 400);
		}

		if (!isset($xml->Parameters)) {
			return ResponseHelper::error($response, 'XML is missing the <Parameters> root element.', 400);
		}

		// Validate duplicate parameter names inside the XML (case-insensitive)
		$seenNames = [];
		$duplicates = [];
		foreach ($xml->Parameters->children() as $gdlParameter) {
			$gdlName = trim((string) $gdlParameter['Name']);
			$key = mb_strtolower($gdlName);
			if ($key === '')
				continue;
			if (isset($seenNames[$key])) {
				$duplicates[] = $gdlName;
			} else {
				$seenNames[$key] = true;
			}
		}
		if (!empty($duplicates)) {
			$uniqueDup = array_values(array_unique($duplicates));
			return ResponseHelper::error($response, 'Duplicate parameter names found in XML: ' . implode(', ', $uniqueDup), 400);
		}

		try {
			$this->db->beginTransaction();

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
				$gdlName = (string) $gdlParameter['Name'];
				$gdlType = $gdlParameter->getName();

				$description = '';
				if (isset($gdlParameter->Description)) {
					$description = (string) $gdlParameter->Description;
				}

				// WICHTIG: Value korrekt extrahieren als gültiges JSON
				$defaultValue = null;
				if (isset($gdlParameter->Value)) {
					if ($gdlType === 'Dictionary') {
						$defaultValue = json_encode(simplexml_to_array($gdlParameter->Value));
					} else {
						// CDATA und normale Values behandeln
						$valueNode = $gdlParameter->Value;
						$rawValue = trim((string) $valueNode);

						// Entferne führende Semikolons und Anführungszeichen (GDL-Konvention)
						$rawValue = preg_replace('/^[";]+|[";]+$/', '', $rawValue);

						// Nur setzen wenn nicht leer, sonst NULL lassen
						if ($rawValue !== '') {
							// Als gültiges JSON speichern
							// Zahlen als Zahlen, Rest als String
							if (is_numeric($rawValue)) {
								$defaultValue = json_encode((float) $rawValue);
							} else {
								$defaultValue = json_encode($rawValue);
							}
						}
					}
				} elseif (isset($gdlParameter->ArrayValues)) {
					$firstDim = (int) $gdlParameter->ArrayValues['FirstDimension'];
					$secondDim = (int) $gdlParameter->ArrayValues['SecondDimension'];
					$arrayValues = [];

					$isString = in_array(strtoupper($gdlType), ['STRING', 'TEXT']);
					$defaultValue = $isString ? '""' : '0';

					if ($secondDim > 0) {
						// 2D Array
						for ($r = 0; $r < $firstDim; $r++) {
							$arrayValues[$r] = array_fill(0, $secondDim, $defaultValue);
						}
						foreach ($gdlParameter->ArrayValues->AVal as $aVal) {
							$rowIdx = (int) $aVal['Row'] - 1;
							$colIdx = (int) $aVal['Column'] - 1;
							$val = trim((string) $aVal);

							// Remove GDL quotes if present
							if ($isString) {
								$val = preg_replace('/^"|"$/', '', $val);
							} else {
								$val = preg_replace('/^[";]+|[";]+$/', '', $val);
							}

							if ($rowIdx >= 0 && $rowIdx < $firstDim && $colIdx >= 0 && $colIdx < $secondDim) {
								$arrayValues[$rowIdx][$colIdx] = $val;
							}
						}
					} else {
						// 1D Array
						$arrayValues = array_fill(0, $firstDim, $defaultValue);
						foreach ($gdlParameter->ArrayValues->AVal as $aVal) {
							$rowIdx = (int) $aVal['Row'] - 1;
							$val = trim((string) $aVal);

							// Remove GDL quotes if present
							if ($isString) {
								$val = preg_replace('/^"|"$/', '', $val);
							} else {
								$val = preg_replace('/^[";]+|[";]+$/', '', $val);
							}

							if ($rowIdx >= 0 && $rowIdx < $firstDim) {
								$arrayValues[$rowIdx] = $val;
							}
						}
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
							case 'ParFlg_BoldName':
								$flagBold = true;
								break;
							case 'ParFlg_Child':
								$flagChild = true;
								break;
							case 'ParFlg_Hidden':
								$flagHidden = true;
								break;
							case 'ParFlg_Unique':
								$flagUnique = true;
								break;
						}
					}
				}

				$arrayType = 'None';
				$firstDim = 0;
				$secondDim = 0;
				if (isset($gdlParameter->ArrayValues)) {
					$arrayType = ((int) $gdlParameter->ArrayValues['SecondDimension'] > 0) ? '2D' : '1D';
					$firstDim = (int) $gdlParameter->ArrayValues['FirstDimension'];
					$secondDim = (int) $gdlParameter->ArrayValues['SecondDimension'];
				}

				// Insert parameter
				$stmt = $this->db->prepare("
					INSERT INTO parameters (gdl_object_id, gdl_name, gdl_type, default_value_json, is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique, array_type, array_first_dim, array_second_dim, sort_order)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				");
				$stmt->execute([
					$gdlObjectId,
					$gdlName,
					$gdlType,
					$defaultValue,
					(int) $isFixName,
					(int) $flagBold,
					(int) $flagChild,
					(int) $flagHidden,
					(int) $flagUnique,
					$arrayType,
					$firstDim,
					$secondDim,
					$sortOrder
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

			return ResponseHelper::success($response, [
				'imported_count' => $sortOrder,
				'gdlObjectId' => $gdlObjectId,
				'objectName' => $objectName
			], 'Parameters imported successfully.');

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error during XML Import: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error during import: ' . $e->getMessage(), 500);
		} catch (\Exception $e) {
			$this->db->rollBack();
			error_log("XML Import Error: " . $e->getMessage());
			return ResponseHelper::error($response, 'Failed to import parameters: ' . $e->getMessage(), 500);
		}
	}

	public function getObjectParameters(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
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
						'is_fix_name' => (bool) $row['is_fix_name'],
						'flag_bold' => (bool) $row['flag_bold'],
						'flag_child' => (bool) $row['flag_child'],
						'flag_hidden' => (bool) $row['flag_hidden'],
						'flag_unique' => (bool) $row['flag_unique'],
						'ui_page' => $row['ui_page'],
						'is_ui_element' => (bool) $row['is_ui_element'],
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

			// Return flat structure for compatibility
			$payload = [
				'success' => true,
				'data' => array_values($parameters),
				'object_name' => $objectName
			];

			$response->getBody()->write(json_encode($payload));
			return $response
				->withHeader('Content-Type', 'application/json')
				->withStatus(200);

		} catch (\Exception $e) {
			error_log("Error fetching parameters: " . $e->getMessage());
			return ResponseHelper::error($response, 'Failed to fetch parameters: ' . $e->getMessage(), 500);
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

		$gdlObjectId = $data['gdl_object_id'] ?? null;
		$gdlName = $data['gdl_name'] ?? null;
		$gdlType = $data['gdl_type'] ?? 'String';
		$insertAfterParamId = $data['insert_after_param_id'] ?? null;

		if (!$gdlObjectId || !$gdlName) {
			return ResponseHelper::error($response, 'gdl_object_id and gdl_name are required.', 400);
		}

		try {
			$this->db->beginTransaction();

			// Determine sort_order
			if ($insertAfterParamId) {
				$stmt = $this->db->prepare("SELECT sort_order FROM parameters WHERE id = ?");
				$stmt->execute([$insertAfterParamId]);
				$afterSortOrder = $stmt->fetchColumn();

				if ($afterSortOrder !== false) {
					$stmt = $this->db->prepare("UPDATE parameters SET sort_order = sort_order + 1 WHERE gdl_object_id = ? AND sort_order > ?");
					$stmt->execute([$gdlObjectId, $afterSortOrder]);
					$newSortOrder = $afterSortOrder + 1;
				} else {
					$stmt = $this->db->prepare("SELECT MAX(sort_order) as max_order FROM parameters WHERE gdl_object_id = ?");
					$stmt->execute([$gdlObjectId]);
					$newSortOrder = ($stmt->fetchColumn() ?: 0) + 1;
				}
			} else {
				$stmt = $this->db->prepare("SELECT MAX(sort_order) as max_order FROM parameters WHERE gdl_object_id = ?");
				$stmt->execute([$gdlObjectId]);
				$newSortOrder = ($stmt->fetchColumn() ?: 0) + 1;
			}

			// Check for duplicate names
			if ($this->parameterNameExists((int) $gdlObjectId, (string) $gdlName)) {
				$this->db->rollBack();
				return ResponseHelper::error($response, 'Parameter with this name already exists for the object.', 409);
			}

			$stmt = $this->db->prepare("
				INSERT INTO parameters (
					gdl_object_id, gdl_name, gdl_type, default_value_json, ui_code,
					is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique, 
					array_type, array_first_dim, array_second_dim, 
					ui_page, is_ui_element, sort_order
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			");

			$defaultValue = $data['default_value_json'] ?? null;
			if (is_array($defaultValue) || is_object($defaultValue)) {
				$defaultValue = json_encode($defaultValue);
			}

			$uiCode = $data['ui_code'] ?? null;
			if (is_array($uiCode) || is_object($uiCode)) {
				$uiCode = json_encode($uiCode);
			}

			$stmt->execute([
				$gdlObjectId,
				$gdlName,
				$gdlType,
				$defaultValue,
				$uiCode,
				(int) ($data['is_fix_name'] ?? false),
				(int) ($data['flag_bold'] ?? false),
				(int) ($data['flag_child'] ?? false),
				(int) ($data['flag_hidden'] ?? false),
				(int) ($data['flag_unique'] ?? false),
				$data['array_type'] ?? 'None',
				(int) ($data['array_first_dim'] ?? 0),
				(int) ($data['array_second_dim'] ?? 0),
				(int) ($data['ui_page'] ?? 0),
				(int) ($data['is_ui_element'] ?? false),
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

			return ResponseHelper::success($response, [
				'parameterId' => $parameterId
			], 'Parameter created successfully.', 201);

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error creating parameter: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Update an existing parameter
	 */
	public function updateParameter(Request $request, Response $response, array $args): Response
	{
		$parameterId = $args['parameterId'] ?? null;

		if (!$parameterId) {
			return ResponseHelper::error($response, 'Parameter ID is required.', 400);
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

			// Check for duplicate name if changing
			if (array_key_exists('gdl_name', $data)) {
				$stmtObj = $this->db->prepare("SELECT gdl_object_id FROM parameters WHERE id = ?");
				$stmtObj->execute([$parameterId]);
				$gdlObjectId = $stmtObj->fetchColumn();

				if (!$gdlObjectId) {
					$this->db->rollBack();
					return ResponseHelper::error($response, 'Parameter not found.', 404);
				}

				if ($this->parameterNameExists((int) $gdlObjectId, (string) $data['gdl_name'], (int) $parameterId)) {
					$this->db->rollBack();
					return ResponseHelper::error($response, 'Another parameter with this name already exists for the object.', 409);
				}
			}

			// Build UPDATE query dynamically
			$updateFields = [];
			$updateValues = [];

			$allowedFields = [
				'gdl_name',
				'gdl_type',
				'function_group',
				'array_type',
				'array_first_dim',
				'array_second_dim',
				'default_value_json',
				'is_fix_name',
				'flag_bold',
				'flag_child',
				'flag_hidden',
				'flag_unique',
				'ui_page',
				'is_ui_element',
				'ui_code'
			];

			foreach ($allowedFields as $field) {
				if (array_key_exists($field, $data)) {
					$updateFields[] = "$field = ?";
					// Convert boolean fields to int
					if (strpos($field, 'flag_') === 0 || $field === 'is_fix_name' || $field === 'is_ui_element') {
						$updateValues[] = (int) $data[$field];
					} else {
						$val = $data[$field];
						// CRITICAL: JSON fields MUST ALWAYS be encoded as valid JSON for MySQL JSON column
						if ($field === 'default_value_json' || $field === 'ui_code') {
							// If value is already a string but not yet JSON-encoded, encode it
							if (!is_array($val) && !is_object($val)) {
								// Check if it's already valid JSON
								$decoded = json_decode($val);
								if (json_last_error() === JSON_ERROR_NONE) {
									// Already valid JSON, use as-is
									$val = $val;
								} else {
									// Not valid JSON, encode it
									$val = json_encode($val);
								}
							} else {
								// Array or object, encode it
								$val = json_encode($val);
							}
						}
						$updateValues[] = $val;
					}
				}
			}

			if (!empty($updateFields)) {
				$updateValues[] = $parameterId;
				$sql = "UPDATE parameters SET " . implode(', ', $updateFields) . " WHERE id = ?";
				error_log("UPDATE SQL: " . $sql);
				error_log("UPDATE VALUES: " . json_encode($updateValues));
				$stmt = $this->db->prepare($sql);
				$stmt->execute($updateValues);
				error_log("Rows affected: " . $stmt->rowCount());
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

			return ResponseHelper::success($response, null, 'Parameter updated successfully.');

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error updating parameter: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Delete a single parameter
	 */
	public function deleteParameter(Request $request, Response $response, array $args): Response
	{
		$parameterId = $args['parameterId'] ?? null;

		if (!$parameterId) {
			return ResponseHelper::error($response, 'Parameter ID is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("DELETE FROM parameters WHERE id = ?");
			$stmt->execute([$parameterId]);

			if ($stmt->rowCount() === 0) {
				return ResponseHelper::error($response, 'Parameter not found.', 404);
			}

			return ResponseHelper::success($response, null, 'Parameter deleted successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error deleting parameter: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
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
			return ResponseHelper::error($response, 'parameter_ids array is required.', 400);
		}

		try {
			$placeholders = str_repeat('?,', count($parameterIds) - 1) . '?';
			$stmt = $this->db->prepare("DELETE FROM parameters WHERE id IN ($placeholders)");
			$stmt->execute($parameterIds);

			return ResponseHelper::success($response, [
				'deleted_count' => $stmt->rowCount()
			], 'Parameters deleted successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error bulk deleting parameters: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
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
			return ResponseHelper::error($response, 'ordered_ids array is required.', 400);
		}

		try {
			$this->db->beginTransaction();

			$stmt = $this->db->prepare("UPDATE parameters SET sort_order = ? WHERE id = ?");

			foreach ($orderedIds as $index => $parameterId) {
				$stmt->execute([$index + 1, $parameterId]);
			}

			$this->db->commit();

			return ResponseHelper::success($response, null, 'Parameters reordered successfully.');

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error reordering parameters: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
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
		$insertPosition = $data['position'] ?? null;

		if (!$gdlObjectId || !$gdlName) {
			return ResponseHelper::error($response, 'gdl_object_id and gdl_name are required.', 400);
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
				$stmt = $this->db->prepare("SELECT MAX(sort_order) as max_order FROM parameters WHERE gdl_object_id = ?");
				$stmt->execute([$gdlObjectId]);
				$newSortOrder = ($stmt->fetchColumn() ?: 0) + 1;
			}

			// Check for duplicates
			if ($this->parameterNameExists((int) $gdlObjectId, (string) $gdlName)) {
				$this->db->rollBack();
				return ResponseHelper::error($response, 'Parameter with this name already exists for the object.', 409);
			}

			// Get type color if available
			$typeColorStmt = $this->db->prepare("SELECT color FROM parameter_type_colors WHERE gdl_type = ?");
			$typeColorStmt->execute([$gdlType]);
			$typeColor = $typeColorStmt->fetchColumn() ?: null;

			// Insert new parameter
			$stmt = $this->db->prepare("
				INSERT INTO parameters (
					gdl_object_id, gdl_name, gdl_type, type_color, default_value_json, 
					is_fix_name, flag_bold, flag_child, flag_hidden, flag_unique, 
					array_type, array_first_dim, array_second_dim, 
					ui_page, is_ui_element, sort_order
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			");

			$stmt->execute([
				$gdlObjectId,
				$gdlName,
				$gdlType,
				$typeColor,
				$data['default_value_json'] ?? null,
				(int) ($data['is_fix_name'] ?? false),
				(int) ($data['flag_bold'] ?? false),
				(int) ($data['flag_child'] ?? false),
				(int) ($data['flag_hidden'] ?? false),
				(int) ($data['flag_unique'] ?? false),
				$data['array_type'] ?? 'None',
				(int) ($data['array_first_dim'] ?? 0),
				(int) ($data['array_second_dim'] ?? 0),
				(int) ($data['ui_page'] ?? 0),
				(int) ($data['is_ui_element'] ?? false),
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

			return ResponseHelper::success($response, [
				'parameterId' => $parameterId
			], 'Parameter inserted successfully.', 201);

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error inserting parameter: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
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

			return ResponseHelper::success($response, $colorMap);

		} catch (\PDOException $e) {
			error_log("DB Error fetching type colors: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Update parameter type color
	 */
	public function updateTypeColor(Request $request, Response $response, array $args): Response
	{
		$type = $args['type'] ?? null;

		if (!$type) {
			return ResponseHelper::error($response, 'Type is required.', 400);
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
			return ResponseHelper::error($response, 'Color is required.', 400);
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

			return ResponseHelper::success($response, null, 'Type color updated successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error updating type color: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	/**
	 * Export parameters as XML
	 */
	public function exportXml(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return ResponseHelper::error($response, 'Object ID is required.', 400);
		}

		try {
			$xmlService = new \App\Services\GdlXmlService($this->db);
			$xmlString = $xmlService->generateParametersXml((int) $objectId);

			// Get object name for filename
			$stmt = $this->db->prepare("SELECT name FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);
			$objectName = $stmt->fetchColumn();

			$response->getBody()->write($xmlString);
			return $response
				->withHeader('Content-Type', 'application/xml')
				->withHeader('Content-Disposition', 'attachment; filename="' . str_replace('.gsm', '', $objectName) . '_parameters.xml"');

		} catch (\Exception $e) {
			error_log("Error exporting XML: " . $e->getMessage());
			return ResponseHelper::error($response, 'Failed to export XML: ' . $e->getMessage(), 500);
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
			$array[$name] = (string) $node;
		}
	}
	return $array;
}
