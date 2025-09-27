// HTTP utilities for API Gateway v2 Lambda functions
import { APIGatewayProxyEventV2 } from 'aws-lambda';

export interface RequestInfo {
  routeKey: string;
  rawPath: string;
  method: string;
  requestId: string;
}

export function getRequestInfo(event: APIGatewayProxyEventV2): RequestInfo {
  return {
    routeKey: event.routeKey,
    rawPath: event.rawPath,
    method: event.requestContext?.http?.method || 'UNKNOWN',
    requestId: event.requestContext?.requestId || 'unknown'
  };
}

export function createJsonResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Credentials': 'false'
    },
    body: JSON.stringify(body)
  };
}

export function createSuccessResponse(data: any, message: string = 'Success') {
  return createJsonResponse(200, {
    success: true,
    message,
    data
  });
}

export function createErrorResponse(statusCode: number, message: string) {
  return createJsonResponse(statusCode, {
    success: false,
    message
  });
}