import { ApiProperty } from '@nestjs/swagger';
import { STATE_SLUG_MESSAGE, STATE_SLUG_PATTERN } from '@vritti/api-sdk/conditions';
import { IsString, Matches, MaxLength } from 'class-validator';

export class GetContextStateDto {
  @ApiProperty({ description: 'Unique slug identifying the view', example: 'commerce-le-inventory-item-price-graph' })
  @IsString()
  @MaxLength(200)
  @Matches(STATE_SLUG_PATTERN, { message: STATE_SLUG_MESSAGE })
  slug: string;
}
