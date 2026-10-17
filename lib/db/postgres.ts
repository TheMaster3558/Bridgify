import "server-only";
import { Pool } from "pg";

export interface Sql {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Sql {
  transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T>;
}

export function createPostgresDatabase(pool: Pool): Database {
  return {
    query: (text, values) => pool.query(text, values),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
  };
}
let database: Database | undefined;
export function getDatabase(): Database {
  if (database) return database;
  if (!process.env.DATABASE_URL) throw new Error("database_not_configured");
  database = createPostgresDatabase(new Pool({
    connectionString: process.env.DATABASE_URL, max: 5,
    connectionTimeoutMillis: 5000, statement_timeout: 10000,
    // TLS is controlled by the connection string, never rejectUnauthorized:false.
  }));
  return database;
}
