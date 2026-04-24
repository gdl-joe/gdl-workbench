<?php
namespace App\Helpers;

use Psr\Http\Message\ResponseInterface as Response;

class ResponseHelper
{
	/**
	 * Return a standardized success response
	 * 
	 * @param Response $response PSR-7 Response object
	 * @param mixed $data Data to return (array, object, etc.)
	 * @param string $message Optional success message
	 * @param int $status HTTP status code (default: 200)
	 * @return Response
	 */
	public static function success(
		Response $response, 
		$data = null, 
		string $message = '', 
		int $status = 200
	): Response {
		$payload = ['success' => true];
		
		if ($data !== null) {
			$payload['data'] = $data;
		}
		
		if (!empty($message)) {
			$payload['message'] = $message;
		}
		
		$response->getBody()->write(json_encode($payload));
		return $response
			->withHeader('Content-Type', 'application/json')
			->withStatus($status);
	}
	
	/**
	 * Return a standardized error response
	 * 
	 * @param Response $response PSR-7 Response object
	 * @param string $error Error message
	 * @param int $status HTTP status code (default: 400)
	 * @param mixed $data Optional additional error data
	 * @return Response
	 */
	public static function error(
		Response $response, 
		string $error, 
		int $status = 400, 
		$data = null
	): Response {
		$payload = [
			'success' => false,
			'error' => $error
		];
		
		if ($data !== null) {
			$payload['data'] = $data;
		}
		
		$response->getBody()->write(json_encode($payload));
		return $response
			->withHeader('Content-Type', 'application/json')
			->withStatus($status);
	}
}
