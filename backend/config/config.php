<?php
// gdl-ui-studio/backend/config/config.php

use DI\ContainerBuilder;
use Psr\Container\ContainerInterface; // Bleibt bestehen

return function (ContainerBuilder $containerBuilder) {
	// Umgebungsvariablen (DB_HOST etc.) sollten bereits durch Dotenv geladen sein
	// Hier werden sie als "Werte" in den Container gelegt
	$containerBuilder->addDefinitions([
		// Diese Parameter sind jetzt für den Container als Werte verfügbar
		'db.host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
		'db.port' => $_ENV['DB_PORT'] ?? 3306,
		'db.name' => $_ENV['DB_NAME'] ?? 'gdl-workbench',
		'db.user' => $_ENV['DB_USER'] ?? 'root',
		'db.password' => $_ENV['DB_PASSWORD'] ?? '',

		// Local Workspace Root – Verzeichnis mit den *.project-Ordnern.
		// MUSS pro Rechner in backend/.env via LOCAL_WORKSPACE_ROOT gesetzt werden
		// (siehe backend/.env.example). Ohne Wert bleibt die Projektliste leer.
		'local.workspace.root' => $_ENV['LOCAL_WORKSPACE_ROOT'] ?? '',

		// ###############################################################
		// ANPASSUNG: Die PDO-Instanz direkt hier als Factory-Closure definieren
		// mit expliziter Auflösung der DB-Parameter aus dem Container.
		// PHP-DI versteht das so am besten.
		// ###############################################################
		\PDO::class => function (ContainerInterface $c) { // <<< Wichtig: PDO::class als Key!
			$dsn = "mysql:host={$c->get('db.host')};port={$c->get('db.port')};dbname={$c->get('db.name')};charset=utf8mb4";
			$pdo = new PDO($dsn, $c->get('db.user'), $c->get('db.password'));
			$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
			return $pdo;
		},
		// ###############################################################

		// Optional: Wenn du den Dienst unter einem Alias "db" verfügbar machen willst,
		// falls dein Controller z.B. noch "protected $db;" ohne Type Hint hat,
		// oder wenn du den Alias bevorzugst.
		'db' => \DI\get(\PDO::class),
	]);
};
