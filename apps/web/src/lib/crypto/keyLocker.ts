/**
 * Password-based key protection.
 *
 * Uses WebCrypto to encrypt identity keys with a password-derived key.
 * This provides defense in depth - even if IndexedDB is compromised,
 * the keys remain protected by the user's password.
 *
 * Algorithm:
 * - PBKDF2 with SHA-256 to derive a 256-bit AES key from password
 * - AES-GCM for authenticated encryption of the identity blob
 * - Random salt stored alongside encrypted data
 * - Random IV per encryption
 */

// Balance between security and browser performance
// 100k iterations takes ~500ms in browser vs 5+ seconds for 600k
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

export interface LockedKey {
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  version: 1;
}

/**
 * Derive an AES-GCM key from a password using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Lock (encrypt) an identity blob with a password.
 */
export async function lockIdentity(
  identity: Uint8Array,
  password: string
): Promise<LockedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    identity as BufferSource
  );

  return {
    salt,
    iv,
    ciphertext: new Uint8Array(ciphertext),
    version: 1,
  };
}

/**
 * Unlock (decrypt) an identity blob with a password.
 * Throws if password is wrong or data is corrupted.
 */
export async function unlockIdentity(
  locked: LockedKey,
  password: string
): Promise<Uint8Array> {
  const key = await deriveKey(password, locked.salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: locked.iv as BufferSource },
      key,
      locked.ciphertext as BufferSource
    );
    return new Uint8Array(plaintext);
  } catch (error) {
    // AES-GCM throws on authentication failure (wrong password)
    throw new Error('Failed to unlock identity. Wrong password?');
  }
}

/**
 * Serialize a LockedKey for storage.
 */
export function serializeLockedKey(locked: LockedKey): Uint8Array {
  // Format: [version (1 byte)][salt (32 bytes)][iv (12 bytes)][ciphertext (rest)]
  const result = new Uint8Array(1 + SALT_LENGTH + IV_LENGTH + locked.ciphertext.length);
  let offset = 0;

  result[offset++] = locked.version;
  result.set(locked.salt, offset);
  offset += SALT_LENGTH;
  result.set(locked.iv, offset);
  offset += IV_LENGTH;
  result.set(locked.ciphertext, offset);

  return result;
}

/**
 * Deserialize a LockedKey from storage.
 */
export function deserializeLockedKey(data: Uint8Array): LockedKey {
  if (data.length < 1 + SALT_LENGTH + IV_LENGTH + 16) {
    throw new Error('Invalid locked key data: too short');
  }

  let offset = 0;
  const version = data[offset++];

  if (version !== 1) {
    throw new Error(`Unsupported locked key version: ${version}`);
  }

  const salt = data.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = data.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const ciphertext = data.slice(offset);

  return { salt, iv, ciphertext, version: 1 };
}

/**
 * Check if stored identity data is locked (encrypted).
 */
export function isLocked(data: Uint8Array): boolean {
  // Locked keys start with version byte 0x01
  // Raw WASM identity starts differently
  return data.length > 0 && data[0] === 1;
}
