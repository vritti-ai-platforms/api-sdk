import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Schema Registry Interface
 *
 * Projects augment this interface to register their Drizzle schema.
 * This enables type-safe db.query access without passing schema types everywhere.
 *
 * @example
 * // In your project's schema.registry.ts:
 * declare module '@vritti/api-sdk' {
 *   interface SchemaRegistry {
 *     schema: typeof import('./schema');
 *   }
 * }
 */
export type SchemaRegistry = {};

/**
 * Extracts the registered schema type.
 * Falls back to Record<string, unknown> if no schema is registered.
 */
export type RegisteredSchema = SchemaRegistry extends { schema: infer S } ? S : Record<string, unknown>;

/**
 * Type alias for the Drizzle database client with registered schema
 */
export type TypedDrizzleClient = NodePgDatabase<RegisteredSchema>;
