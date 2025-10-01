import { HttpError, createHttpError, mapError } from '../../src/utils/errors';

describe('Error utilities', () => {
  describe('HttpError', () => {
    test('should create an error with status code', () => {
      const error = new HttpError(404, 'Not Found');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.name).toBe('HttpError');
    });
  });

  describe('createHttpError', () => {
    test('should create an HttpError', () => {
      const error = createHttpError(400, 'Bad Request');
      
      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
    });
  });

  describe('mapError', () => {
    test('should preserve statusCode for HttpError', () => {
      const error = new HttpError(403, 'Forbidden');
      const mapped = mapError(error);
      
      expect(mapped.statusCode).toBe(403);
      expect(mapped.message).toBe('Forbidden');
    });

    test('should map ValidationError to 400', () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      const mapped = mapError(error);
      
      expect(mapped.statusCode).toBe(400);
      expect(mapped.message).toBe('Invalid input');
    });

    test('should map UnauthorizedError to 401', () => {
      const error = new Error('Authentication required');
      error.name = 'UnauthorizedError';
      const mapped = mapError(error);
      
      expect(mapped.statusCode).toBe(401);
      expect(mapped.message).toBe('Unauthorized');
    });

    test('should map NotFoundError to 404', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';
      const mapped = mapError(error);
      
      expect(mapped.statusCode).toBe(404);
      expect(mapped.message).toBe('Not found');
    });

    test('should map unknown errors to 500', () => {
      const error = new Error('Something went wrong');
      const mapped = mapError(error);
      
      expect(mapped.statusCode).toBe(500);
      expect(mapped.message).toBe('Something went wrong');
    });

    test('should handle errors without a message', () => {
      const error = new Error();
      const mapped = mapError(error);
      
      expect(mapped.statusCode).toBe(500);
      expect(mapped.message).toBe('Internal server error');
    });
  });
});