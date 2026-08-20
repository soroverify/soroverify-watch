import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkContract, ContractRow } from '../src/check';
import * as resolveMod from '../src/resolve';
import * as dbMod from '../src/db';
import * as signMod from '../src/sign';
import { rpcBudget } from '../src/budget';

vi.mock('../src/db');
vi.mock('../src/resolve');
vi.mock('../src/sign');

describe('checkContract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpcBudget.reset();
  });

  it('rpc failure never reports drift', async () => {
    const contract: ContractRow = {
      contract_id: 'C123',
      verified_wasm_hash: 'hash1',
      network: 'testnet',
      consecutive_failures: 0,
      check_interval_seconds: 60,
      status: 'active'
    };

    vi.mocked(resolveMod.resolveWasmHash).mockRejectedValue(new Error('RPC failed'));

    await checkContract(contract);

    expect(dbMod.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE watched_contracts'),
      [1, 'active', 'C123']
    );
    expect(dbMod.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO drift_records'),
      expect.anything()
    );
  });

  it('unreachable status transitions and recovery', async () => {
    const contract: ContractRow = {
      contract_id: 'C123',
      verified_wasm_hash: 'hash1',
      network: 'testnet',
      consecutive_failures: 2,
      check_interval_seconds: 60,
      status: 'active'
    };

    vi.mocked(resolveMod.resolveWasmHash).mockRejectedValue(new Error('RPC failed'));

    await checkContract(contract);

    expect(dbMod.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE watched_contracts'),
      [3, 'unreachable', 'C123']
    );

    // Recovery
    const contractUnreachable: ContractRow = {
      ...contract,
      consecutive_failures: 3,
      status: 'unreachable'
    };
    
    vi.mocked(resolveMod.resolveWasmHash).mockResolvedValue('hash1');
    
    await checkContract(contractUnreachable);

    expect(dbMod.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'active'"),
      [120, 'C123'] // 120 because interval doubles
    );
  });

  it('drift detection and record creation', async () => {
    const contract: ContractRow = {
      contract_id: 'C123',
      verified_wasm_hash: 'hash1',
      network: 'testnet',
      consecutive_failures: 0,
      check_interval_seconds: 60,
      status: 'active'
    };

    vi.mocked(resolveMod.resolveWasmHash).mockResolvedValue('hash2');
    vi.mocked(signMod.signRecord).mockReturnValue('sig123');
    vi.mocked(signMod.getWatcherId).mockReturnValue('watcher1');

    const clientMock = {
      query: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbMod.pool).connect = vi.fn().mockResolvedValue(clientMock) as any;

    await checkContract(contract);

    expect(clientMock.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO drift_records'),
      expect.arrayContaining(['C123', 'hash1', 'hash2', 'watcher1', 'sig123'])
    );
    
    expect(clientMock.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'drifted'"),
      expect.arrayContaining(['C123'])
    );
  });
});
