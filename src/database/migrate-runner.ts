import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export interface MigrateRunnerOptions {
  migrationsFolder: string;
  migrationsTable: string;
  schema: string;
  migrationSchema: string;
  // Folder of idempotent .sql files for database objects Drizzle cannot express — triggers,
  // trigger functions, views. Re-applied in filename order on every deploy, so a dropped object
  // heals itself; drop the folder once Drizzle Kit manages these entities natively.
  objectsFolder?: string;
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

// Replays every .sql file in the objects folder, in filename order, on the owner connection
async function applyObjects(pool: Pool, objectsFolder?: string): Promise<void> {
  if (!objectsFolder || !existsSync(objectsFolder)) return;

  const files = readdirSync(objectsFolder)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (files.length === 0) return;

  console.log(`[migrate] applying ${files.length} database object file(s) from ${objectsFolder}`);
  for (const file of files) {
    const sql = readFileSync(join(objectsFolder, file), 'utf8').trim();
    if (!sql) continue;
    try {
      await pool.query(sql);
      console.log(`[migrate]   ${file}`);
    } catch (error) {
      throw new Error(`object file ${file} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Applies Drizzle migrations as the owner, then idempotently grants the runtime app role schema access.
export async function runMigrationsAndGrants(options: MigrateRunnerOptions): Promise<void> {
  const directUrl = requiredEnv('PRIMARY_DB_DATABASE_DIRECT_URL');
  const dbSchema = options.schema;
  const migrationSchema = options.migrationSchema;
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

    // Before the grants, so GRANT EXECUTE ON ALL FUNCTIONS covers anything created here rather
    // than relying on ALTER DEFAULT PRIVILEGES ordering.
    await applyObjects(pool, options.objectsFolder);

    const schema = quoteIdent(dbSchema);
    const role = quoteIdent(appRole);
    console.log(`[migrate] granting ${dbSchema} privileges to ${appRole}`);

    // All statements are idempotent — safe on every deploy; ALTER DEFAULT PRIVILEGES auto-grants future objects.
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
