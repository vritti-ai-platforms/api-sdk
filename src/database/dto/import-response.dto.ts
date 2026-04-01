import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidatedRowDto {
  @ApiProperty({ example: 1 })
  index!: number;

  @ApiProperty({ example: { code: 'products', name: 'Products' } })
  data!: Record<string, string>;

  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiProperty({ example: ['Code already exists'] })
  errors!: string[];
}

export class ImportSummaryDto {
  @ApiProperty({ example: 10 })
  total!: number;

  @ApiProperty({ example: 8 })
  valid!: number;

  @ApiProperty({ example: 2 })
  invalid!: number;
}

export class ImportResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Import complete.' })
  message!: string;

  @ApiPropertyOptional({ example: 3 })
  created?: number;

  @ApiPropertyOptional({ example: 2 })
  updated?: number;

  @ApiPropertyOptional({ example: 1 })
  skipped?: number;

  @ApiPropertyOptional({ type: [ValidatedRowDto] })
  rows?: ValidatedRowDto[];

  @ApiPropertyOptional({ type: ImportSummaryDto })
  summary?: ImportSummaryDto;
}
