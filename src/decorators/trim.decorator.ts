import { Transform } from 'class-transformer';

export interface TrimOptions {
  nullify?: boolean;
}

// Trims a string field; by default converts a blank result ('') to null. Leaves non-strings
// (undefined stays undefined → skip, null stays null → clear) untouched, preserving update semantics.
export function Trim(options?: TrimOptions): PropertyDecorator {
  const nullify = options?.nullify ?? true;
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return nullify ? trimmed || null : trimmed;
  });
}
