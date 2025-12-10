<?php
use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Controllers\ParameterController;
use App\Controllers\ProjectController;
use App\Controllers\GdlObjectController; // NEU

return function (App $app) {
	$app->get('/', function (Request $request, Response $response) {
		$response->getBody()->write('Hello from GDL-UI-Studio Backend!');
		return $response;
	});

	$app->group('/api', function (\Slim\Routing\RouteCollectorProxy $group) {
		// Project Management
		$group->get('/projects', ProjectController::class . ':getAllProjects');
		$group->post('/projects', ProjectController::class . ':createProject');
		$group->get('/projects/{projectId}', ProjectController::class . ':getProject');
		$group->put('/projects/{projectId}', ProjectController::class . ':updateProject');
		$group->delete('/projects/{projectId}', ProjectController::class . ':deleteProject');
		$group->post('/projects/{projectId}/duplicate', ProjectController::class . ':duplicateProject');
		
		// GDL Object Management
		$group->get('/projects/{projectId}/objects', GdlObjectController::class . ':getObjectsByProject');
		$group->post('/gdl-objects', GdlObjectController::class . ':createObject');
		$group->get('/gdl-objects/{objectId}', GdlObjectController::class . ':getObject');
		$group->put('/gdl-objects/{objectId}', GdlObjectController::class . ':updateObject');
		$group->delete('/gdl-objects/{objectId}', GdlObjectController::class . ':deleteObject');
		$group->post('/gdl-objects/{objectId}/duplicate', GdlObjectController::class . ':duplicateObject');
		
		// Parameter Management
		$group->post('/parameters/import', ParameterController::class . ':importXml');
		$group->get('/objects/{objectId}/parameters', ParameterController::class . ':getObjectParameters');
		$group->post('/parameters/create', ParameterController::class . ':createParameter');
		$group->put('/parameters/{parameterId}', ParameterController::class . ':updateParameter');
		$group->delete('/parameters/{parameterId}', ParameterController::class . ':deleteParameter');
		$group->post('/parameters/reorder', ParameterController::class . ':reorderParameters');
		$group->post('/parameters/insert', ParameterController::class . ':insertParameter'); // NEW: Insert at position
		$group->get('/objects/{objectId}/parameters/export', ParameterController::class . ':exportXml');
		$group->post('/parameters/bulk-delete', ParameterController::class . ':bulkDeleteParameters');
		
		// Parameter Type Colors
		$group->get('/parameter-type-colors', ParameterController::class . ':getTypeColors');
		$group->put('/parameter-type-colors/{type}', ParameterController::class . ':updateTypeColor');
	});
};
