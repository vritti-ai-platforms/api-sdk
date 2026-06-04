import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Drizzle 1.0: NodePgDatabase's generic is `TRelations extends AnyRelations` (not schema).
// Apps pass their own relations via DatabaseModuleOptions.drizzleRelations when they need
// `db.query.X`; without that, raw `db.select()` (used by PrimaryBaseRepository) still works.
export type TypedDrizzleClient = NodePgDatabase;
