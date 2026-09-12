import type { ListQuery } from './schemas/common.schema';

// Narrows an in-memory list the way every list tool documents: substring match (case-insensitive) on the given string
// fields, then a cap. Catalog lists are small, so this keeps one output shape whether or not a query was given.
export function applyListQuery<T extends object>(items: T[], args: ListQuery, fields: Array<keyof T>): T[] {
  const needle = args.query?.trim().toLowerCase();
  const matched = needle
    ? items.filter((item) =>
        fields.some((field) => {
          const value = item[field];
          return typeof value === 'string' && value.toLowerCase().includes(needle);
        }),
      )
    : items;
  return args.limit ? matched.slice(0, args.limit) : matched;
}
