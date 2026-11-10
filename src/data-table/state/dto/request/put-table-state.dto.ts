import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { STATE_SLUG_MESSAGE, STATE_SLUG_PATTERN } from '@vritti/api-sdk/conditions';
import { IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { TableState } from '../../../table-state.types';

export class PutTableStateDto {
  @ApiProperty({ description: 'Unique slug identifying the table', example: 'cloud-providers' })
  @IsString()
  @MaxLength(200)
  @Matches(STATE_SLUG_PATTERN, { message: STATE_SLUG_MESSAGE })
  tableSlug: string;

  @ApiProperty({ description: 'Full table view state including filters, sort, and column visibility' })
  @IsObject()
  state: TableState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('7')
  activeViewId?: string | null;
}
