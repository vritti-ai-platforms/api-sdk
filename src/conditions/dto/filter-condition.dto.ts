import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, ValidateBy } from 'class-validator';
import {
  type FilterCondition,
  type FilterCurrencyValue,
  type FilterOperator,
  FilterOperators,
  isFilterCurrencyValue,
} from '../condition.types';
import { MAX_CONDITION_VALUES } from '../condition-limits';

const OPERATORS = Object.values(FilterOperators);

// Accepts what a condition can hold: one string or number, a list of up to MAX_CONDITION_VALUES strings, or a money
// amount as a { currency, value } pair
function IsConditionValue() {
  return ValidateBy({
    name: 'isConditionValue',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' ||
        typeof value === 'number' ||
        (Array.isArray(value) &&
          value.length <= MAX_CONDITION_VALUES &&
          value.every((entry) => typeof entry === 'string')) ||
        isFilterCurrencyValue(value),
      defaultMessage: () =>
        `value must be a string, a number, a list of at most ${MAX_CONDITION_VALUES} strings or a { currency, value } amount`,
    },
  });
}

export class FilterConditionDto implements FilterCondition {
  @ApiProperty({ description: 'Field the condition is on', example: 'site' })
  @IsString()
  @MaxLength(100)
  field: string;

  @ApiProperty({ description: 'How the value is compared', enum: OPERATORS, example: 'equals' })
  @IsIn(OPERATORS)
  operator: FilterOperator;

  @ApiProperty({
    description: 'One string or number, a list of strings (`isAnyOf`, `between`), or a money amount',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'array', items: { type: 'string' } },
      {
        type: 'object',
        properties: { currency: { type: 'string', example: 'INR' }, value: { type: 'string', example: '1000.00' } },
      },
    ],
    example: '01a1835b-abf5-78a6-ad65-966b842e5590',
  })
  @IsConditionValue()
  value: string | number | string[] | FilterCurrencyValue;
}
