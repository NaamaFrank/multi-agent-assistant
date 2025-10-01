import { getRequestInfo, createJsonResponse } from '../../src/utils/http';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('HTTP utilities', () => {
  describe('getRequestInfo', () => {
    test('should extract request info from event', () => {
      const event = {
        routeKey: 'GET /api/users',
        rawPath: '/api/users',
        requestContext: {
          http: {
            method: 'GET'
          },
          requestId: '123-abc-456'
        }
      } as APIGatewayProxyEventV2;

      const info = getRequestInfo(event);
      
      expect(info.routeKey).toBe('GET /api/users');
      expect(info.rawPath).toBe('/api/users');
      expect(info.method).toBe('GET');
      expect(info.requestId).toBe('123-abc-456');
    });

    test('should handle missing request context', () => {
      const event = {
        routeKey: 'POST /api/auth',
        rawPath: '/api/auth',
        requestContext: {}
      } as unknown as APIGatewayProxyEventV2;

      const info = getRequestInfo(event);
      
      expect(info.routeKey).toBe('POST /api/auth');
      expect(info.rawPath).toBe('/api/auth');
      expect(info.method).toBe('UNKNOWN');
      expect(info.requestId).toBe('unknown');
    });
  });

  describe('createJsonResponse', () => {
    test('should create a response with correct status and body', () => {
      const data = { name: 'Test User', id: 123 };
      const response = createJsonResponse(200, data);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual(data);
    });

    test('should create an error response', () => {
      const error = { message: 'Not Found', code: 'RESOURCE_NOT_FOUND' };
      const response = createJsonResponse(404, error);
      
      expect(response.statusCode).toBe(404);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual(error);
    });

    test('should include CORS headers', () => {
      const response = createJsonResponse(200, {});
      
      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(response.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(response.headers['Access-Control-Allow-Headers']).toBeDefined();
    });
  });
});