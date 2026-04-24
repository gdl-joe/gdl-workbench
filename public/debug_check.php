<?php
// debug_check.php
// Lade diesen Script hoch in den Ordner: /backend/public/

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain');

echo "=== GDL-UI-Studio Debug Check ===\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Server Software: " . $_SERVER['SERVER_SOFTWARE'] . "\n";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "Script Path: " . __FILE__ . "\n";

echo "\n--- 1. Checking Directory Structure ---\n";

$baseDir = __DIR__ . '/..';
$vendorAutoload = $baseDir . '/vendor/autoload.php';
$configFile = $baseDir . '/config/config.php';
$envFile = $baseDir . '/.env';

if (file_exists($vendorAutoload)) {
    echo "[OK] Vendor autoload found at: $vendorAutoload\n";
} else {
    echo "[ERROR] Vendor autoload NOT found at: $vendorAutoload\n";
    echo "      Did you upload the 'vendor' folder?\n";
}

if (file_exists($configFile)) {
    echo "[OK] Config file found at: $configFile\n";
} else {
    echo "[ERROR] Config file NOT found at: $configFile\n";
}

if (file_exists($envFile)) {
    echo "[OK] .env file found at: $envFile\n";
} else {
    echo "[INFO] .env file not found. Assuming environment variables are set in config.php or server config.\n";
}

echo "\n--- 2. Checking Database Connection ---\n";

// Versuche Variable aus config.php zu lesen, falls möglich, oder manuell prüfen
if (file_exists($configFile)) {
    // Da config.php eine Closure zurückgibt, ist es schwer, sie hier isoliert auszuführen ohne den Container.
    // Wir versuchen eine manuelle Verbindung basierend auf typischen Annahmen oder laden .env wenn vorhanden.

    if (file_exists($vendorAutoload)) {
        require $vendorAutoload;

        if (file_exists($envFile)) {
            try {
                $dotenv = Dotenv\Dotenv::createImmutable($baseDir);
                $dotenv->load();
                echo "[OK] .env loaded via Dotenv\n";
            } catch (Exception $e) {
                echo "[WARN] Could not load .env via Dotenv: " . $e->getMessage() . "\n";
            }
        }
    }

    $dbHost = $_ENV['DB_HOST'] ?? 'localhost';
    $dbName = $_ENV['DB_NAME'] ?? 'gdl_ui_studio_db';
    $dbUser = $_ENV['DB_USER'] ?? 'root';
    $dbPass = $_ENV['DB_PASSWORD'] ?? 'root';

    echo "Attempting DB Connection with:\n";
    echo "Host: $dbHost\n";
    echo "Name: $dbName\n";
    echo "User: $dbUser\n";
    echo "Pass: " . (strlen($dbPass) > 0 ? '******' : '(empty)') . "\n";

    try {
        $dsn = "mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        echo "[OK] Database connection SUCCESSFUL!\n";

        // Test query
        $stmt = $pdo->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "Tables found: " . implode(", ", $tables) . "\n";

    } catch (PDOException $e) {
        echo "[ERROR] Database connection FAILED: " . $e->getMessage() . "\n";
    }

} else {
    echo "[SKIP] Cannot test DB because config.php is missing.\n";
}

echo "\n--- 3. Checking Base Path for Routing ---\n";
$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME']; // e.g. /gdl-ui-studio/backend/public/index.php
$dirName = dirname($scriptName); // e.g. /gdl-ui-studio/backend/public

echo "Request URI: $requestUri\n";
echo "Script Name: $scriptName\n";
echo "Detected Base Path: $dirName\n";
echo "Configured Base Path in index.php (hardcoded): /gdl-ui-studio/backend/public\n";

if ($dirName !== '/gdl-ui-studio/backend/public') {
    echo "[WARN] The detected base path '$dirName' does NOT match the hardcoded path in index.php!\n";
    echo "       You might need to update line 25 in index.php to: \$app->setBasePath('$dirName');\n";
} else {
    echo "[OK] Base path matches.\n";
}

echo "\n=== End of Check ===\n";
