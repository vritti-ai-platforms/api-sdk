import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PatchContextStateDto } from '../dto/request/patch-context-state.dto';
import { PutContextStateDto } from '../dto/request/put-context-state.dto';

export function ApiGetContextState() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get saved view context',
      description:
        "Returns the authenticated user's saved context bar for a view as `{ context }` — the filter conditions the view's own endpoint reads. Empty when nothing is saved.",
    }),
    ApiQuery({ name: 'slug', description: 'Unique slug identifying the view', required: true }),
    ApiResponse({ status: 200, description: 'Saved context.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}

export function ApiPutContextState() {
  return applyDecorators(
    ApiOperation({
      summary: 'Replace saved view context',
      description:
        "Stores a view's whole context bar (a list of filter conditions) for the authenticated user in Redis. Views that are not tables — graphs, summaries — read their context from it. Expires after CONTEXT_STATE_CACHE_TTL seconds.",
    }),
    ApiBody({ type: PutContextStateDto }),
    ApiResponse({ status: 200, description: 'Context saved.' }),
    ApiResponse({ status: 400, description: 'Invalid request body.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}

export function ApiPatchContextState() {
  return applyDecorators(
    ApiOperation({
      summary: 'Set saved view context',
      description:
        "Puts context conditions into a view's saved context, each replacing the stored condition on its field, and keeps the rest — how a link opens a view at a context. A view with no saved context starts from none.",
    }),
    ApiBody({ type: PatchContextStateDto }),
    ApiResponse({ status: 200, description: 'Context set.' }),
    ApiResponse({ status: 400, description: 'Invalid request body.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}
