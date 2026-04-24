<?php

/**
 * GDL Workbench – Custom Herd/Valet Driver
 *
 * Struktur des Projekts:
 *   public/          → statisches Frontend (HTML, CSS, JS)
 *   backend/public/  → Slim PHP API (index.php = entry point)
 *
 * Routing-Logik:
 *   /backend/public/* → backend/public/index.php  (PHP-API)
 *   /*               → public/<uri>  oder  public/index.html  (Frontend)
 */
class LocalValetDriver extends \Valet\Drivers\ValetDriver
{
    /** Immer aktiv für dieses Projekt */
    public function serves(string $sitePath, string $siteName, string $uri): bool
    {
        return true;
    }

    /** Statische Dateien nur aus dem Frontend-Root bedienen */
    public function isStaticFile(string $sitePath, string $siteName, string $uri)
    {
        // API-Anfragen niemals als statische Datei behandeln
        if ($this->isApiRequest($uri)) {
            return false;
        }

        $publicPath = $sitePath . '/public' . $uri;

        if ($this->isActualFile($publicPath)) {
            return $publicPath;
        }

        if (file_exists($publicPath . '/index.html')) {
            return $publicPath . '/index.html';
        }

        return false;
    }

    /** Front-Controller auswählen */
    public function frontControllerPath(string $sitePath, string $siteName, string $uri): ?string
    {
        $_SERVER['SERVER_ADDR'] = '127.0.0.1';
        $_SERVER['SERVER_NAME'] = $_SERVER['HTTP_HOST'];

        // ── Backend-API → backend/public/index.php ──────────────────────────
        if ($this->isApiRequest($uri)) {
            $apiIndex = $sitePath . '/backend/public/index.php';
            if ($this->isActualFile($apiIndex)) {
                $_SERVER['SCRIPT_FILENAME'] = $apiIndex;
                $_SERVER['SCRIPT_NAME']     = '/backend/public/index.php';
                $_SERVER['DOCUMENT_ROOT']   = $sitePath . '/backend/public';
                $_SERVER['PHP_SELF']        = '/backend/public/index.php';
                return $apiIndex;
            }
        }

        // ── Frontend → public/ ───────────────────────────────────────────────
        $docRoot = $sitePath . '/public';
        $_SERVER['PHP_SELF']     = $uri;
        $_SERVER['DOCUMENT_ROOT'] = $docRoot;

        $candidates = [
            $docRoot . $uri,
            $docRoot . $uri . '/index.php',
            $docRoot . '/index.html',
        ];

        foreach ($candidates as $candidate) {
            if ($this->isActualFile($candidate)) {
                $_SERVER['SCRIPT_FILENAME'] = $candidate;
                $_SERVER['SCRIPT_NAME']     = str_replace($docRoot, '', $candidate);
                return $candidate;
            }
        }

        return null;
    }

    /** Prüft ob die Anfrage an die Backend-API geht */
    private function isApiRequest(string $uri): bool
    {
        return str_starts_with($uri, '/backend/');
    }
}
