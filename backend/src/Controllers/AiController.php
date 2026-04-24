<?php
namespace App\Controllers;

use App\Helpers\ResponseHelper;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AiController
{
    private string $apiKey;
    private string $model;
    private string $systemPrompt;

    public function __construct()
    {
        // API Key aus Umgebungsvariable oder .env
        $this->apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? '';
        $this->model  = $_ENV['ANTHROPIC_MODEL'] ?? 'claude-3-haiku-20240307';

        // System-Prompt — von openbrep übernommen und für den Workbench angepasst
        $this->systemPrompt = $this->buildSystemPrompt();
    }

    /**
     * POST /api/local/ai/chat
     * Body: { messages: [{role, content}], context?: { scripts?, parameters? } }
     */
    public function chat(Request $request, Response $response): Response
    {
        if (empty($this->apiKey)) {
            return ResponseHelper::error($response, 'ANTHROPIC_API_KEY nicht konfiguriert. Bitte in .env eintragen.', 500);
        }

        $body = json_decode($request->getBody()->getContents(), true);
        $messages = $body['messages'] ?? [];
        $context  = $body['context'] ?? [];
        $model    = $body['model'] ?? $this->model;

        if (empty($messages)) {
            return ResponseHelper::error($response, 'messages darf nicht leer sein.', 400);
        }

        // Kontext (aktuelle Skripte, Parameter) in den System-Prompt einbauen
        $systemPrompt = $this->buildSystemPromptWithContext($context);

        // Nachrichten für die API vorbereiten
        $apiMessages = array_map(fn($m) => [
            'role'    => $m['role'] === 'user' ? 'user' : 'assistant',
            'content' => $m['content'],
        ], $messages);

        // Claude API aufrufen
        $result = $this->callClaude($systemPrompt, $apiMessages, $model);

        if (!$result['success']) {
            return ResponseHelper::error($response, $result['error'], 200);
        }

        return ResponseHelper::success($response, [
            'reply' => $result['content'],
            'model' => $this->model,
        ]);
    }

    /**
     * POST /api/local/ai/generate
     * Schnell-Endpunkt: Prompt → GDL generieren
     * Body: { prompt: string, scripts?: {}, parameters?: [] }
     */
    public function generate(Request $request, Response $response): Response
    {
        if (empty($this->apiKey)) {
            return ResponseHelper::error($response, 'ANTHROPIC_API_KEY nicht konfiguriert.', 500);
        }

        $body       = json_decode($request->getBody()->getContents(), true);
        $prompt     = trim($body['prompt'] ?? '');
        $context    = $body['context'] ?? [];

        if (empty($prompt)) {
            return ResponseHelper::error($response, 'prompt darf nicht leer sein.', 400);
        }

        $systemPrompt = $this->buildSystemPromptWithContext($context);

        $result = $this->callClaude($systemPrompt, [
            ['role' => 'user', 'content' => $prompt],
        ]);

        if (!$result['success']) {
            return ResponseHelper::error($response, $result['error'], 200);
        }

        return ResponseHelper::success($response, [
            'reply' => $result['content'],
            'model' => $this->model,
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────

    private function callClaude(string $systemPrompt, array $messages, string $model = ''): array
    {
        $payload = json_encode([
            'model'      => $model ?: $this->model,
            'max_tokens' => 4096,
            'system'     => $systemPrompt,
            'messages'   => $messages,
        ]);

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 90,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'x-api-key: ' . $this->apiKey,
                'anthropic-version: 2023-06-01',
            ],
        ]);

        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($err) {
            return ['success' => false, 'error' => 'cURL Fehler: ' . $err];
        }

        $data = json_decode($raw, true);

        if ($code === 401) {
            return ['success' => false, 'error' => 'API Key ungültig oder nicht gesetzt. Bitte ANTHROPIC_API_KEY in backend/.env eintragen.'];
        }
        if ($code !== 200) {
            $msg = $data['error']['message'] ?? $raw;
            return ['success' => false, 'error' => "Anthropic API Fehler ($code): $msg"];
        }

        $content = $data['content'][0]['text'] ?? '';
        return ['success' => true, 'content' => $content];
    }

    private function buildSystemPrompt(): string
    {
        return <<<'PROMPT'
Du bist ein erfahrener GDL-Ingenieur (Geometric Description Language) für ArchiCAD Bibliotheksobjekte.

## Deine Aufgaben
- GDL-Skripte erstellen, modifizieren und debuggen (3D, 2D, Master, Parameter, UI)
- Parameter definieren und in paramlist.xml-Format ausgeben
- Fehler analysieren und minimal korrigieren

## Namenskonventionen für Parameter
- `b` = Boolean (z.B. `bSunshade`)
- `i` = Integer (z.B. `iLouverCount`)
- `r` = Real/Length (z.B. `rLouverDepth`)
- `s` = String (z.B. `sFinishType`)
- `mat` = Material (z.B. `matFrame`)

## GDL-Coding-Regeln
1. Jedes `IF` braucht ein `ENDIF`, jedes `FOR` ein `NEXT`
2. Das 3D-Skript muss mit `END` abschließen
3. Das 2D-Skript muss `PROJECT2` enthalten
4. Kommentare mit `!` erklären die Logik
5. Maße immer in Metern (1200mm = 1.2)

## Antwortformat
- Wenn Du GDL-Code ausgibst: in einen Codeblock mit ```gdl einwickeln
- Wenn Du mehrere Skripte ausgibst: jeden Abschnitt mit einem Kommentar wie `! === 3D Script ===` beginnen
- Änderungen immer minimal halten — nicht unnötig umschreiben
PROMPT;
    }

    private function buildSystemPromptWithContext(array $context): string
    {
        $prompt = $this->buildSystemPrompt();

        // Aktuelle Skripte als Kontext anhängen
        $scripts = $context['scripts'] ?? [];
        if (!empty($scripts)) {
            $prompt .= "\n\n## Aktueller Objektzustand\n";
            foreach ($scripts as $name => $code) {
                if (!empty(trim($code))) {
                    $prompt .= "\n### $name\n```gdl\n$code\n```\n";
                }
            }
        }

        // Aktuelle Parameter als Kontext anhängen
        $parameters = $context['parameters'] ?? [];
        if (!empty($parameters)) {
            $prompt .= "\n\n## Aktuelle Parameter\n";
            foreach ($parameters as $p) {
                $name = $p['gdl_name'] ?? $p['name'] ?? '?';
                $type = $p['type'] ?? '?';
                $val  = $p['value'] ?? '?';
                $desc = $p['description'] ?? '';
                $prompt .= "- `$name` ($type) = $val" . ($desc ? " — $desc" : '') . "\n";
            }
        }

        return $prompt;
    }
}
