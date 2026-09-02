import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fastify from 'fastify';
import { routes } from '../src/routes';
import * as resolveMod from '../src/resolve';
import * as verifierMod from '../src/verifier';
import * as dbMod from '../src/db';

vi.mock('../src/resolve');
vi.mock('../src/verifier');
vi.mock('../src/db');

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

describe('watch manage token', () => {
  let server: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    server = fastify();
    await server.register(routes);
  });

  it('POST /watch stores only a hash of the manage token, never the plaintext', async () => {
    vi.mocked(resolveMod.resolveWasmHash).mockResolvedValue('hash1');
    vi.mocked(verifierMod.checkVerificationExists).mockResolvedValue(true);

    let insertedManageTokenHash: string | undefined;
    vi.mocked(dbMod.query).mockImplementation(async (text: string, params?: any[]) => {
      if (typeof text === 'string' && text.includes('INSERT INTO watched_contracts')) {
        insertedManageTokenHash = params?.[5];
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const response = await server.inject({
      method: 'POST',
      url: '/watch',
      payload: {
        contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        network: 'testnet'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(typeof body.manageToken).toBe('string');
    expect(body.manageToken.length).toBeGreaterThanOrEqual(32);

    // The value written to the database is a hash, never the plaintext token.
    expect(insertedManageTokenHash).toBeDefined();
    expect(insertedManageTokenHash).not.toEqual(body.manageToken);
    expect(insertedManageTokenHash).toEqual(sha256Hex(body.manageToken));
  });

  it('GET /watch/:contractId never re-exposes the manage token or its hash', async () => {
    vi.mocked(dbMod.query).mockResolvedValue({
      rows: [{
        contract_id: 'CGET',
        verified_wasm_hash: 'hash1',
        network: 'testnet',
        first_seen_at: '2026-08-20T00:00:00.000Z',
        last_checked_at: null,
        check_interval_seconds: 3600,
        consecutive_failures: 0,
        status: 'active'
      }],
      rowCount: 1
    } as any);

    const response = await server.inject({ method: 'GET', url: '/watch/CGET' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).not.toHaveProperty('manageToken');
    expect(body).not.toHaveProperty('manage_token_hash');

    // The route must not even select the hash column from the database.
    expect(dbMod.query).toHaveBeenCalledWith(
      expect.not.stringContaining('manage_token_hash'),
      ['CGET']
    );
  });

  describe('DELETE /watch/:contractId', () => {
    const token = 'correct-horse-battery-staple-token';
    const tokenHash = sha256Hex(token);

    it('retires the entry when the correct token is presented as a bearer token', async () => {
      vi.mocked(dbMod.query).mockImplementation(async (text: string) => {
        if (typeof text === 'string' && text.includes('SELECT manage_token_hash')) {
          return { rows: [{ manage_token_hash: tokenHash }], rowCount: 1 } as any;
        }
        if (typeof text === 'string' && text.includes('UPDATE watched_contracts')) {
          return { rows: [{ contract_id: 'CDEL' }], rowCount: 1 } as any;
        }
        return { rows: [], rowCount: 0 } as any;
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/watch/CDEL',
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ success: true });
    });

    it('returns 403 for a wrong token and leaves the entry untouched', async () => {
      let updateCalled = false;
      vi.mocked(dbMod.query).mockImplementation(async (text: string) => {
        if (typeof text === 'string' && text.includes('SELECT manage_token_hash')) {
          return { rows: [{ manage_token_hash: tokenHash }], rowCount: 1 } as any;
        }
        if (typeof text === 'string' && text.includes('UPDATE watched_contracts')) {
          updateCalled = true;
          return { rows: [{ contract_id: 'CDEL' }], rowCount: 1 } as any;
        }
        return { rows: [], rowCount: 0 } as any;
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/watch/CDEL',
        headers: { authorization: 'Bearer wrong-token' }
      });

      expect(response.statusCode).toBe(403);
      expect(updateCalled).toBe(false);

      // Confirm, via a subsequent GET, that the entry is still active.
      vi.mocked(dbMod.query).mockResolvedValue({
        rows: [{ contract_id: 'CDEL', status: 'active' }],
        rowCount: 1
      } as any);
      const getResponse = await server.inject({ method: 'GET', url: '/watch/CDEL' });
      expect(JSON.parse(getResponse.payload).status).toBe('active');
    });

    it('returns 403 for a missing token and leaves the entry untouched', async () => {
      let updateCalled = false;
      vi.mocked(dbMod.query).mockImplementation(async (text: string) => {
        if (typeof text === 'string' && text.includes('SELECT manage_token_hash')) {
          return { rows: [{ manage_token_hash: tokenHash }], rowCount: 1 } as any;
        }
        if (typeof text === 'string' && text.includes('UPDATE watched_contracts')) {
          updateCalled = true;
          return { rows: [{ contract_id: 'CDEL' }], rowCount: 1 } as any;
        }
        return { rows: [], rowCount: 0 } as any;
      });

      const response = await server.inject({ method: 'DELETE', url: '/watch/CDEL' });

      expect(response.statusCode).toBe(403);
      expect(updateCalled).toBe(false);
    });

    it('returns 404 for a contract that was never watched, without revealing wrong-token vs not-found', async () => {
      vi.mocked(dbMod.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const response = await server.inject({
        method: 'DELETE',
        url: '/watch/CNEVERWATCHED',
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).not.toMatch(/token/i);
    });
  });
});
