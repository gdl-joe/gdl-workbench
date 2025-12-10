<?php
namespace App\Controllers;

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

	// Helper function to return JSON responses
	private function jsonResponse(Response $response, array $data, int $status = 200): Response
	{
		$response->getBody()->write(json_encode($data));
		return $response
			->withHeader('Content-Type', 'application/json')
			->withStatus($status);
	}

	/**
	 * Get all projects
	 */
	public function getAllProjects(Request $request, Response $response): Response
	{
		try {
			$stmt = $this->db->query("
				SELECT p.*, 
					   COUNT(pm.id) as parameter_count
				FROM projects p
				LEFT JOIN parameters pm ON p.id = pm.project_id
				GROUP BY p.id
				ORDER BY p.updated_at DESC
			");
			$projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

			return $this->jsonResponse($response, ['projects' => $projects]);

		} catch (\PDOException $e) {
			error_log("DB Error fetching projects: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Get a single project
	 */
	public function getProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return $this->jsonResponse($response, ['error' => 'Project ID is required.'], 400);
		}

		try {
			$stmt = $this->db->prepare("
				SELECT p.*, 
					   COUNT(pm.id) as parameter_count
				FROM projects p
				LEFT JOIN parameters pm ON p.id = pm.project_id
				WHERE p.id = ?
				GROUP BY p.id
			");
			$stmt->execute([$projectId]);
			$project = $stmt->fetch(PDO::FETCH_ASSOC);

			if (!$project) {
				return $this->jsonResponse($response, ['error' => 'Project not found.'], 404);
			}

			return $this->jsonResponse($response, ['project' => $project]);

		} catch (\PDOException $e) {
			error_log("DB Error fetching project: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Create a new project
	 */
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

		if (empty($projectName)) {
			return $this->jsonResponse($response, ['error' => 'Project name is required.'], 400);
		}

		try {
			// Check if project with this name already exists
			$stmt = $this->db->prepare("SELECT id FROM projects WHERE name = ?");
			$stmt->execute([$projectName]);
			$existingProject = $stmt->fetch(PDO::FETCH_ASSOC);

			if ($existingProject) {
				return $this->jsonResponse($response, [
					'error' => 'Project with this name already exists.',
					'existingProjectId' => $existingProject['id']
				], 409);
			}

			// Create new project
			$stmt = $this->db->prepare("INSERT INTO projects (name) VALUES (?)");
			$stmt->execute([$projectName]);
			$projectId = $this->db->lastInsertId();

			return $this->jsonResponse($response, [
				'message' => 'Project created successfully.',
				'projectId' => $projectId,
				'projectName' => $projectName
			], 201);

		} catch (\PDOException $e) {
			error_log("DB Error creating project: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Update project
	 */
	public function updateProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return $this->jsonResponse($response, ['error' => 'Project ID is required.'], 400);
		}

		$contentType = $request->getHeaderLine('Content-Type');
		
		if (strpos($contentType, 'application/json') !== false) {
			$body = $request->getBody()->getContents();
			$data = json_decode($body, true);
		} else {
			$data = $request->getParsedBody();
		}

		$projectName = $data['name'] ?? null;

		if (empty($projectName)) {
			return $this->jsonResponse($response, ['error' => 'Project name is required.'], 400);
		}

		try {
			$stmt = $this->db->prepare("UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
			$stmt->execute([$projectName, $projectId]);

			if ($stmt->rowCount() === 0) {
				return $this->jsonResponse($response, ['error' => 'Project not found.'], 404);
			}

			return $this->jsonResponse($response, ['message' => 'Project updated successfully.']);

		} catch (\PDOException $e) {
			error_log("DB Error updating project: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}

	/**
	 * Delete project
	 */
	public function deleteProject(Request $request, Response $response, array $args): Response
	{
		$projectId = $args['projectId'] ?? null;

		if (!$projectId) {
			return $this->jsonResponse($response, ['error' => 'Project ID is required.'], 400);
		}

		try {
			$stmt = $this->db->prepare("DELETE FROM projects WHERE id = ?");
			$stmt->execute([$projectId]);

			if ($stmt->rowCount() === 0) {
				return $this->jsonResponse($response, ['error' => 'Project not found.'], 404);
			}

			return $this->jsonResponse($response, ['message' => 'Project deleted successfully.']);

		} catch (\PDOException $e) {
			error_log("DB Error deleting project: " . $e->getMessage());
			return $this->jsonResponse($response, ['error' => 'Database error: ' . $e->getMessage()], 500);
		}
	}
}
