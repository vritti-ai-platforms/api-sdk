import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TableViewState } from '../filter/filter.types';

export class TableResponseDto<T> {
  @ApiProperty()
  result!: T[];

  @ApiProperty()
  count!: number;

  @ApiProperty()
  state!: TableViewState;

  @ApiPropertyOptional({ nullable: true })
  activeViewId!: string | null;
}
