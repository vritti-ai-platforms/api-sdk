import { eq, gt, gte, lt, lte, ne, type SQL } from 'drizzle-orm';
import { BadRequestException } from '../exceptions/bad-request.exception';
import { type CurrencyCode, majorToMinor } from '../money/money';
import type { FilterCurrencyValue, FilterOperator } from './condition.types';

// A number filter on a money amount held in minor units of one currency, which is a SQL expression rather than a
// column a FieldMap can name. The filter's { currency, value } major-unit amount is converted with majorToMinor and
// compared exactly in minor units. An amount in another currency, one the currency can't hold, or an operator a number
// filter never sends is rejected (400) — ignoring it would return every row while the filter still reads as applied.
export function compareMoney(
  minorAmount: SQL,
  currencyCode: string,
): (value: FilterCurrencyValue, operator: FilterOperator) => SQL {
  return (value, operator) => {
    if (value.currency !== currencyCode) {
      throw new BadRequestException({
        label: 'Invalid Filter',
        detail: `The amount is in ${currencyCode}; a filter in ${value.currency} can't be compared with it.`,
      });
    }
    let target: bigint;
    try {
      target = majorToMinor(value.value, currencyCode as CurrencyCode, 'value');
    } catch {
      throw new BadRequestException({
        label: 'Invalid Filter',
        detail: `${value.value} is not an amount ${currencyCode} can hold.`,
      });
    }
    switch (operator) {
      case 'equals':
        return eq(minorAmount, target);
      case 'notEquals':
        return ne(minorAmount, target);
      case 'gt':
        return gt(minorAmount, target);
      case 'gte':
        return gte(minorAmount, target);
      case 'lt':
        return lt(minorAmount, target);
      case 'lte':
        return lte(minorAmount, target);
      default:
        throw new BadRequestException({
          label: 'Invalid Filter',
          detail: `An amount can't be filtered with "${operator}".`,
        });
    }
  };
}
