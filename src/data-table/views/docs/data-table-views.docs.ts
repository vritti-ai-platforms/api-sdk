import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DataTableViewDto } from '../dto/entity/data-table-view.dto';
import { CreateDataTableViewDto } from '../dto/request/create-data-table-view.dto';
import { RenameDataTableViewDto } from '../dto/request/rename-data-table-view.dto';
import { ToggleShareDataTableViewDto } from '../dto/request/toggle-share-data-table-view.dto';
import { UpdateDataTableViewDto } from '../dto/request/update-data-table-view.dto';

export function ApiListDataTableViews() {
  return applyDecorators(
    ApiOperation({
      summary: 'List named table views',
      description: "Returns the authenticated user's own named views plus all shared views for the given table slug.",
    }),
    ApiQuery({
      name: 'tableSlug',
      description: 'Slug of the table to fetch views for',
      example: 'cloud-providers',
      required: true,
    }),
    ApiResponse({ status: 200, description: 'Named views retrieved.', type: [DataTableViewDto] }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}

export function ApiCreateDataTableView() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create named table view',
      description: 'Saves the current table state as a named view snapshot. The name must be unique per user+table.',
    }),
    ApiBody({ type: CreateDataTableViewDto }),
    ApiResponse({ status: 201, description: 'Named view created.', type: DataTableViewDto }),
    ApiResponse({ status: 400, description: 'Invalid request body.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
  );
}

export function ApiUpdateDataTableView() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update named table view',
      description: 'Updates the state of an existing named view. Only the owner can update.',
    }),
    ApiParam({ name: 'id', description: 'UUID of the table view to update' }),
    ApiBody({ type: UpdateDataTableViewDto }),
    ApiResponse({ status: 200, description: 'View updated.', type: DataTableViewDto }),
    ApiResponse({ status: 400, description: 'Validation failed or not owned by caller.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
    ApiResponse({ status: 404, description: 'View not found.' }),
  );
}

export function ApiRenameDataTableView() {
  return applyDecorators(
    ApiOperation({
      summary: 'Rename a named table view',
      description: 'Updates the display name of an existing view. The new name must be unique per user+table. Only the owner can rename.',
    }),
    ApiParam({ name: 'id', description: 'UUID of the table view to rename' }),
    ApiBody({ type: RenameDataTableViewDto }),
    ApiResponse({ status: 200, description: 'View renamed.', type: DataTableViewDto }),
    ApiResponse({ status: 400, description: 'Not owned by caller.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
    ApiResponse({ status: 404, description: 'View not found.' }),
    ApiResponse({ status: 409, description: 'A view with this name already exists.' }),
  );
}

export function ApiToggleShareDataTableView() {
  return applyDecorators(
    ApiOperation({
      summary: 'Toggle view sharing',
      description: 'Makes a view visible to all users (shared) or restricts it to the owner only (private). Only the owner can toggle sharing.',
    }),
    ApiParam({ name: 'id', description: 'UUID of the table view' }),
    ApiBody({ type: ToggleShareDataTableViewDto }),
    ApiResponse({ status: 200, description: 'Sharing status updated.', type: DataTableViewDto }),
    ApiResponse({ status: 400, description: 'Not owned by caller.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
    ApiResponse({ status: 404, description: 'View not found.' }),
  );
}

export function ApiDeleteDataTableView() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete named table view',
      description: 'Permanently deletes a named view. Only the owner can delete their own views.',
    }),
    ApiParam({ name: 'id', description: 'UUID of the table view to delete' }),
    ApiResponse({ status: 200, description: 'View deleted.', type: DataTableViewDto }),
    ApiResponse({ status: 400, description: 'Not owned by caller.' }),
    ApiResponse({ status: 401, description: 'Unauthorized.' }),
    ApiResponse({ status: 404, description: 'View not found.' }),
  );
}
