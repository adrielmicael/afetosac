// Chave de teste (32 bytes em hex) precisa existir antes de importar o módulo
process.env.ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { encrypt, decrypt, isEncrypted, encryptIfNeeded, maskSecret } from '../../../src/utils/crypto';

describe('crypto vault (AES-256-GCM)', () => {
  it('faz round-trip (cifra e decifra)', () => {
    const plain = 'EAAG-super-secret-token-123';
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decrypt(enc)).toBe(plain);
  });

  it('gera payloads diferentes para o mesmo texto (IV aleatório)', () => {
    expect(encrypt('mesmo-valor')).not.toBe(encrypt('mesmo-valor'));
  });

  it('trata valor legado em texto puro como não cifrado', () => {
    expect(isEncrypted('texto-puro')).toBe(false);
    expect(decrypt('texto-puro')).toBe('texto-puro');
  });

  it('encryptIfNeeded é idempotente', () => {
    const enc = encryptIfNeeded('abc')!;
    expect(encryptIfNeeded(enc)).toBe(enc);
    expect(encryptIfNeeded('')).toBeNull();
    expect(encryptIfNeeded(null)).toBeNull();
  });

  it('detecta adulteração (authTag inválido)', () => {
    const enc = encrypt('valor');
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'BB' : 'AA');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('mascara segredos com os últimos 4 caracteres', () => {
    expect(maskSecret(encrypt('token-9999'))).toBe('••••9999');
    expect(maskSecret('abc')).toBe('••••');
    expect(maskSecret(null)).toBeNull();
  });
});
