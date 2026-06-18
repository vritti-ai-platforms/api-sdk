type SerializedValue = { __t: 'date'; v: string } | string | number | boolean | null;

export class CursorCodec {
  // Encodes ORDER BY boundary values (id tie-breaker last) into a base64url JSON string
  static encode(values: unknown[]): string {
    const serialized = values.map<SerializedValue>((v) => {
      if (v instanceof Date) return { __t: 'date', v: v.toISOString() };
      if (v === null || v === undefined) return null;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
      return String(v);
    });
    const json = JSON.stringify(serialized);
    return Buffer.from(json, 'utf8').toString('base64url');
  }

  // Decodes a cursor back into the ordered boundary values, rehydrating ISO strings as Dates
  static decode(cursor: string): unknown[] {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as SerializedValue[];
    return parsed.map((v) => {
      if (v && typeof v === 'object' && '__t' in v && v.__t === 'date') return new Date(v.v);
      return v;
    });
  }
}
