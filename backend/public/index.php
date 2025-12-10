<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Factory\AppFactory;
use DI\ContainerBuilder;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

// Load .env file
if (file_exists(__DIR__ . '/../.env')) {
	$dotenv = Dotenv::createImmutable(__DIR__ . '/../');
	$dotenv->load();
}

$containerBuilder = new ContainerBuilder();
$definitions = require __DIR__ . '/../config/config.php';
$definitions($containerBuilder);

$container = $containerBuilder->build();
AppFactory::setContainer($container);

$app = AppFactory::create();
$app->setBasePath('/gdl-ui-studio/backend/public');

// WICHTIG: CORS muss VOR Error Middleware kommen!
$app->add(function (Request $request, RequestHandler $handler): Response {
	$response = $handler->handle($request);
	return $response
		->withHeader('Access-Control-Allow-Origin', '*')
		->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
		->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});

// Handle OPTIONS requests (CORS preflight)
$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
	return $response;
});

// Error Middleware NACH CORS
$app->addErrorMiddleware(true, true, true);

// Routes
(require __DIR__ . '/../src/routes.php')($app);

$app->run();
