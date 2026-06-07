import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Options for runMigrationsAndGrants — supplied by each app's thin migrate entry.
export interface MigrateRunnerOptions {
  // Absolute path to the Drizzle migrations folder (each app resolves this from its own dist).
  migrationsFolder: string;
  // Per-app migration bookkeeping table — must match the app's drizzle.config.ts.
  migrationsTable: string;
}

// Validates and quotes a Postgres identifier (role/schema names can't be bound as query params).
function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

// Reads a required environment variable or throws.
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

// Applies Drizzle migrations as the owner (PRIMARY_DB_DATABASE_DIRECT_URL), then idempotently
// grants the runtime app role (PRIMARY_DB_USERNAME) access to the schema. Intended to run as a
// release-phase one-shot before the application containers roll.
export async function runMigrationsAndGrants(options: MigrateRunnerOptions): Promise<void> {
  const directUrl = requiredEnv('PRIMARY_DB_DATABASE_DIRECT_URL');
  const dbSchema = requiredEnv('PRIMARY_DB_SCHEMA');
  const migrationSchema = requiredEnv('PRIMARY_DB_MIGRATION_SCHEMA');
  const appRole = requiredEnv('PRIMARY_DB_USERNAME');

  // Single connection as the owner role — runs both DDL and the grants below.
  const pool = new Pool({ connectionString: directUrl, max: 1 });
  const db = drizzle({ client: pool });

  try {
    console.log(`[migrate] applying migrations from ${options.migrationsFolder}`);
    await migrate(db, {
      migrationsFolder: options.migrationsFolder,
      migrationsTable: options.migrationsTable,
      migrationsSchema: migrationSchema,
    });

    const schema = quoteIdent(dbSchema);
    const role = quoteIdent(appRole);
    console.log(`[migrate] granting ${dbSchema} privileges to ${appRole}`);

    // All statements are idempotent — safe on every deploy. ALTER DEFAULT PRIVILEGES auto-grants
    // future tables/sequences/functions the owner creates. No-op when appRole equals the owner.
    await pool.query(`
      GRANT USAGE ON SCHEMA ${schema} TO ${role};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES   IN SCHEMA ${schema} TO ${role};
      GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role};
      GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role};
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO ${role};
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE, SELECT                  ON SEQUENCES TO ${role};
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT EXECUTE                        ON FUNCTIONS TO ${role};
    `);

    console.log('[migrate] done');
  } finally {
    await pool.end();
  }
}
