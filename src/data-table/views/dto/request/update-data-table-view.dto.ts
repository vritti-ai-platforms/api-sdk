import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import type { TableViewState } from '../../../../database/filter/filter.types';

// State-only update — name, tableSlug, and isShared are not updatable via this DTO
export class UpdateDataTableViewDto {
  @ApiProperty({ description: 'Updated filter, sort, and column visibility state' })
  @IsObject()
  state!: TableViewState;
}
