import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { HttpStatus } from '@nestjs/common';
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

describe('Exception Classes - 3 Parameter Support', () => {
  describe('BadRequestException', () => {
    it('should support 1 parameter - general message', () => {
      const exception = new BadRequestException('Something went wrong');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.deepEqual(response.errors, [{ message: 'Something went wrong' }]);
      assert.equal(response.detail, undefined);
    });

    it('should support 2 parameters - field + message', () => {
      const exception = new BadRequestException('email', 'Invalid email');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.deepEqual(response.errors, [{ field: 'email', message: 'Invalid email' }]);
      assert.equal(response.detail, undefined);
    });

    it('should support 3 parameters - field + message + detail', () => {
      const exception = new BadRequestException('email', 'Invalid email', 'Please enter a valid email address');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.deepEqual(response.errors, [{ field: 'email', message: 'Invalid email' }]);
      assert.equal(response.detail, 'Please enter a valid email address');
    });

    it('should support array of FieldError objects', () => {
      const exception = new BadRequestException([
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Password too short' },
      ]);
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.equal(response.errors.length, 2);
      assert.equal(response.errors[0].field, 'email');
      assert.equal(response.errors[1].field, 'password');
      assert.equal(response.detail, undefined);
    });

    it('should support array + detail', () => {
      const exception = new BadRequestException([{ field: 'email', message: 'Invalid' }], 'Please check your input');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.equal(response.errors.length, 1);
      assert.equal(response.detail, 'Please check your input');
    });
  });

  describe('UnauthorizedException', () => {
    it('should support all parameter patterns', () => {
      const ex1 = new UnauthorizedException('Authentication required');
      assert.equal(ex1.getStatus(), HttpStatus.UNAUTHORIZED);

      const ex2 = new UnauthorizedException('token', 'Invalid token');
      assert.equal(ex2.getStatus(), HttpStatus.UNAUTHORIZED);

      const ex3 = new UnauthorizedException('token', 'Invalid token', 'Please login again');
      const response = ex3.getResponse() as any;
      assert.equal(ex3.getStatus(), HttpStatus.UNAUTHORIZED);
      assert.equal(response.detail, 'Please login again');
    });
  });

  describe('ForbiddenException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new ForbiddenException('resource', 'Access denied', 'Admin role required');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.FORBIDDEN);
      assert.deepEqual(response.errors, [{ field: 'resource', message: 'Access denied' }]);
      assert.equal(response.detail, 'Admin role required');
    });
  });

  describe('NotFoundException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new NotFoundException('userId', 'User not found', 'No user exists with the provided ID');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.NOT_FOUND);
      assert.deepEqual(response.errors, [{ field: 'userId', message: 'User not found' }]);
      assert.equal(response.detail, 'No user exists with the provided ID');
    });
  });

  describe('ConflictException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new ConflictException('email', 'Email already exists', 'Try logging in instead');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.CONFLICT);
      assert.deepEqual(response.errors, [{ field: 'email', message: 'Email already exists' }]);
      assert.equal(response.detail, 'Try logging in instead');
    });
  });

  describe('InternalServerErrorException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new InternalServerErrorException('database', 'Connection failed', 'Please try again later');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.INTERNAL_SERVER_ERROR);
      assert.deepEqual(response.errors, [{ field: 'database', message: 'Connection failed' }]);
      assert.equal(response.detail, 'Please try again later');
    });
  });

  describe('ValidationException', () => {
    it('should support array of errors with optional detail', () => {
      const exception = new ValidationException(
        [{ field: 'email', message: 'Invalid format' }],
        'Please correct the errors and try again',
      );
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.equal(response.errors.length, 1);
      assert.equal(response.detail, 'Please correct the errors and try again');
    });
  });

  describe('UnprocessableEntityException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new UnprocessableEntityException('quantity', 'Insufficient stock', 'Only 5 items available');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.UNPROCESSABLE_ENTITY);
      assert.deepEqual(response.errors, [{ field: 'quantity', message: 'Insufficient stock' }]);
      assert.equal(response.detail, 'Only 5 items available');
    });
  });

  describe('TooManyRequestsException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new TooManyRequestsException('api', 'Rate limit exceeded', 'Try again in 60 seconds');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      assert.deepEqual(response.errors, [{ field: 'api', message: 'Rate limit exceeded' }]);
      assert.equal(response.detail, 'Try again in 60 seconds');
    });
  });

  describe('ServiceUnavailableException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new ServiceUnavailableException('service', 'Maintenance', 'Service will be back at 2 PM EST');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.SERVICE_UNAVAILABLE);
      assert.deepEqual(response.errors, [{ field: 'service', message: 'Maintenance' }]);
      assert.equal(response.detail, 'Service will be back at 2 PM EST');
    });
  });

  describe('MethodNotAllowedException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new MethodNotAllowedException('method', 'Not allowed', 'Only GET and PUT are supported');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.METHOD_NOT_ALLOWED);
      assert.deepEqual(response.errors, [{ field: 'method', message: 'Not allowed' }]);
      assert.equal(response.detail, 'Only GET and PUT are supported');
    });
  });

  describe('GoneException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new GoneException('account', 'Deleted', 'This account was removed on user request');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.GONE);
      assert.deepEqual(response.errors, [{ field: 'account', message: 'Deleted' }]);
      assert.equal(response.detail, 'This account was removed on user request');
    });
  });

  describe('NotAcceptableException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new NotAcceptableException('accept', 'Format not supported', 'Only JSON is available');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.NOT_ACCEPTABLE);
      assert.deepEqual(response.errors, [{ field: 'accept', message: 'Format not supported' }]);
      assert.equal(response.detail, 'Only JSON is available');
    });
  });

  describe('RequestTimeoutException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new RequestTimeoutException('query', 'Database query timeout', 'Try with fewer filters');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.REQUEST_TIMEOUT);
      assert.deepEqual(response.errors, [{ field: 'query', message: 'Database query timeout' }]);
      assert.equal(response.detail, 'Try with fewer filters');
    });
  });

  describe('PayloadTooLargeException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new PayloadTooLargeException('file', 'File too large', 'Maximum size is 10MB');
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.PAYLOAD_TOO_LARGE);
      assert.deepEqual(response.errors, [{ field: 'file', message: 'File too large' }]);
      assert.equal(response.detail, 'Maximum size is 10MB');
    });
  });

  describe('UnsupportedMediaTypeException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new UnsupportedMediaTypeException(
        'contentType',
        'Not supported',
        'Only JSON and form-data are accepted',
      );
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      assert.deepEqual(response.errors, [{ field: 'contentType', message: 'Not supported' }]);
      assert.equal(response.detail, 'Only JSON and form-data are accepted');
    });
  });

  describe('NotImplementedException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new NotImplementedException(
        'export',
        'Not implemented',
        'PDF export will be available in v2.0',
      );
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.NOT_IMPLEMENTED);
      assert.deepEqual(response.errors, [{ field: 'export', message: 'Not implemented' }]);
      assert.equal(response.detail, 'PDF export will be available in v2.0');
    });
  });

  describe('BadGatewayException', () => {
    it('should support 3 parameters with detail', () => {
      const exception = new BadGatewayException(
        'proxy',
        'Gateway error',
        'Payment service is not responding correctly',
      );
      const response = exception.getResponse() as any;

      assert.equal(exception.getStatus(), HttpStatus.BAD_GATEWAY);
      assert.deepEqual(response.errors, [{ field: 'proxy', message: 'Gateway error' }]);
      assert.equal(response.detail, 'Payment service is not responding correctly');
    });
  });
});
