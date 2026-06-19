<?php
namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Helpers\ResponseHelper;

class SettingsController
{
    private string $settingsFile;

    public function __construct()
    {
        $this->settingsFile = __DIR__ . '/../../settings.json';
    }

    private function read(): array
    {
        if (file_exists($this->settingsFile)) {
            return json_decode(file_get_contents($this->settingsFile), true) ?? [];
        }
        return [];
    }

    private function write(array $data): void
    {
        file_put_contents($this->settingsFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    public function getSettings(Request $request, Response $response): Response
    {
        $settings = $this->read();
        // Fallback auf .env wenn settings.json leer
        if (empty($settings['workspace_root'])) {
            $settings['workspace_root'] = $_ENV['LOCAL_WORKSPACE_ROOT'] ?? '';
        }
        return ResponseHelper::success($response, $settings);
    }

    public function saveSettings(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        // JSON-Body manuell parsen falls Content-Type: application/json
        if (empty($body)) {
            $body = json_decode((string)$request->getBody(), true) ?? [];
        }
        $workspaceRoot = trim($body['workspace_root'] ?? '');

        if ($workspaceRoot === '') {
            return ResponseHelper::error($response, 'workspace_root darf nicht leer sein.', 400);
        }
        if (!is_dir($workspaceRoot)) {
            return ResponseHelper::error($response, "Verzeichnis nicht gefunden: $workspaceRoot", 400);
        }

        $settings = $this->read();
        $settings['workspace_root'] = $workspaceRoot;
        $this->write($settings);

        return ResponseHelper::success($response, $settings, 'Einstellungen gespeichert.');
    }
}
