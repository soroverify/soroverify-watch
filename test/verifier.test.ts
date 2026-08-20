import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkVerificationExists } from '../src/verifier';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('checkVerificationExists', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for a 200 response with status: unverified', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { wasmHash: 'hash1', status: 'unverified', results: [], sources: [] })
    );

    await expect(checkVerificationExists('hash1')).resolves.toBe(false);
  });

  it('returns false for a 200 response with status: inconclusive', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { wasmHash: 'hash1', status: 'inconclusive', results: [], sources: [] })
    );

    await expect(checkVerificationExists('hash1')).resolves.toBe(false);
  });

  it('returns true for a 200 response with status: verified', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { wasmHash: 'hash1', status: 'verified', results: [], sources: [] })
    );

    await expect(checkVerificationExists('hash1')).resolves.toBe(true);
  });

  it('returns true for a 200 response with status: mismatch', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { wasmHash: 'hash1', status: 'mismatch', results: [], sources: [] })
    );

    await expect(checkVerificationExists('hash1')).resolves.toBe(true);
  });

  it('returns false for a genuine 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

    await expect(checkVerificationExists('hash1')).resolves.toBe(false);
  });

  it('throws on an unexpected status code', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    await expect(checkVerificationExists('hash1')).rejects.toThrow('Unexpected status code: 500');
  });
});
