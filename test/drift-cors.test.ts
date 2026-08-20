import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import { routes } from '../src/routes';
import * as dbMod from '../src/db';

vi.mock('../src/db');
vi.mock('../src/resolve');
vi.mock('../src/verifier');
vi.mock('../src/sign');

describe('GET /drift/:wasmHash', () => {
  let server: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    server = fastify();
    await server.register(routes);
  });

  it('returns a matching drift record with the public CORS headers set', async () => {
    const record = {
      id: 'record-1',
      contract_id: 'CDRIFT',
      previous_wasm_hash: 'hash1',
      current_wasm_hash: 'hash2',
      detected_at: '2026-08-20T00:00:00.000Z',
      watcher_id: 'watcher1',
      signature: 'sig-a'
    };

    vi.mocked(dbMod.query).mockResolvedValue({ rows: [record], rowCount: 1 } as any);

    const response = await server.inject({
      method: 'GET',
      url: '/drift/hash1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['access-control-allow-methods']).toBe('GET');

    const body = JSON.parse(response.payload);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject(record);

    expect(dbMod.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE previous_wasm_hash = $1'),
      ['hash1']
    );
  });
});
