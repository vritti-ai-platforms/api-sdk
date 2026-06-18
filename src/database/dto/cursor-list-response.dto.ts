import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CursorListResponseDto<T> {
  @ApiProperty()
  items: T[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  @ApiProperty()
  hasMore: boolean;
}
