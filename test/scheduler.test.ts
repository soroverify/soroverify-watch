import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTick } from '../src/scheduler';
import * as dbMod from '../src/db';
import * as checkMod from '../src/check';
import { rpcBudget } from '../src/budget';

vi.mock('../src/db');
vi.mock('../src/check');

describe('scheduler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpcBudget.reset();
  });

  it('never exceeds RPC_CALLS_PER_TICK in a single tick', async () => {
    const rows = Array(15).fill(0).map((_, i) => ({
      contract_id: `C${i}`,
      verified_wasm_hash: 'hash1',
      network: 'testnet',
      consecutive_failures: 0,
      check_interval_seconds: 60,
      status: 'active'
    }));

    vi.mocked(dbMod.query).mockResolvedValue({ rows, rowCount: rows.length } as any);

    // Consume all budget inside checkContract mock
    vi.mocked(checkMod.checkContract).mockImplementation(async () => {
      rpcBudget.consume();
    });

    await runTick();

    // Default budget is 10
    expect(checkMod.checkContract).toHaveBeenCalledTimes(10);
  });
});
