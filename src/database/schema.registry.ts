import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type SchemaRegistry = {};

export type RegisteredSchema = SchemaRegistry extends { schema: infer S } ? S : Record<string, unknown>;

export type TypedDrizzleClient = NodePgDatabase<RegisteredSchema>;
