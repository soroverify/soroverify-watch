import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://localhost/db',
      STELLAR_RPC_URL: 'http://localhost/rpc',
      VERIFIER_API_URL: 'http://localhost/verifier',
      RPC_CALLS_PER_TICK: '10',
      TICK_INTERVAL_SECONDS: '60',
      DEFAULT_CHECK_INTERVAL_SECONDS: '3600',
      MAX_CHECK_INTERVAL_SECONDS: '86400',
    }
  }
});
