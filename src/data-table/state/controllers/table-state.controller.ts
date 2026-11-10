import { Body, Controller, HttpCode, HttpStatus, Logger, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserId } from '../../../auth/decorators/user-id.decorator';
import { ApiPatchTableState, ApiPutTableState } from '../docs/table-state.docs';
import { PatchTableStateDto } from '../dto/request/patch-table-state.dto';
import { PutTableStateDto } from '../dto/request/put-table-state.dto';
import { TableStateService } from '../services/table-state.service';

@ApiTags('Table States')
@ApiBearerAuth()
@Controller('table-states')
export class TableStateController {
  private readonly logger = new Logger(TableStateController.name);

  constructor(private readonly tableStateService: TableStateService) {}

  // Replaces the authenticated user's saved state for a table
  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiPutTableState()
  putTableState(@UserId() userId: string, @Body() dto: PutTableStateDto): Promise<void> {
    this.logger.log(`PUT /table-states - User: ${userId}, table: ${dto.tableSlug}`);
    return this.tableStateService.putTableState(userId, dto);
  }

  // Sets context conditions in the authenticated user's saved state for a table, keeping the rest of it
  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiPatchTableState()
  patchTableState(@UserId() userId: string, @Body() dto: PatchTableStateDto): Promise<void> {
    this.logger.log(`PATCH /table-states - User: ${userId}, table: ${dto.tableSlug}`);
    return this.tableStateService.patchTableState(userId, dto);
  }
}
