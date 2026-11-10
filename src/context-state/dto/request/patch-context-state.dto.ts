import { ApiProperty } from '@nestjs/swagger';
import { FilterConditionDto, MAX_CONDITIONS, STATE_SLUG_MESSAGE, STATE_SLUG_PATTERN } from '@vritti/api-sdk/conditions';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class PatchContextStateDto {
  @ApiProperty({ description: 'Unique slug identifying the view', example: 'commerce-le-inventory-item-price-graph' })
  @IsString()
  @MaxLength(200)
  @Matches(STATE_SLUG_PATTERN, { message: STATE_SLUG_MESSAGE })
  slug: string;

  @ApiProperty({
    type: [FilterConditionDto],
    description: 'Context conditions to set, each replacing the stored one on its field',
    example: [{ field: 'site', operator: 'equals', value: '01a1835b-abf5-78a6-ad65-966b842e5590' }],
  })
  @IsArray()
  @ArrayMaxSize(MAX_CONDITIONS)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  context: FilterConditionDto[];
}
