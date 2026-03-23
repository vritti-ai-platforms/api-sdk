import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireSession } from '../../../auth/decorators/require-session.decorator';
import { UserId } from '../../../auth/decorators/user-id.decorator';
import { ApiCreateDataTableView, ApiDeleteDataTableView, ApiListDataTableViews, ApiRenameDataTableView, ApiToggleShareDataTableView, ApiUpdateDataTableView } from '../docs/data-table-views.docs';
import { DataTableViewDto } from '../dto/entity/data-table-view.dto';
import { CreateDataTableViewDto } from '../dto/request/create-data-table-view.dto';
import { RenameDataTableViewDto } from '../dto/request/rename-data-table-view.dto';
import { ToggleShareDataTableViewDto } from '../dto/request/toggle-share-data-table-view.dto';
import { UpdateDataTableViewDto } from '../dto/request/update-data-table-view.dto';
import { DataTableViewsService } from '../services/data-table-views.service';

@ApiTags('Table Views')
@ApiBearerAuth()
@RequireSession('CLOUD', 'ADMIN')
@Controller('table-views')
export class DataTableViewsController {
  private readonly logger = new Logger(DataTableViewsController.name);

  constructor(private readonly dataTableViewsService: DataTableViewsService) {}

  // Returns all named views for the given table — own plus shared
  @Get()
  @ApiListDataTableViews()
  findViews(@UserId() userId: string, @Query('tableSlug') tableSlug: string): Promise<DataTableViewDto[]> {
    this.logger.log(`GET /table-views?tableSlug=${tableSlug} - User: ${userId}`);
    return this.dataTableViewsService.findViews(userId, tableSlug);
  }

  // Creates a named snapshot of the current table state
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateDataTableView()
  createView(@UserId() userId: string, @Body() dto: CreateDataTableViewDto): Promise<DataTableViewDto> {
    this.logger.log(`POST /table-views - User: ${userId}, table: ${dto.tableSlug}`);
    return this.dataTableViewsService.createView(userId, dto);
  }

  // Updates state of an existing named view
  @Patch(':id')
  @ApiUpdateDataTableView()
  updateView(@UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateDataTableViewDto): Promise<DataTableViewDto> {
    this.logger.log(`PATCH /table-views/${id} - User: ${userId}`);
    return this.dataTableViewsService.updateView(userId, id, dto);
  }

  // Renames an existing named view — enforces unique name per user+table
  @Patch(':id/rename')
  @ApiRenameDataTableView()
  renameView(@UserId() userId: string, @Param('id') id: string, @Body() dto: RenameDataTableViewDto): Promise<DataTableViewDto> {
    this.logger.log(`PATCH /table-views/${id}/rename - User: ${userId}`);
    return this.dataTableViewsService.renameView(userId, id, dto.name);
  }

  // Toggles sharing visibility of a named view
  @Patch(':id/share')
  @ApiToggleShareDataTableView()
  toggleShareView(@UserId() userId: string, @Param('id') id: string, @Body() dto: ToggleShareDataTableViewDto): Promise<DataTableViewDto> {
    this.logger.log(`PATCH /table-views/${id}/share - User: ${userId}`);
    return this.dataTableViewsService.toggleShareView(userId, id, dto.isShared);
  }

  // Deletes a named view owned by the authenticated user
  @Delete(':id')
  @ApiDeleteDataTableView()
  deleteView(@UserId() userId: string, @Param('id') id: string): Promise<DataTableViewDto> {
    this.logger.log(`DELETE /table-views/${id} - User: ${userId}`);
    return this.dataTableViewsService.deleteView(userId, id);
  }
}
