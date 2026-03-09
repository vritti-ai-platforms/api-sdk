import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserId } from '../../../auth/decorators/user-id.decorator';
import { ApiUpsertDataTableState } from '../docs/data-table-state.docs';
import { UpsertDataTableStateDto } from '../dto/request/upsert-data-table-state.dto';
import { DataTableStateService } from '../services/data-table-state.service';

@ApiTags('Table States')
@ApiBearerAuth()
@Controller('table-states')
export class DataTableStateController {
  private readonly logger = new Logger(DataTableStateController.name);

  constructor(private readonly dataTableStateService: DataTableStateService) {}

  // Saves live table state to Redis cache for the authenticated user's table
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiUpsertDataTableState()
  upsertCurrentState(@UserId() userId: string, @Body() dto: UpsertDataTableStateDto): Promise<void> {
    this.logger.log(`POST /table-states - User: ${userId}, table: ${dto.tableSlug}`);
    return this.dataTableStateService.upsertCurrentState(userId, dto);
  }
}
