import type { FilterCondition } from './condition.types';

// Returns the single value set on a field, or undefined when the field is absent or holds a list
export function conditionValue(conditions: FilterCondition[], field: string): string | undefined {
  const value = conditions.find((condition) => condition.field === field)?.value;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

// Returns every value set on a field — a list as it is, a single value as a list of one, an absent field as none
export function conditionValues(conditions: FilterCondition[], field: string): string[] {
  const value = conditions.find((condition) => condition.field === field)?.value;
  if (value == null || value === '') return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

// Keeps one condition per field — the last one sent — in the order the fields first appear
export function lastPerField(conditions: FilterCondition[]): FilterCondition[] {
  const byField = new Map<string, FilterCondition>();
  for (const condition of conditions) byField.set(condition.field, condition);
  return [...byField.values()];
}

// Applies a patch to stored conditions: each patched field's condition replaces the stored one, the other stored
// fields stay. A field the patch repeats keeps its last condition.
export function mergeByField(stored: FilterCondition[], patch: FilterCondition[]): FilterCondition[] {
  const patched = lastPerField(patch);
  const patchedFields = new Set(patched.map((condition) => condition.field));
  return [...stored.filter((condition) => !patchedFields.has(condition.field)), ...patched];
}
