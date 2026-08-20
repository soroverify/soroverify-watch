export interface Config {
  DATABASE_URL: string;
  STELLAR_RPC_URL: string;
  VERIFIER_API_URL: string;
  WATCHER_PRIVATE_KEY?: string;
  RPC_CALLS_PER_TICK: number;
  TICK_INTERVAL_SECONDS: number;
  DEFAULT_CHECK_INTERVAL_SECONDS: number;
  MAX_CHECK_INTERVAL_SECONDS: number;
  HOST: string;
  PORT: number;
}

export function loadConfig(): Config {
  const requireEnv = (name: string): string => {
    const val = process.env[name];
    if (!val) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return val;
  };

  const getInt = (name: string, fallback?: number): number => {
    const val = process.env[name];
    if (!val) {
      if (fallback !== undefined) return fallback;
      throw new Error(`Missing required environment variable: ${name}`);
    }
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${name} must be an integer`);
    }
    return parsed;
  };

  return {
    DATABASE_URL: requireEnv('DATABASE_URL'),
    STELLAR_RPC_URL: requireEnv('STELLAR_RPC_URL'),
    VERIFIER_API_URL: requireEnv('VERIFIER_API_URL'),
    WATCHER_PRIVATE_KEY: process.env.WATCHER_PRIVATE_KEY,
    RPC_CALLS_PER_TICK: getInt('RPC_CALLS_PER_TICK', 10),
    TICK_INTERVAL_SECONDS: getInt('TICK_INTERVAL_SECONDS', 60),
    DEFAULT_CHECK_INTERVAL_SECONDS: getInt('DEFAULT_CHECK_INTERVAL_SECONDS'),
    MAX_CHECK_INTERVAL_SECONDS: getInt('MAX_CHECK_INTERVAL_SECONDS'),
    HOST: process.env.HOST || '127.0.0.1',
    PORT: getInt('PORT', 8090),
  };
}

export const config = loadConfig();
