import { eq, gt, gte, lt, lte, ne, type SQL, sql } from 'drizzle-orm';
import type { FilterOperator } from './filter.types';

// A number filter on a correlated count, which is a subquery rather than a column a FieldMap can name. A value that is
// empty or not a number, or an operator a number filter never sends, matches everything rather than reaching SQL.
export function compareCount(count: SQL): (value: string | number, operator: FilterOperator) => SQL {
  return (value, operator) => {
    const target = Number(value);
    if (value === '' || !Number.isFinite(target)) return sql`true`;
    switch (operator) {
      case 'equals':
        return eq(count, target);
      case 'notEquals':
        return ne(count, target);
      case 'gt':
        return gt(count, target);
      case 'gte':
        return gte(count, target);
      case 'lt':
        return lt(count, target);
      case 'lte':
        return lte(count, target);
      default:
        return sql`true`;
    }
  };
}
