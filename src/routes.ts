import { FastifyPluginAsync } from 'fastify';
import { watchRoutes } from './watch';
import { query } from './db';
import { rpcBudget } from './budget';
import { config } from './config';

export const routes: FastifyPluginAsync = async (server) => {
  // POST /watch
  server.register(watchRoutes);

  // GET /watch/:contractId
  server.get<{ Params: { contractId: string } }>('/watch/:contractId', async (request, reply) => {
    const { contractId } = request.params;
    const res = await query('SELECT * FROM watched_contracts WHERE contract_id = $1', [contractId]);
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Contract not found' });
    }
    return res.rows[0];
  });

  // DELETE /watch/:contractId
  server.delete<{ Params: { contractId: string } }>('/watch/:contractId', async (request, reply) => {
    const { contractId } = request.params;
    const res = await query('UPDATE watched_contracts SET status = $1 WHERE contract_id = $2 RETURNING *', ['retired', contractId]);
    if (res.rowCount === 0) {
      return reply.status(404).send({ error: 'Contract not found' });
    }
    return { success: true };
  });

  // GET /drift/:wasmHash
  server.get<{ Params: { wasmHash: string } }>('/drift/:wasmHash', async (request, reply) => {
    const { wasmHash } = request.params;
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET');
    
    const res = await query('SELECT * FROM drift_records WHERE previous_wasm_hash = $1', [wasmHash]);
    return res.rows;
  });

  // GET /drift/by-contract/:contractId
  server.get<{ Params: { contractId: string } }>('/drift/by-contract/:contractId', async (request, reply) => {
    const { contractId } = request.params;
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET');
    
    const watchRes = await query('SELECT verified_wasm_hash FROM watched_contracts WHERE contract_id = $1', [contractId]);
    if (watchRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Contract not watched' });
    }
    
    const wasmHash = watchRes.rows[0].verified_wasm_hash;
    const res = await query('SELECT * FROM drift_records WHERE previous_wasm_hash = $1', [wasmHash]);
    return res.rows;
  });

  // GET /stats
  server.get('/stats', async (request, reply) => {
    const overdueRes = await query(`
      SELECT count(*) as overdue 
      FROM watched_contracts 
      WHERE status IN ('active', 'unreachable')
        AND (last_checked_at IS NULL OR last_checked_at + (check_interval_seconds || ' seconds')::interval <= NOW())
    `);
    
    return {
      rpc_calls_last_hour: rpcBudget.getTotalConsumed(),
      ceiling: config.RPC_CALLS_PER_TICK * Math.floor(3600 / config.TICK_INTERVAL_SECONDS),
      overdue_contracts: parseInt(overdueRes.rows[0].overdue, 10)
    };
  });

  // GET /health
  server.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });
};
