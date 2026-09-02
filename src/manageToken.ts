import crypto from 'node:crypto';

export function generateManageToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashManageToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function manageTokenMatches(providedToken: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) {
    return false;
  }
  const providedHash = Buffer.from(hashManageToken(providedToken), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');
  if (providedHash.length !== expectedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedHash, expectedHash);
}
