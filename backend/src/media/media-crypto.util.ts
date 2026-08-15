import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: string; // base64
  authTag: string; // base64
}

// AES-256-GCM at rest (ТЗ гл. 3.3, 4). Ключ — общий серверный
// MEDIA_ENCRYPTION_KEY (32 байта), не привязан к пользователю: сама
// защита пользователя обеспечивается токенизированной выдачей и
// водяным знаком, а не разным ключом на файл.
export function encryptMedia(plaintext: Buffer, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

export function decryptMedia(ciphertext: Buffer, key: Buffer, ivB64: string, authTagB64: string): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
