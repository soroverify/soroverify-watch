import { query } from './db';
import { checkContract, ContractRow } from './check';
import { config } from './config';
import { rpcBudget } from './budget';
import pino from 'pino';

const logger = pino();
let timeoutId: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  
  try {
    rpcBudget.reset();

    // priority_score is computed as:
    // base score 1000
    // - penalize unreachable by 500
    // - apply exponential decay based on consecutive_failures
    // - add some priority for newly seen contracts
    const res = await query<ContractRow>(`
      SELECT *
      FROM watched_contracts
      WHERE status IN ('active', 'unreachable')
        AND (last_checked_at IS NULL OR last_checked_at + (check_interval_seconds || ' seconds')::interval <= NOW())
      ORDER BY (
        (CASE WHEN status = 'unreachable' THEN 0 ELSE 500 END)
        + (1000.0 / EXP(consecutive_failures))
        + EXTRACT(EPOCH FROM NOW() - first_seen_at) / 1000.0
      ) DESC
      LIMIT $1
    `, [config.RPC_CALLS_PER_TICK]);

    for (const row of res.rows) {
      if (!rpcBudget.canConsume()) break;
      await checkContract(row);
    }
  } catch (err: unknown) {
    logger.error(err, 'Error running scheduler tick');
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  logger.info({ interval: config.TICK_INTERVAL_SECONDS }, 'Starting scheduler loop');
  const tick = async () => {
    await runTick();
    timeoutId = setTimeout(tick, config.TICK_INTERVAL_SECONDS * 1000);
  };
  void tick();
}

export function stopScheduler(): void {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}
