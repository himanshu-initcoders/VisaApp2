import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
export const CREDENTIAL_KEY_VERSION = 1;

function encryptionKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return key;
}

export function encryptPassword(plaintext: string): {
  ciphertext: string;
  iv: string;
  keyVersion: number;
} {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: `${encrypted.toString('base64')}.${tag.toString('base64')}`,
    iv: iv.toString('hex'),
    keyVersion: CREDENTIAL_KEY_VERSION,
  };
}

export function decryptPassword(
  ciphertext: string,
  ivHex: string,
  keyVersion: number
): string {
  if (keyVersion !== CREDENTIAL_KEY_VERSION) {
    throw new Error('Unsupported credential key version');
  }
  const [encryptedB64, tagB64] = ciphertext.split('.');
  if (!encryptedB64 || !tagB64 || ciphertext.split('.').length !== 2) {
    throw new Error('Invalid credential ciphertext');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
