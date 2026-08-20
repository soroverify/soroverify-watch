import { pool, query } from './db';
import { resolveWasmHash } from './resolve';
import { signRecord, getWatcherId } from './sign';
import { config } from './config';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { rpcBudget } from './budget';

const logger = pino();

export interface ContractRow {
  contract_id: string;
  verified_wasm_hash: string;
  network: string;
  consecutive_failures: number;
  check_interval_seconds: number;
  status: string;
}

export async function checkContract(contract: ContractRow): Promise<void> {
  if (!rpcBudget.canConsume()) {
    return;
  }

  rpcBudget.consume();

  let currentWasmHash: string;
  try {
    currentWasmHash = await resolveWasmHash(contract.contract_id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ contractId: contract.contract_id, err: msg }, 'RPC call failed during check');
    
    const newFailures = contract.consecutive_failures + 1;
    const newStatus = newFailures >= 3 ? 'unreachable' : contract.status;
    
    await query(
      `UPDATE watched_contracts 
       SET consecutive_failures = $1, status = $2, last_checked_at = NOW() 
       WHERE contract_id = $3`,
      [newFailures, newStatus, contract.contract_id]
    );
    return;
  }

  if (currentWasmHash === contract.verified_wasm_hash) {
    const newInterval = Math.min(
      contract.check_interval_seconds * 2, 
      config.MAX_CHECK_INTERVAL_SECONDS
    );

    await query(
      `UPDATE watched_contracts 
       SET consecutive_failures = 0, status = 'active', last_checked_at = NOW(), check_interval_seconds = $1
       WHERE contract_id = $2`,
      [newInterval, contract.contract_id]
    );
    return;
  }

  logger.warn(
    { 
      contractId: contract.contract_id, 
      verifiedWasmHash: contract.verified_wasm_hash, 
      currentWasmHash 
    }, 
    'Contract has drifted'
  );

  const payload = JSON.stringify({
    contract_id: contract.contract_id,
    previous_wasm_hash: contract.verified_wasm_hash,
    current_wasm_hash: currentWasmHash
  });
  
  const signature = signRecord(payload);
  const recordId = uuidv4();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO drift_records 
       (id, contract_id, previous_wasm_hash, current_wasm_hash, watcher_id, signature) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [recordId, contract.contract_id, contract.verified_wasm_hash, currentWasmHash, getWatcherId(), signature]
    );

    await client.query(
      `UPDATE watched_contracts 
       SET consecutive_failures = 0, status = 'drifted', last_checked_at = NOW(), check_interval_seconds = $1
       WHERE contract_id = $2`,
      [config.DEFAULT_CHECK_INTERVAL_SECONDS, contract.contract_id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
