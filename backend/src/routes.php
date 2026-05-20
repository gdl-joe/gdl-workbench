<?php
use Slim\App;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Controllers\ParameterController;
use App\Controllers\ProjectController;
use App\Controllers\GdlObjectController;
use App\Controllers\CodeschmiedeController;

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
		$group->post('/parameters/insert', ParameterController::class . ':insertParameter');
		$group->get('/objects/{objectId}/parameters/export', ParameterController::class . ':exportXml');
		$group->get('/objects/{objectId}/export-zip', GdlObjectController::class . ':exportZip');
		$group->post('/parameters/bulk-delete', ParameterController::class . ':bulkDeleteParameters');

		// Parameter Type Colors
		$group->get('/parameter-type-colors', ParameterController::class . ':getTypeColors');
		$group->put('/parameter-type-colors/{type}', ParameterController::class . ':updateTypeColor');

		// Image Management
		$group->get('/images/list', GdlObjectController::class . ':listImages');

		// Local File System Routes
		$group->group('/local', function (\Slim\Routing\RouteCollectorProxy $local) {
			$local->get('/projects', \App\Controllers\LocalController::class . ':getProjects');
			$local->post('/projects', \App\Controllers\LocalController::class . ':createProject');
			$local->put('/projects/{id:.+}', \App\Controllers\LocalController::class . ':updateProject');
			$local->delete('/projects/{id:.+}', \App\Controllers\ProjectController::class . ':deleteProject');
			$local->post('/projects/{id:.+}/duplicate', \App\Controllers\ProjectController::class . ':duplicateProject');
			$local->get('/objects', \App\Controllers\LocalController::class . ':getObjects');

			// NEW: Consolidated Local Endpoints
			$local->get('/gdl-objects/{id:.+}', \App\Controllers\LocalController::class . ':getObject');
			$local->post('/objects/import', \App\Controllers\LocalController::class . ':importObject');
			$local->post('/objects/{id:.+}/export', \App\Controllers\LocalController::class . ':exportObject');
			$local->get('/objects/{id:.+}/parameters', \App\Controllers\LocalController::class . ':getParameters');
			$local->get('/objects/{id:.+}/parameters/export', \App\Controllers\LocalController::class . ':exportXml');
			$local->post('/objects/{id:.+}/parameters/import', \App\Controllers\LocalController::class . ':importXml');
			$local->post('/objects/{id:.+}/update-scripts', \App\Controllers\LocalController::class . ':updateScripts');
			$local->put('/gdl-objects/{id:.+}', \App\Controllers\LocalController::class . ':updateObject');

			$local->get('/parameter-type-colors', \App\Controllers\ParameterController::class . ':getTypeColors');
			$local->post('/parameters/import', \App\Controllers\ParameterController::class . ':importXml');
			$local->post('/parameters/create', \App\Controllers\ParameterController::class . ':createParameter');
			$local->post('/parameters/bulk-delete', \App\Controllers\ParameterController::class . ':bulkDelete');
			$local->post('/parameters/reorder', \App\Controllers\ParameterController::class . ':reorderParameters');
			$local->put('/parameters/{parameterId}', \App\Controllers\ParameterController::class . ':updateParameter');
			$local->delete('/parameters/{parameterId}', \App\Controllers\ParameterController::class . ':deleteParameter');

			// Codeschmiede Snippets
			$local->get('/snippets', CodeschmiedeController::class . ':getSnippets');
			$local->post('/snippets', CodeschmiedeController::class . ':createSnippet');
			$local->delete('/snippets/{id}', CodeschmiedeController::class . ':deleteSnippet');

			$local->get('/images/makros', \App\Controllers\LocalController::class . ':listMakrosImages');
			$local->get('/images/makros/serve', \App\Controllers\LocalController::class . ':serveMakrosImage');
			$local->post('/tasks/run', \App\Controllers\LocalController::class . ':runTask');
		});
	});
};
