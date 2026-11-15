export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isAnyOf'
  | 'isNotAnyOf'
  | 'between';

export const FilterOperators = {
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IS_ANY_OF: 'isAnyOf',
  IS_NOT_ANY_OF: 'isNotAnyOf',
  BETWEEN: 'between',
} as const satisfies Record<string, FilterOperator>;

// A money amount a filter compares against: major units as a decimal string, in a currency
export interface FilterCurrencyValue {
  currency: string;
  value: string;
}

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | number | string[] | FilterCurrencyValue;
}

// True for a well-formed money amount: a three-letter currency code and a decimal amount string
export function isFilterCurrencyValue(value: unknown): value is FilterCurrencyValue {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const { currency, value: amount } = value as Partial<FilterCurrencyValue>;
  return (
    typeof currency === 'string' &&
    /^[A-Z]{3}$/.test(currency) &&
    typeof amount === 'string' &&
    /^-?\d+(\.\d+)?$/.test(amount)
  );
}

export interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchState {
  columnId: string;
  value: string;
}
