import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PatchTableStateDto } from '../dto/request/patch-table-state.dto';
import { PutTableStateDto } from '../dto/request/put-table-state.dto';

export function ApiPutTableState() {
  return applyDecorators(
    ApiOperation({
      summary: 'Replace saved table state',
      description:
        'Stores the current filter, sort, and column visibility state in Redis cache. Called whenever the table state changes. `filters` is `{ panel, context }`. State expires after TABLE_STATE_CACHE_TTL seconds.',
    }),
    ApiBody({ type: PutTableStateDto }),
    ApiResponse({ status: 200, description: 'Live state cached.' }),
    ApiResponse({ status: 400, description: 'Invalid request body.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}

export function ApiPatchTableState() {
  return applyDecorators(
    ApiOperation({
      summary: 'Set saved table context',
      description:
        'Puts context conditions into the saved table state (`filters.context`), each replacing the stored condition on its field, and keeps everything else — panel filters, sort, columns and the active view. A link calls it before opening a table, so the table opens at that context. A table with no stored state starts from the empty one.',
    }),
    ApiBody({ type: PatchTableStateDto }),
    ApiResponse({ status: 200, description: 'Context set.' }),
    ApiResponse({ status: 400, description: 'Invalid request body.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}
