import CryptoJS from 'crypto-js';

const ENCRYPTION_PREFIX = 'somma:v1';

export function encrypt(value: string, key: string): string {
  return `${ENCRYPTION_PREFIX}:${CryptoJS.AES.encrypt(value, key).toString()}`;
}

export function decrypt(value: string, key: string): string {
  const prefix = `${ENCRYPTION_PREFIX}:`;
  if (!value.startsWith(prefix)) {
    throw new Error('Invalid encrypted payload');
  }

  const decrypted = CryptoJS.AES.decrypt(value.slice(prefix.length), key).toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('Unable to decrypt payload');
  return decrypted;
}
