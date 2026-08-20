import { generateKeyPairSync, sign, KeyObject, createPrivateKey, createPublicKey } from 'crypto';
import { config } from './config';
import pino from 'pino';

const logger = pino();

let privateKey: KeyObject;
let publicKey: KeyObject;
let watcherId: string;

function initIdentity() {
  if (config.WATCHER_PRIVATE_KEY) {
    try {
      const der = Buffer.from(config.WATCHER_PRIVATE_KEY, 'base64');
      privateKey = createPrivateKey({
        key: der,
        format: 'der',
        type: 'pkcs8'
      });
      publicKey = createPublicKey(privateKey);
      watcherId = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
      logger.info({ watcherId }, 'Loaded watcher identity from WATCHER_PRIVATE_KEY');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse WATCHER_PRIVATE_KEY: ${msg}`);
    }
  } else {
    logger.warn('WATCHER_PRIVATE_KEY is unset, generating ephemeral identity for this run. Watcher ID will change on restart.');
    const keys = generateKeyPairSync('ed25519');
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
    watcherId = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  }
}

initIdentity();

export function getWatcherId(): string {
  return watcherId;
}

export function signRecord(payload: string): string {
  const signature = sign(null, Buffer.from(payload), privateKey);
  return signature.toString('base64');
}
