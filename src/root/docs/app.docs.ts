import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiHealthCheck() {
  return applyDecorators(
    ApiOperation({ summary: 'Health check endpoint' }),
    ApiResponse({
      status: 200,
      description: 'Returns a welcome message indicating the API is running',
      type: String,
    }),
  );
}
