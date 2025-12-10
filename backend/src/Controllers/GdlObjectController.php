<?php
namespace App\Controllers;

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

	private function jsonResponse(Response $response, array $data, int $status = 200): Response
	{
		$response->getBody()->write(json_encode($data));
		return $response
			->withHeader('Content-Type', 'application/json')
			->withStatus($status);
	}

	/**
	 * Get all GDL objects for a project
	 */
	public function getObjectsByProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Project ID is required.'], 400);
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

			return $this->jsonResponse($response, ['success' => true, 'data' => $objects]);

		} catch (\PDOException $e) {
			error_log("DB Error fetching GDL objects: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Get a single GDL object
	 */
	public function getObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Object ID is required.'], 400);
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
				return $this->jsonResponse($response, ['success' => false, 'error' => 'GDL object not found.'], 404);
			}

			return $this->jsonResponse($response, ['success' => true, 'data' => $object]);

		} catch (\PDOException $e) {
			error_log("DB Error fetching GDL object: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
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
			return $this->jsonResponse($response, ['success' => false, 'error' => 'project_id and name are required.'], 400);
		}

		try {
			// Check if object with this name already exists in project
			$stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE project_id = ? AND name = ?");
			$stmt->execute([$projectId, $objectName]);
			$existingObject = $stmt->fetch(PDO::FETCH_ASSOC);

			if ($existingObject) {
				return $this->jsonResponse($response, [
					'success' => false,
					'error' => 'GDL object with this name already exists in project.',
					'existingObjectId' => $existingObject['id']
				], 409);
			}

			// Create new object
			$stmt = $this->db->prepare("
				INSERT INTO gdl_objects (project_id, name, description, status, file_path) 
				VALUES (?, ?, ?, ?, ?)
			");
			$stmt->execute([$projectId, $objectName, $description, $status, $filePath]);
			$objectId = $this->db->lastInsertId();

			return $this->jsonResponse($response, [
				'success' => true,
				'message' => 'GDL object created successfully.',
				'data' => [
					'id' => $objectId,
					'name' => $objectName
				]
			], 201);

		} catch (\PDOException $e) {
			error_log("DB Error creating GDL object: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Update GDL object
	 */
	public function updateObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Object ID is required.'], 400);
		}

		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		try {
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

			if (empty($updateFields)) {
				return $this->jsonResponse($response, ['success' => false, 'error' => 'No fields to update.'], 400);
			}

			$updateValues[] = $objectId;
			$sql = "UPDATE gdl_objects SET " . implode(', ', $updateFields) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?";
			$stmt = $this->db->prepare($sql);
			$stmt->execute($updateValues);

			if ($stmt->rowCount() === 0) {
				return $this->jsonResponse($response, ['success' => false, 'error' => 'GDL object not found.'], 404);
			}

			return $this->jsonResponse($response, ['success' => true, 'message' => 'GDL object updated successfully.']);

		} catch (\PDOException $e) {
			error_log("DB Error updating GDL object: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Delete GDL object
	 */
	public function deleteObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Object ID is required.'], 400);
		}

		try {
			$stmt = $this->db->prepare("DELETE FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);

			if ($stmt->rowCount() === 0) {
				return $this->jsonResponse($response, ['success' => false, 'error' => 'GDL object not found.'], 404);
			}

			return $this->jsonResponse($response, ['success' => true, 'message' => 'GDL object deleted successfully.']);

		} catch (\PDOException $e) {
			error_log("DB Error deleting GDL object: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Duplicate GDL object with all parameters
	 */
	public function duplicateObject(Request $request, Response $response, array $args): Response
	{
		$objectId = $args['objectId'] ?? null;

		if (!$objectId) {
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Object ID is required.'], 400);
		}

		try {
			$this->db->beginTransaction();

			// Get original object
			$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE id = ?");
			$stmt->execute([$objectId]);
			$object = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$object) {
				$this->db->rollBack();
				return $this->jsonResponse($response, ['success' => false, 'error' => 'GDL object not found.'], 404);
			}

			// Create new object name with "Copy" suffix
			$newName = $object['name'] . ' (Kopie)';
			$counter = 1;
			
			// Check for name conflicts
			while (true) {
				$stmt = $this->db->prepare("SELECT id FROM gdl_objects WHERE project_id = ? AND name = ?");
				$stmt->execute([$object['project_id'], $newName]);
				if (!$stmt->fetch()) break;
				$counter++;
				$newName = $object['name'] . ' (Kopie ' . $counter . ')';
			}

			// Insert new object
			$stmt = $this->db->prepare("
				INSERT INTO gdl_objects (project_id, name, description, status, file_path) 
				VALUES (?, ?, ?, ?, ?)
			");
			$stmt->execute([
				$object['project_id'],
				$newName,
				$object['description'],
				$object['status'],
				$object['file_path']
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

			return $this->jsonResponse($response, [
				'success' => true,
				'message' => 'GDL object duplicated successfully.',
				'data' => [
					'id' => $newObjectId,
					'name' => $newName
				]
			], 201);

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error duplicating GDL object: " . $e->getMessage());
			return $this->jsonResponse($response, ['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
}

