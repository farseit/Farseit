import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const hex = process.env.TOKEN_ENC_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('TOKEN_ENC_KEY must be 64 hex characters (32 bytes)');
  return Buffer.from(hex, 'hex');
}

/** Page token / API key DB-te encrypt kore rakhar jonno (AES-256-GCM) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(payload: string): string {
  const [iv, tag, enc] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}