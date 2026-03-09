import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpsertDataTableStateDto } from '../dto/request/upsert-data-table-state.dto';

export function ApiUpsertDataTableState() {
  return applyDecorators(
    ApiOperation({
      summary: 'Save live table state',
      description:
        'Stores the current filter, sort, and column visibility state in Redis cache. Called on filter Apply and sort column click. State expires after TABLE_STATE_CACHE_TTL seconds.',
    }),
    ApiBody({ type: UpsertDataTableStateDto }),
    ApiResponse({ status: 200, description: 'Live state cached.' }),
    ApiResponse({ status: 400, description: 'Invalid request body.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}
