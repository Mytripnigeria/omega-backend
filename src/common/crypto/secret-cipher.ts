import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

// Authenticated symmetric encryption (AES-256-GCM) for secrets stored at rest
// — e.g. merchant payment-provider API keys. The encryption key is derived
// (SHA-256) from CREDENTIALS_ENCRYPTION_KEY, falling back to JWT_SECRET so the
// app works out of the box; set a dedicated CREDENTIALS_ENCRYPTION_KEY in
// production. Rotating the key makes previously-stored secrets undecryptable.

const PREFIX = 'enc:v1:';

function key(): Buffer {
  const material =
    process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!material) {
    throw new Error(
      'Cannot encrypt secrets: set CREDENTIALS_ENCRYPTION_KEY (or JWT_SECRET).',
    );
  }
  return createHash('sha256').update(material).digest(); // 32 bytes
}

/** Encrypts plaintext, returning an `enc:v1:<iv>:<tag>:<data>` string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/**
 * Decrypts a value produced by encryptSecret. Values that aren't in the
 * `enc:v1:` format are returned unchanged (backwards-compatible with any
 * plaintext written before encryption was introduced).
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    // Wrong key / corrupted ciphertext — treat as unset rather than crash.
    return null;
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}
