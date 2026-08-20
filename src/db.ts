import { Pool, QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS watched_contracts (
        contract_id TEXT PRIMARY KEY,
        verified_wasm_hash TEXT NOT NULL,
        network TEXT NOT NULL,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_checked_at TIMESTAMPTZ,
        check_interval_seconds INTEGER NOT NULL,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drift_records (
        id UUID PRIMARY KEY,
        contract_id TEXT NOT NULL,
        previous_wasm_hash TEXT NOT NULL,
        current_wasm_hash TEXT NOT NULL,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        watcher_id TEXT NOT NULL,
        signature TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_drift_records_previous_wasm_hash 
      ON drift_records (previous_wasm_hash);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
) {
  return pool.query<T>(text, params);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
