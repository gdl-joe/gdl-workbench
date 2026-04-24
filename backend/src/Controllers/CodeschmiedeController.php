<?php
namespace App\Controllers;

use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use \PDO;

class CodeschmiedeController
{
    protected PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * GET /api/local/snippets[?command_id=...]
     * Returns all snippets, optionally filtered by command_id.
     */
    public function getSnippets(Request $request, Response $response): Response
    {
        $commandId = $request->getQueryParams()['command_id'] ?? null;

        try {
            if ($commandId) {
                $stmt = $this->db->prepare(
                    "SELECT id, command_id, name, params_json, created_at
                     FROM codeschmiede_snippets
                     WHERE command_id = ?
                     ORDER BY created_at DESC"
                );
                $stmt->execute([$commandId]);
            } else {
                $stmt = $this->db->query(
                    "SELECT id, command_id, name, params_json, created_at
                     FROM codeschmiede_snippets
                     ORDER BY command_id, created_at DESC"
                );
            }

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as &$row) {
                $row['params'] = json_decode($row['params_json'], true);
                unset($row['params_json']);
            }

            return ResponseHelper::success($response, $rows);

        } catch (\PDOException $e) {
            error_log("DB Error fetching snippets: " . $e->getMessage());
            return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/local/snippets
     * Body: { command_id, name, params }
     */
    public function createSnippet(Request $request, Response $response): Response
    {
        $body = $request->getBody()->getContents();
        $data = json_decode($body, true);

        $commandId = $data['command_id'] ?? null;
        $name      = trim($data['name'] ?? '');
        $params    = $data['params'] ?? null;

        if (!$commandId || $name === '' || $params === null) {
            return ResponseHelper::error($response, 'command_id, name and params are required.', 400);
        }

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO codeschmiede_snippets (command_id, name, params_json)
                 VALUES (?, ?, ?)"
            );
            $stmt->execute([$commandId, $name, json_encode($params)]);
            $id = $this->db->lastInsertId();

            return ResponseHelper::success($response, ['id' => (int)$id], 'Snippet saved.', 201);

        } catch (\PDOException $e) {
            error_log("DB Error creating snippet: " . $e->getMessage());
            return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * DELETE /api/local/snippets/{id}
     */
    public function deleteSnippet(Request $request, Response $response, array $args): Response
    {
        $id = $args['id'] ?? null;

        if (!$id) {
            return ResponseHelper::error($response, 'Snippet ID is required.', 400);
        }

        try {
            $stmt = $this->db->prepare("DELETE FROM codeschmiede_snippets WHERE id = ?");
            $stmt->execute([$id]);

            if ($stmt->rowCount() === 0) {
                return ResponseHelper::error($response, 'Snippet not found.', 404);
            }

            return ResponseHelper::success($response, null, 'Snippet deleted.');

        } catch (\PDOException $e) {
            error_log("DB Error deleting snippet: " . $e->getMessage());
            return ResponseHelper::error($response, 'Database error: ' . $e->getMessage(), 500);
        }
    }
}
