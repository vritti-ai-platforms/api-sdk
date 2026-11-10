import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TableState } from '../table-state.types';

export class TableResponseDto<T> {
  @ApiProperty()
  result: T[];

  @ApiProperty()
  count: number;

  @ApiProperty()
  state: TableState;

  @ApiPropertyOptional({ nullable: true })
  activeViewId: string | null;
}
