// Serializes a value as deterministic JSON: object keys recursively sorted, arrays keep their order
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

// Recursively rebuilds objects with sorted keys so JSON.stringify output is order-independent
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = sortKeysDeep(record[key]);
    return sorted;
  }
  return value;
}
