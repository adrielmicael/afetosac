import crypto from 'crypto';
import { logger } from './logger';

/**
 * Cofre de criptografia simétrica para segredos em repouso
 * (tokens da Meta/WhatsApp, app secrets etc.). Usa AES-256-GCM.
 *
 * Formato do payload cifrado: "enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 *
 * A chave vem de ENCRYPTION_KEY: 32 bytes em hex (64 chars) ou base64.
 */

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

let cachedKey: Buffer | null = null;

const loadKey = (): Buffer => {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') {
    throw new Error(
      'ENCRYPTION_KEY não configurada — necessária para cifrar/decifrar segredos.'
    );
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), 'hex');
  } else {
    key = Buffer.from(raw.trim(), 'base64');
  }

  if (key.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY inválida — deve representar 32 bytes (256 bits): 64 chars hex ou base64.'
    );
  }

  cachedKey = key;
  return key;
};

/** Indica se um valor já está no formato cifrado deste cofre. */
export const isEncrypted = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(PREFIX);

/** Cifra um texto puro. Retorna o payload no formato "enc:v1:...". */
export const encrypt = (plaintext: string): string => {
  const key = loadKey();
  const iv = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    PREFIX +
    [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
  );
};

/**
 * Decifra um payload. Se o valor não estiver cifrado (legado em texto puro),
 * retorna o próprio valor — facilita a transição sem quebrar dados antigos.
 */
export const decrypt = (payload: string | null | undefined): string | null => {
  if (payload == null) return null;
  if (!isEncrypted(payload)) {
    // Compatibilidade com dados ainda não migrados
    return payload;
  }

  try {
    const body = payload.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = body.split(':');
    const key = loadKey();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (error) {
    logger.error('Falha ao decifrar segredo (chave incorreta ou dado corrompido)');
    throw new Error('Failed to decrypt secret');
  }
};

/** Cifra apenas se ainda não estiver cifrado (idempotente). */
export const encryptIfNeeded = (value: string | null | undefined): string | null => {
  if (value == null || value === '') return null;
  return isEncrypted(value) ? value : encrypt(value);
};

/** Mascara um segredo para exibição segura (ex.: ••••••1234). */
export const maskSecret = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const plain = decrypt(value) || '';
  if (plain.length <= 4) return '••••';
  return `••••${plain.slice(-4)}`;
};
