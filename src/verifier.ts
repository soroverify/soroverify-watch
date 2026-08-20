import { config } from './config';

export async function checkVerificationExists(wasmHash: string): Promise<boolean> {
  const url = `${config.VERIFIER_API_URL.replace(/\/+$/, '')}/verifications/${wasmHash}`;
  try {
    const response = await fetch(url);
    if (response.status === 200) {
      return true;
    }
    if (response.status === 404) {
      return false;
    }
    throw new Error(`Unexpected status code: ${response.status}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to query verifier API: ${msg}`);
  }
}
