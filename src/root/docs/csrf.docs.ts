import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiGetCsrfToken() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get CSRF token',
      description:
        'Generates and returns a CSRF token that must be included in all state-changing requests (POST, PUT, PATCH, DELETE). The token should be sent in the X-CSRF-Token header.',
    }),
    ApiResponse({
      status: 200,
      description: 'CSRF token generated successfully',
      schema: {
        type: 'object',
        properties: {
          csrfToken: {
            type: 'string',
            description: 'The CSRF token to use in subsequent requests',
            example: 'abc123xyz789',
          },
        },
        required: ['csrfToken'],
      },
    }),
  );
}
