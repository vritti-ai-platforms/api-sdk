import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FilterCondition } from '@vritti/api-sdk/conditions';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { ApiGetContextState, ApiPatchContextState, ApiPutContextState } from '../docs/context-state.docs';
import { GetContextStateDto } from '../dto/request/get-context-state.dto';
import { PatchContextStateDto } from '../dto/request/patch-context-state.dto';
import { PutContextStateDto } from '../dto/request/put-context-state.dto';
import { ContextStateService } from '../services/context-state.service';

@ApiTags('Context States')
@ApiBearerAuth()
@Controller('context-states')
export class ContextStateController {
  private readonly logger = new Logger(ContextStateController.name);

  constructor(private readonly contextStateService: ContextStateService) {}

  // Returns the authenticated user's saved context for a view; none when nothing is saved
  @Get()
  @ApiGetContextState()
  async getContextState(
    @UserId() userId: string,
    @Query() query: GetContextStateDto,
  ): Promise<{ context: FilterCondition[] }> {
    this.logger.log(`GET /context-states - User: ${userId}, view: ${query.slug}`);
    return { context: await this.contextStateService.getContextState(userId, query.slug) };
  }

  // Replaces the authenticated user's saved context for a view
  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiPutContextState()
  putContextState(@UserId() userId: string, @Body() dto: PutContextStateDto): Promise<void> {
    this.logger.log(`PUT /context-states - User: ${userId}, view: ${dto.slug}`);
    return this.contextStateService.putContextState(userId, dto);
  }

  // Sets context conditions in the authenticated user's saved context for a view, keeping the rest
  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiPatchContextState()
  patchContextState(@UserId() userId: string, @Body() dto: PatchContextStateDto): Promise<void> {
    this.logger.log(`PATCH /context-states - User: ${userId}, view: ${dto.slug}`);
    return this.contextStateService.patchContextState(userId, dto);
  }
}
