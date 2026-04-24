<?php
namespace App\Controllers;

use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use \PDO;

class ProjectController
{
	protected PDO $db;

	public function __construct(PDO $db)
	{
		$this->db = $db;
	}

	public function getAllProjects(Request $request, Response $response): Response
	{
		try {
			$stmt = $this->db->query("
				SELECT p.*, 
					   COUNT(g.id) as object_count
				FROM projects p
				LEFT JOIN gdl_objects g ON p.id = g.project_id
				GROUP BY p.id
				ORDER BY p.updated_at DESC
			");
			$projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

			return ResponseHelper::success($response, $projects);

		} catch (\PDOException $e) {
			error_log("DB Error fetching projects: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	public function getProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return ResponseHelper::error($response, 'Project ID is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("
				SELECT p.*, 
					   COUNT(g.id) as object_count
				FROM projects p
				LEFT JOIN gdl_objects g ON p.id = g.project_id
				WHERE p.id = ?
				GROUP BY p.id
			");
			$stmt->execute([$projectId]);
			$project = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$project) {
				return ResponseHelper::error($response, 'Project not found.', 404);
			}

			return ResponseHelper::success($response, $project);

		} catch (\PDOException $e) {
			error_log("DB Error fetching project: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	public function createProject(Request $request, Response $response): Response
	{
		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		$projectName = $data['name'] ?? null;
		$description = $data['description'] ?? null;
		$status = $data['status'] ?? 'active';
		$folderPath = $data['folder_path'] ?? null;

		if (empty($projectName)) {
			return ResponseHelper::error($response, 'Project name is required.', 400);
		}

		try {
			// Check if project exists
			$stmt = $this->db->prepare("SELECT id FROM projects WHERE name = ?");
			$stmt->execute([$projectName]);
			$existingProject = $stmt->fetch(PDO::FETCH_ASSOC);

			if ($existingProject) {
				return ResponseHelper::error($response, 'Project with this name already exists.', 409);
			}

			// Create new project
			$stmt = $this->db->prepare("
				INSERT INTO projects (name, description, status, folder_path) 
				VALUES (?, ?, ?, ?)
			");
			$stmt->execute([$projectName, $description, $status, $folderPath]);
			$projectId = $this->db->lastInsertId();

			return ResponseHelper::success(
				$response, 
				['id' => $projectId, 'name' => $projectName],
				'Project created successfully.',
				201
			);

		} catch (\PDOException $e) {
			error_log("DB Error creating project: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	public function updateProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return ResponseHelper::error($response, 'Project ID is required.', 400);
		}

		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		$projectName = $data['name'] ?? null;
		$description = $data['description'] ?? null;
		$status = $data['status'] ?? null;
		$folderPath = $data['folder_path'] ?? null;

		if (empty($projectName)) {
			return ResponseHelper::error($response, 'Project name is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("
				UPDATE projects 
				SET name = ?, description = ?, status = ?, folder_path = ?, updated_at = CURRENT_TIMESTAMP 
				WHERE id = ?
			");
			$stmt->execute([$projectName, $description, $status, $folderPath, $projectId]);

			if ($stmt->rowCount() === 0) {
				return ResponseHelper::error($response, 'Project not found.', 404);
			}

			return ResponseHelper::success($response, null, 'Project updated successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error updating project: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	public function deleteProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return ResponseHelper::error($response, 'Project ID is required.', 400);
		}

		try {
			$stmt = $this->db->prepare("DELETE FROM projects WHERE id = ?");
			$stmt->execute([$projectId]);

			if ($stmt->rowCount() === 0) {
				return ResponseHelper::error($response, 'Project not found.', 404);
			}

			return ResponseHelper::success($response, null, 'Project deleted successfully.');

		} catch (\PDOException $e) {
			error_log("DB Error deleting project: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}

	public function duplicateProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return ResponseHelper::error($response, 'Project ID is required.', 400);
		}

		try {
			$this->db->beginTransaction();

			// Get original project
			$stmt = $this->db->prepare("SELECT * FROM projects WHERE id = ?");
			$stmt->execute([$projectId]);
			$project = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$project) {
				$this->db->rollBack();
				return ResponseHelper::error($response, 'Project not found.', 404);
			}

			// Create new project with "Copy" suffix
			$newName = $project['name'] . ' (Kopie)';
			$counter = 1;
			
			// Check for name conflicts
			while (true) {
				$stmt = $this->db->prepare("SELECT id FROM projects WHERE name = ?");
				$stmt->execute([$newName]);
				if (!$stmt->fetch()) break;
				$counter++;
				$newName = $project['name'] . ' (Kopie ' . $counter . ')';
			}

			// Insert new project
			$stmt = $this->db->prepare("
				INSERT INTO projects (name, description, status, folder_path) 
				VALUES (?, ?, ?, ?)
			");
			$stmt->execute([
				$newName,
				$project['description'],
				$project['status'],
				$project['folder_path']
			]);
			$newProjectId = $this->db->lastInsertId();

			// Duplicate all GDL objects
			$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE project_id = ?");
			$stmt->execute([$projectId]);
			$objects = $stmt->fetchAll(PDO::FETCH_ASSOC);

			foreach ($objects as $object) {
				$stmt = $this->db->prepare("
					INSERT INTO gdl_objects (project_id, name, description, status, file_path) 
					VALUES (?, ?, ?, ?, ?)
				");
				$stmt->execute([
					$newProjectId,
					$object['name'],
					$object['description'],
					$object['status'],
					$object['file_path']
				]);
				$newObjectId = $this->db->lastInsertId();

				// Duplicate all parameters for this object
				$stmt = $this->db->prepare("SELECT * FROM parameters WHERE gdl_object_id = ?");
				$stmt->execute([$object['id']]);
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
			}

			$this->db->commit();

			return ResponseHelper::success(
				$response,
				['id' => $newProjectId, 'name' => $newName],
				'Project duplicated successfully.',
				201
			);

		} catch (\PDOException $e) {
			$this->db->rollBack();
			error_log("DB Error duplicating project: " . $e->getMessage());
			return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
		}
	}
}
