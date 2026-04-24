<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler; // Add this
use Slim\Factory\AppFactory;
use DI\Container;
use Slim\Middleware\CorsMiddleware; // Add this if you want to use Slim's built-in CorsMiddleware

require __DIR__ . '/../vendor/autoload.php';

// Load .env file
if (file_exists(__DIR__ . '/../.env')) {
	$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
	$dotenv->load();
}

// Create Container
$container = new Container();
AppFactory::setContainer($container);

// Set up database connection
$container->set('db', function () {
	$dsn = 'mysql:host=' . ($_ENV['DB_HOST'] ?? 'localhost') . ';dbname=' . ($_ENV['DB_NAME'] ?? 'gdl_ui_studio_db') . ';charset=utf8mb4';
	$pdo = new PDO($dsn, $_ENV['DB_USER'] ?? 'root', $_ENV['DB_PASSWORD'] ?? 'root'); // Default MAMP user/pw
	$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
	return $pdo;
});

$app = AppFactory::create();
	
	$app = AppFactory::create();
	
	// ######################################################################
	// NEUE TEST-ROUTE ZUR FEHLERSUCHE: Prüfen, ob Slim Routen überhaupt findet
	// ######################################################################
	$app->get('/debug-test', function (Request $request, Response $response) {
		$response->getBody()->write('Debug test route works!');
		return $response;
	});
	// ######################################################################
	
	// Add Error Middleware (for development)
	$app->addErrorMiddleware(true, true, true);

// Add Error Middleware (for development)
$app->addErrorMiddleware(true, true, true);

// ----------------------------------------------------------------------------------------------------------------------
// ANPASSUNG: Korrekte CORS Middleware für Slim 4
// ----------------------------------------------------------------------------------------------------------------------
$app->add(function (Request $request, RequestHandler $handler): Response {
	$response = $handler->handle($request);
	return $response
		->withHeader('Access-Control-Allow-Origin', '*') // Allow all origins for development
		->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
		->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});

// Handle OPTIONS requests for CORS preflight (this needs to be before routes.php is included)
$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
	// This allows preflight requests to pass through
	return $response;
});

// Require our routes file
(require __DIR__ . '/../src/routes.php')($app);

$app->run();
