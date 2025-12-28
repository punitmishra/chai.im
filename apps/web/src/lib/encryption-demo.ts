/**
 * Encryption demo utilities.
 * Uses Web Crypto API for authentic encryption visualization.
 */

// Characters used for scrambling effect
const CIPHER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/**
 * Generate random character for scrambling effect.
 */
export function randomChar(): string {
  return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
}

/**
 * Generate random string of given length.
 */
export function randomString(length: number): string {
  return Array.from({ length }, () => randomChar()).join('');
}

/**
 * Create scrambled text transitioning from original to final.
 * @param original - Original plaintext
 * @param final - Final ciphertext
 * @param progress - Progress from 0 to 1
 */
export function scrambleText(
  original: string,
  final: string,
  progress: number
): string {
  const maxLen = Math.max(original.length, final.length);
  const result: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const threshold = i / maxLen;

    if (progress >= 1) {
      // Fully encrypted - show final ciphertext
      result.push(final[i] || '');
    } else if (threshold < progress - 0.15) {
      // This character has "locked in" to the final value
      result.push(final[i] || randomChar());
    } else if (threshold < progress) {
      // This character is actively scrambling
      result.push(randomChar());
    } else {
      // This character hasn't started scrambling yet
      result.push(original[i] || ' ');
    }
  }

  return result.join('');
}

/**
 * Encode bytes to base64 for display.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Encrypt plaintext using Web Crypto AES-GCM.
 * Returns base64-encoded ciphertext.
 */
export async function demoEncrypt(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random key and IV
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + ciphertext for display
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToBase64(combined);
}

/**
 * Format ciphertext for display with line breaks.
 */
export function formatCiphertext(ciphertext: string, lineLength: number = 32): string {
  const lines: string[] = [];
  for (let i = 0; i < ciphertext.length; i += lineLength) {
    lines.push(ciphertext.slice(i, i + lineLength));
  }
  return lines.join('\n');
}
