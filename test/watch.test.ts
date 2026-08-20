import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import { watchRoutes } from '../src/watch';
import * as resolveMod from '../src/resolve';
import * as verifierMod from '../src/verifier';
import * as dbMod from '../src/db';

vi.mock('../src/resolve');
vi.mock('../src/verifier');
vi.mock('../src/db');

describe('watch endpoint', () => {
  let server: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    server = fastify();
    await server.register(watchRoutes);
  });

  it('rejects a contract with no existing verification', async () => {
    vi.mocked(resolveMod.resolveWasmHash).mockResolvedValue('hash1');
    vi.mocked(verifierMod.checkVerificationExists).mockResolvedValue(false);

    const response = await server.inject({
      method: 'POST',
      url: '/watch',
      payload: {
        contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        network: 'testnet'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: 'Contract not verified' });
    expect(dbMod.query).not.toHaveBeenCalled();
  });

  it('rejects a malformed contract id before making any RPC call', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/watch',
      payload: {
        contractId: 'invalid-id',
        network: 'testnet'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid contract ID' });
    expect(resolveMod.resolveWasmHash).not.toHaveBeenCalled();
  });

  it('accepts valid request', async () => {
    vi.mocked(resolveMod.resolveWasmHash).mockResolvedValue('hash1');
    vi.mocked(verifierMod.checkVerificationExists).mockResolvedValue(true);

    const response = await server.inject({
      method: 'POST',
      url: '/watch',
      payload: {
        contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        network: 'testnet'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(dbMod.query).toHaveBeenCalled();
  });
});
