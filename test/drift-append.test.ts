import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import { routes } from '../src/routes';
import { checkContract, ContractRow } from '../src/check';
import * as resolveMod from '../src/resolve';
import * as dbMod from '../src/db';
import * as signMod from '../src/sign';
import { rpcBudget } from '../src/budget';

vi.mock('../src/db');
vi.mock('../src/resolve');
vi.mock('../src/sign');

describe('drift records are append-only', () => {
  let server: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    rpcBudget.reset();
    server = fastify();
    await server.register(routes);
  });

  it('two sequential checks against a still-drifted contract each insert a new record, neither overwritten', async () => {
    const contract: ContractRow = {
      contract_id: 'CDRIFT',
      verified_wasm_hash: 'hash1',
      network: 'testnet',
      consecutive_failures: 0,
      check_interval_seconds: 60,
      status: 'active'
    };

    vi.mocked(resolveMod.resolveWasmHash).mockResolvedValue('hash2');
    vi.mocked(signMod.signRecord).mockReturnValueOnce('sig-a').mockReturnValueOnce('sig-b');
    vi.mocked(signMod.getWatcherId).mockReturnValue('watcher1');

    const inserted: any[] = [];
    const clientMock = {
      query: vi.fn(async (text: string, params?: any[]) => {
        if (typeof text === 'string' && text.includes('INSERT INTO drift_records')) {
          inserted.push(params);
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn()
    };
    vi.mocked(dbMod.pool).connect = vi.fn().mockResolvedValue(clientMock) as any;

    // First drift: still shows verified_wasm_hash unchanged, so a second
    // check against the same contract state produces a second, independent record.
    await checkContract(contract);
    await checkContract(contract);

    expect(inserted).toHaveLength(2);
    const [firstId, , firstPrev, firstCurrent] = inserted[0];
    const [secondId, , secondPrev, secondCurrent] = inserted[1];

    expect(firstId).not.toEqual(secondId);
    expect(firstPrev).toBe('hash1');
    expect(secondPrev).toBe('hash1');
    expect(firstCurrent).toBe('hash2');
    expect(secondCurrent).toBe('hash2');

    // Now verify the real, now-implemented GET /drift/:wasmHash route
    // surfaces both appended records rather than a single overwritten one.
    vi.mocked(dbMod.query).mockResolvedValue({
      rows: [
        { id: firstId, contract_id: 'CDRIFT', previous_wasm_hash: 'hash1', current_wasm_hash: 'hash2', watcher_id: 'watcher1', signature: 'sig-a' },
        { id: secondId, contract_id: 'CDRIFT', previous_wasm_hash: 'hash1', current_wasm_hash: 'hash2', watcher_id: 'watcher1', signature: 'sig-b' }
      ],
      rowCount: 2
    } as any);

    const response = await server.inject({
      method: 'GET',
      url: '/drift/hash1'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveLength(2);
    expect(body.map((r: any) => r.id).sort()).toEqual([firstId, secondId].sort());
  });
});
