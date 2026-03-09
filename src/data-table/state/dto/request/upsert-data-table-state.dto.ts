import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { TableViewState } from '../../../../database/filter/filter.types';

export class UpsertDataTableStateDto {
  @ApiProperty({ description: 'Unique slug identifying the table', example: 'cloud-providers' })
  @IsString()
  @MaxLength(100)
  tableSlug!: string;

  @ApiProperty({ description: 'Full table view state including filters, sort, and column visibility' })
  @IsObject()
  state!: TableViewState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  activeViewId?: string | null;
}
