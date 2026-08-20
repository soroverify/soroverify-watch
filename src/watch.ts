import { FastifyPluginAsync } from 'fastify';
import { StrKey } from '@stellar/stellar-sdk';
import { resolveWasmHash } from './resolve';
import { checkVerificationExists } from './verifier';
import { query } from './db';
import { config } from './config';

export const watchRoutes: FastifyPluginAsync = async (server) => {
  server.post<{
    Body: { contractId: string; network: string };
  }>(
    '/watch',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const { contractId, network } = request.body;

      if (!contractId || typeof contractId !== 'string' || !network || typeof network !== 'string') {
        return reply.status(400).send({ error: 'Missing or invalid contractId or network' });
      }

      if (!StrKey.isValidContract(contractId)) {
        return reply.status(400).send({ error: 'Invalid contract ID' });
      }

      let wasmHash: string;
      try {
        wasmHash = await resolveWasmHash(contractId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: `Failed to resolve contract: ${msg}` });
      }

      let verified: boolean;
      try {
        verified = await checkVerificationExists(wasmHash);
      } catch (err: unknown) {
        request.log.error(err);
        return reply.status(502).send({ error: 'Failed to query verifier' });
      }

      if (!verified) {
        return reply.status(400).send({ error: 'Contract not verified' });
      }

      try {
        await query(
          `INSERT INTO watched_contracts 
           (contract_id, verified_wasm_hash, network, check_interval_seconds, status) 
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (contract_id) DO UPDATE 
           SET verified_wasm_hash = EXCLUDED.verified_wasm_hash,
               network = EXCLUDED.network,
               status = 'active',
               consecutive_failures = 0`,
          [contractId, wasmHash, network, config.DEFAULT_CHECK_INTERVAL_SECONDS, 'active']
        );
        return reply.status(200).send({ success: true, contractId, wasmHash });
      } catch (err: unknown) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
};
