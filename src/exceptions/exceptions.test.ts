import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { HttpStatus } from '@nestjs/common';
import { getHttpStatusTitle, HttpExceptionFilter } from '../filters/http-exception.filter';
import type { ApiErrorResponse } from '../types/error-response.types';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
  MethodNotAllowedException,
  NotAcceptableException,
  NotFoundException,
  NotImplementedException,
  PayloadTooLargeException,
  RequestTimeoutException,
  ServiceUnavailableException,
  TooManyRequestsException,
  UnauthorizedException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
  ValidationException,
} from './index';

describe('RFC 9457 Problem Details Format - Exception Classes', () => {
  describe('BadRequestException', () => {
    describe('Constructor Signatures', () => {
      it('should support simple string constructor', () => {
        const exception = new BadRequestException('Invalid input');
        const response = exception.getResponse() as any;

        assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
        assert.deepEqual(response, {
          type: 'about:blank',
          label: undefined,
          detail: 'Invalid input',
          errors: [],
        });
      });

      it('should support options object with label and detail', () => {
        const exception = new BadRequestException({
          label: 'Validation Error',
          detail: 'Please check your input',
        });
        const response = exception.getResponse() as any;

        assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(response.type, 'about:blank');
        assert.equal(response.label, 'Validation Error');
        assert.equal(response.detail, 'Please check your input');
        assert.deepEqual(response.errors, []);
      });

      it('should support options object with errors array', () => {
        const exception = new BadRequestException({
          detail: 'Validation failed',
          errors: [
            { field: 'email', message: 'Invalid email format' },
            { field: 'password', message: 'Password too short' },
          ],
        });
        const response = exception.getResponse() as any;

        assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(response.errors.length, 2);
        assert.deepEqual(response.errors[0], { field: 'email', message: 'Invalid email format' });
        assert.deepEqual(response.errors[1], { field: 'password', message: 'Password too short' });
        assert.equal(response.detail, 'Validation failed');
      });

      it('should support custom type URI', () => {
        const exception = new BadRequestException({
          type: 'https://api.example.com/errors/validation-error',
          detail: 'Custom validation error',
        });
        const response = exception.getResponse() as any;

        assert.equal(response.type, 'https://api.example.com/errors/validation-error');
        assert.equal(response.detail, 'Custom validation error');
      });

      it('should use default detail when no argument provided', () => {
        const exception = new BadRequestException();
        const response = exception.getResponse() as any;

        assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(response.detail, 'Bad Request');
        assert.equal(response.type, 'about:blank');
        assert.deepEqual(response.errors, []);
      });
    });
  });

  describe('UnauthorizedException', () => {
    it('should support simple string constructor', () => {
      const exception = new UnauthorizedException('Authentication required');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.UNAUTHORIZED);
      assert.equal(response.detail, 'Authentication required');
      assert.equal(response.type, 'about:blank');
    });

    it('should support options with label and detail', () => {
      const exception = new UnauthorizedException({
        label: 'Invalid Credentials',
        detail: 'The email or password is incorrect',
      });
      const response = exception.getResponse() as any;

      assert.equal(response.label, 'Invalid Credentials');
      assert.equal(response.detail, 'The email or password is incorrect');
    });

    it('should use default detail when no argument provided', () => {
      const exception = new UnauthorizedException();
      const response = exception.getResponse() as any;

      assert.equal(response.detail, 'Unauthorized');
    });
  });

  describe('NotFoundException', () => {
    it('should support options with field errors', () => {
      const exception = new NotFoundException({
        detail: 'Resource not found',
        errors: [{ field: 'userId', message: 'User does not exist' }],
      });
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.NOT_FOUND);
      assert.equal(response.errors.length, 1);
      assert.deepEqual(response.errors[0], { field: 'userId', message: 'User does not exist' });
    });
  });

  describe('ConflictException', () => {
    it('should support options with custom type', () => {
      const exception = new ConflictException({
        type: 'resource-conflict',
        detail: 'Email already exists',
        errors: [{ field: 'email', message: 'This email is already registered' }],
      });
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.CONFLICT);
      assert.equal(response.type, 'resource-conflict');
    });
  });

  describe('InternalServerErrorException', () => {
    it('should support simple string constructor', () => {
      const exception = new InternalServerErrorException('Database connection failed');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.INTERNAL_SERVER_ERROR);
      assert.equal(response.detail, 'Database connection failed');
    });
  });

  describe('ValidationException', () => {
    it('should support options with multiple errors', () => {
      const exception = new ValidationException({
        detail: 'Please correct the errors and try again',
        errors: [
          { field: 'email', message: 'Invalid format' },
          { field: 'age', message: 'Must be at least 18' },
        ],
      });
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.equal(response.errors.length, 2);
      assert.equal(response.detail, 'Please correct the errors and try again');
    });
  });

  describe('All Exception Classes', () => {
    it('should all extend HttpProblemException and follow RFC 9457 format', () => {
      const exceptions = [
        new BadRequestException('test'),
        new UnauthorizedException('test'),
        new ForbiddenException('test'),
        new NotFoundException('test'),
        new ConflictException('test'),
        new InternalServerErrorException('test'),
        new UnprocessableEntityException('test'),
        new TooManyRequestsException('test'),
        new ServiceUnavailableException('test'),
        new MethodNotAllowedException('test'),
        new GoneException('test'),
        new NotAcceptableException('test'),
        new RequestTimeoutException('test'),
        new PayloadTooLargeException('test'),
        new UnsupportedMediaTypeException('test'),
        new NotImplementedException('test'),
        new BadGatewayException('test'),
        new ValidationException('test'),
      ];

      for (const exception of exceptions) {
        const response = exception.getResponse() as any;
        assert.ok('type' in response, 'Response should have type property');
        assert.ok('detail' in response, 'Response should have detail property');
        assert.ok('errors' in response, 'Response should have errors property');
        assert.ok(Array.isArray(response.errors), 'errors should be an array');
      }
    });
  });
});

describe('RFC 9457 Problem Details Format - HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: any;
  let sentResponse: any;
  let responseHeaders: Record<string, string>;
  let responseStatus: number;

  beforeEach(() => {
    sentResponse = null;
    responseHeaders = {};
    responseStatus = 0;

    mockResponse = {
      header: (name: string, value: string) => {
        responseHeaders[name] = value;
        return mockResponse;
      },
      status: (code: number) => {
        responseStatus = code;
        return mockResponse;
      },
      send: (body: any) => {
        sentResponse = body;
        return mockResponse;
      },
    };

    mockRequest = {
      url: '/api/test',
    };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };

    filter = new HttpExceptionFilter();
  });

  describe('Filter Output Structure', () => {
    it('should include all RFC 9457 required fields', () => {
      const exception = new BadRequestException('Invalid input');
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.type, 'about:blank');
      assert.equal(sentResponse.title, 'Bad Request');
      assert.equal(sentResponse.status, 400);
      assert.equal(sentResponse.detail, 'Invalid input');
      assert.equal(sentResponse.instance, '/api/test');
      assert.deepEqual(sentResponse.errors, []);
    });

    it('should include optional label field when provided', () => {
      const exception = new BadRequestException({
        label: 'Validation Error',
        detail: 'Please check your input',
      });
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.type, 'about:blank');
      assert.equal(sentResponse.title, 'Bad Request');
      assert.equal(sentResponse.status, 400);
      assert.equal(sentResponse.label, 'Validation Error');
      assert.equal(sentResponse.detail, 'Please check your input');
      assert.equal(sentResponse.instance, '/api/test');
      assert.deepEqual(sentResponse.errors, []);
    });

    it('should include errors array when provided', () => {
      const exception = new BadRequestException({
        detail: 'Validation failed',
        errors: [{ field: 'email', message: 'Invalid email format' }],
      });
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.errors.length, 1);
      assert.deepEqual(sentResponse.errors[0], {
        field: 'email',
        message: 'Invalid email format',
      });
    });

    it('should set Content-Type header to application/problem+json', () => {
      const exception = new BadRequestException('Invalid input');
      filter.catch(exception, mockArgumentsHost);

      assert.equal(responseHeaders['Content-Type'], 'application/problem+json');
    });

    it('should set correct HTTP status code', () => {
      const exception = new UnauthorizedException('Authentication required');
      filter.catch(exception, mockArgumentsHost);

      assert.equal(responseStatus, 401);
      assert.equal(sentResponse.status, 401);
    });

    it('should set correct title from HTTP status phrase', () => {
      const testCases = [
        { exception: new BadRequestException('test'), expectedTitle: 'Bad Request' },
        { exception: new UnauthorizedException('test'), expectedTitle: 'Unauthorized' },
        { exception: new ForbiddenException('test'), expectedTitle: 'Forbidden' },
        { exception: new NotFoundException('test'), expectedTitle: 'Not Found' },
        { exception: new ConflictException('test'), expectedTitle: 'Conflict' },
        { exception: new InternalServerErrorException('test'), expectedTitle: 'Internal Server Error' },
      ];

      for (const { exception, expectedTitle } of testCases) {
        sentResponse = null;
        filter.catch(exception, mockArgumentsHost);
        assert.equal(sentResponse.title, expectedTitle);
      }
    });
  });

  describe('Custom Type URI Handling', () => {
    it('should use custom type URI when provided', () => {
      const exception = new BadRequestException({
        type: 'https://api.example.com/errors/validation',
        detail: 'Custom error',
      });
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.type, 'https://api.example.com/errors/validation');
    });

    it('should default to about:blank when no custom type', () => {
      const exception = new BadRequestException('test');
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.type, 'about:blank');
    });
  });

  describe('Class-Validator DTO Error Handling', () => {
    it('should map class-validator errors to field/message format', () => {
      // Create a proper HttpException instance with ValidationPipe-style response
      const validationException = new BadRequestException({
        detail: 'Validation failed',
        errors: [],
      });
      // Override getResponse to simulate class-validator format
      validationException.getResponse = () => ({
        message: [
          {
            property: 'email',
            constraints: {
              isEmail: 'email must be an email',
              isNotEmpty: 'email should not be empty',
            },
          },
          {
            property: 'password',
            constraints: {
              minLength: 'password must be longer than or equal to 8 characters',
            },
          },
        ],
        error: 'Bad Request',
      });

      filter.catch(validationException, mockArgumentsHost);

      assert.equal(sentResponse.errors.length, 2);
      assert.deepEqual(sentResponse.errors[0], {
        field: 'email',
        message: 'email must be an email',
      });
      assert.deepEqual(sentResponse.errors[1], {
        field: 'password',
        message: 'password must be longer than or equal to 8 characters',
      });
      assert.equal(sentResponse.detail, 'Validation failed');
    });

    it('should use first constraint message for each field', () => {
      const validationException = new BadRequestException('test');
      validationException.getResponse = () => ({
        message: [
          {
            property: 'email',
            constraints: {
              isEmail: 'email must be an email',
              isNotEmpty: 'email should not be empty',
              matches: 'email must match pattern',
            },
          },
        ],
      });

      filter.catch(validationException, mockArgumentsHost);

      assert.equal(sentResponse.errors[0].message, 'email must be an email');
    });

    it('should extract field name from property', () => {
      const validationException = new BadRequestException('test');
      validationException.getResponse = () => ({
        message: [
          {
            property: 'username',
            constraints: {
              isNotEmpty: 'username should not be empty',
            },
          },
        ],
      });

      filter.catch(validationException, mockArgumentsHost);

      assert.equal(sentResponse.errors[0].field, 'username');
    });
  });

  describe('Unknown Error Handling', () => {
    it('should handle unknown errors with generic 500 response', () => {
      const unknownError = new Error('Something went wrong');
      filter.catch(unknownError, mockArgumentsHost);

      assert.equal(responseStatus, 500);
      assert.equal(sentResponse.type, 'about:blank');
      assert.equal(sentResponse.title, 'Internal Server Error');
      assert.equal(sentResponse.status, 500);
      assert.equal(sentResponse.detail, 'An unexpected error occurred');
      assert.equal(sentResponse.instance, '/api/test');
      assert.deepEqual(sentResponse.errors, []);
    });

    it('should handle non-Error objects', () => {
      const unknownError = 'string error';
      filter.catch(unknownError, mockArgumentsHost);

      assert.equal(responseStatus, 500);
      assert.equal(sentResponse.detail, 'An unexpected error occurred');
    });
  });

  describe('Standard NestJS Exception Handling', () => {
    it('should handle standard NestJS exception with string message', () => {
      const exception = new BadRequestException('test');
      exception.getResponse = () => ({
        message: 'Simple error message',
        error: 'Bad Request',
      });

      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.detail, 'Simple error message');
      assert.deepEqual(sentResponse.errors, []);
    });

    it('should handle exception with array of string messages', () => {
      const exception = new BadRequestException('test');
      exception.getResponse = () => ({
        message: ['Error 1', 'Error 2', 'Error 3'],
        error: 'Bad Request',
      });

      filter.catch(exception, mockArgumentsHost);

      // When message is an array, the filter treats it as class-validator format
      // If no items have property/constraints, errors array is empty and detail defaults to 'Validation failed'
      assert.equal(sentResponse.detail, 'Validation failed');
      assert.deepEqual(sentResponse.errors, []);
    });

    it('should handle exception with string response', () => {
      const exception = new NotFoundException('test');
      exception.getResponse = () => 'Resource not found';

      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.detail, 'Resource not found');
    });
  });

  describe('Instance Field', () => {
    it('should set instance to request URL', () => {
      mockRequest.url = '/api/users/123';
      const exception = new NotFoundException('User not found');
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.instance, '/api/users/123');
    });

    it('should handle different request paths', () => {
      mockRequest.url = '/api/v1/orders?status=pending';
      const exception = new BadRequestException('Invalid query');
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.instance, '/api/v1/orders?status=pending');
    });
  });
});

describe('getHttpStatusTitle Utility', () => {
  it('should convert HTTP status codes to title case phrases', () => {
    assert.equal(getHttpStatusTitle(400), 'Bad Request');
    assert.equal(getHttpStatusTitle(401), 'Unauthorized');
    assert.equal(getHttpStatusTitle(403), 'Forbidden');
    assert.equal(getHttpStatusTitle(404), 'Not Found');
    assert.equal(getHttpStatusTitle(409), 'Conflict');
    assert.equal(getHttpStatusTitle(422), 'Unprocessable Entity');
    assert.equal(getHttpStatusTitle(429), 'Too Many Requests');
    assert.equal(getHttpStatusTitle(500), 'Internal Server Error');
    assert.equal(getHttpStatusTitle(502), 'Bad Gateway');
    assert.equal(getHttpStatusTitle(503), 'Service Unavailable');
  });

  it('should return "Error" for unknown status codes', () => {
    assert.equal(getHttpStatusTitle(999), 'Error');
  });
});

describe('Complete Integration Tests', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: any;
  let sentResponse: ApiErrorResponse;

  beforeEach(() => {
    sentResponse = null as any;

    mockResponse = {
      header: () => mockResponse,
      status: () => mockResponse,
      send: (body: any) => {
        sentResponse = body;
        return mockResponse;
      },
    };

    mockRequest = { url: '/api/test' };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };

    filter = new HttpExceptionFilter();
  });

  it('should produce complete RFC 9457 response for simple exception', () => {
    const exception = new BadRequestException('Invalid input');
    filter.catch(exception, mockArgumentsHost);

    assert.deepEqual(sentResponse, {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid input',
      instance: '/api/test',
      errors: [],
    });
  });

  it('should produce complete RFC 9457 response with all optional fields', () => {
    const exception = new BadRequestException({
      type: 'validation-error',
      label: 'Form Validation Failed',
      detail: 'Please correct the errors below',
      errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ],
    });
    filter.catch(exception, mockArgumentsHost);

    assert.deepEqual(sentResponse, {
      type: 'validation-error',
      title: 'Bad Request',
      status: 400,
      label: 'Form Validation Failed',
      detail: 'Please correct the errors below',
      instance: '/api/test',
      errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ],
    });
  });

  it('should work with all concrete exception classes', () => {
    const testCases = [
      { exception: new BadRequestException('test'), status: 400, title: 'Bad Request' },
      { exception: new UnauthorizedException('test'), status: 401, title: 'Unauthorized' },
      { exception: new ForbiddenException('test'), status: 403, title: 'Forbidden' },
      { exception: new NotFoundException('test'), status: 404, title: 'Not Found' },
      { exception: new ConflictException('test'), status: 409, title: 'Conflict' },
      { exception: new UnprocessableEntityException('test'), status: 422, title: 'Unprocessable Entity' },
      { exception: new TooManyRequestsException('test'), status: 429, title: 'Too Many Requests' },
      {
        exception: new InternalServerErrorException('test'),
        status: 500,
        title: 'Internal Server Error',
      },
      { exception: new BadGatewayException('test'), status: 502, title: 'Bad Gateway' },
      { exception: new ServiceUnavailableException('test'), status: 503, title: 'Service Unavailable' },
    ];

    for (const { exception, status, title } of testCases) {
      sentResponse = null as any;
      filter.catch(exception, mockArgumentsHost);

      assert.equal(sentResponse.status, status);
      assert.equal(sentResponse.title, title);
      assert.ok('type' in sentResponse);
      assert.ok('detail' in sentResponse);
      assert.ok('instance' in sentResponse);
      assert.ok('errors' in sentResponse);
    }
  });
});
