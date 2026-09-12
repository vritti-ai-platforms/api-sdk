import { z } from 'zod';

// Input fragments every server's tools share. Server-specific ids (a version, a business) live with the server.

// A reference to an entity by UUID or by its code — tools accept either so a model can work from names
export const entityRefSchema = z
  .object({
    id: z.string().uuid().optional().describe('UUID of the entity'),
    code: z.string().min(1).optional().describe('Code of the entity, resolved within the surrounding scope'),
  })
  .refine((ref) => Boolean(ref.id || ref.code), { message: 'Provide id or code' });
export type EntityRef = z.infer<typeof entityRefSchema>;

export const idSchema = z.string().uuid().describe('Entity UUID');

export const dryRunSchema = z
  .boolean()
  .optional()
  .describe('When true, validate and report what would change without writing anything');

export const confirmSchema = z
  .boolean()
  .optional()
  .describe(
    'Required (true) for changes that are hard to undo — a production version, a deletion, a push to live systems',
  );

// The optional narrowing every list tool offers: a case-insensitive match on the record's name-like fields, then a cap
export const listQueryShape = {
  query: z.string().optional().describe('Case-insensitive match on name, code or label'),
  limit: z.number().int().min(1).max(200).optional().describe('Return at most this many (default: all)'),
};
export type ListQuery = { query?: string; limit?: number };
