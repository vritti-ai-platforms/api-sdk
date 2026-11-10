import { createHmac, timingSafeEqual } from 'node:crypto';
import { InvalidCursorException } from '../../exceptions';

type SerializedValue = { __t: 'date'; v: string } | string | number | boolean | null;

interface CursorEnvelope {
  s: string;
  v: SerializedValue[];
}

const CURSOR_SECRET = process.env.KEYSET_CURSOR_SECRET ?? 'vritti-dev-insecure-keyset-secret';

function sign(body: string): string {
  return createHmac('sha256', CURSOR_SECRET).update(body).digest('base64url');
}

export class CursorCodec {
  // Encodes ORDER BY boundary values into a tamper-evident base64url token bound to the sort signature.
  static encode(values: unknown[], signature = ''): string {
    const serialized = values.map<SerializedValue>((v) => {
      if (v instanceof Date) return { __t: 'date', v: v.toISOString() };
      if (v === null || v === undefined) return null;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
      return String(v);
    });
    const envelope: CursorEnvelope = { s: signature, v: serialized };
    const body = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
    return `${body}.${sign(body)}`;
  }

  // Decodes a cursor back into ordered boundary values, throwing InvalidCursorException on any tamper or sort mismatch.
  static decode(cursor: string, expectedSignature = ''): unknown[] {
    const dot = cursor.lastIndexOf('.');
    if (dot <= 0) throw new InvalidCursorException('Malformed pagination cursor.');
    const body = cursor.slice(0, dot);
    const mac = cursor.slice(dot + 1);

    // Integrity: constant-time compare against the recomputed HMAC.
    const macBuf = Buffer.from(mac, 'base64url');
    const expBuf = Buffer.from(sign(body), 'base64url');
    if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) {
      throw new InvalidCursorException('Pagination cursor failed its integrity check.');
    }

    let envelope: CursorEnvelope;
    try {
      envelope = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CursorEnvelope;
    } catch {
      throw new InvalidCursorException('Pagination cursor could not be parsed.');
    }
    if (!envelope || typeof envelope.s !== 'string' || !Array.isArray(envelope.v)) {
      throw new InvalidCursorException('Pagination cursor has an unexpected shape.');
    }
    if (envelope.s !== expectedSignature) {
      throw new InvalidCursorException('Pagination cursor does not match the current sort order.');
    }
    return envelope.v.map((v) => {
      if (v && typeof v === 'object' && '__t' in v && v.__t === 'date') return new Date(v.v);
      return v;
    });
  }
}
