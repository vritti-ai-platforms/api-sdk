import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// Standardized query params for select dropdown option endpoints
export class SelectOptionsQueryDto {
  @ApiPropertyOptional({ description: 'Search term to filter by label', example: 'united' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Maximum number of results', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Comma-separated values to fetch specific options', example: '1,2,3' })
  @IsOptional()
  @IsString()
  values?: string;

  @ApiPropertyOptional({ description: 'Comma-separated IDs to exclude from results (already selected)', example: '5,10' })
  @IsOptional()
  @IsString()
  excludeIds?: string;

  @ApiPropertyOptional({ description: 'Column name for option value', example: 'id', default: 'id' })
  @IsOptional()
  @IsString()
  valueKey?: string;

  @ApiPropertyOptional({ description: 'Column name for option label', example: 'name', default: 'name' })
  @IsOptional()
  @IsString()
  labelKey?: string;

  @ApiPropertyOptional({ description: 'Column name for group ID', example: 'regionId' })
  @IsOptional()
  @IsString()
  groupIdKey?: string;
}
