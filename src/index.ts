import fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import pino from 'pino';
import { config } from './config';
import { initDb, closeDb } from './db';
import { routes } from './routes';
import { startScheduler, stopScheduler } from './scheduler';

const logger = pino();

async function main(): Promise<void> {
  await initDb();
  logger.info('Database schema initialized');

  const app = fastify({ logger: true });

  await app.register(rateLimit, {
    global: false,
  });

  await app.register(routes);

  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopScheduler();
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.HOST, port: config.PORT });
  logger.info({ host: config.HOST, port: config.PORT }, 'Server listening');
}

main().catch((err: unknown) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});
