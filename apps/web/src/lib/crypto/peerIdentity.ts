/**
 * Peer Identity Exchange utilities.
 *
 * Provides functions for sharing and verifying peer identities
 * without relying on centralized username lookup.
 */

import { getPublicIdentity } from './wasm';

/**
 * Identity card format for sharing.
 */
export interface IdentityCard {
  version: 1;
  username: string;
  userId: string;
  identityKey: string; // Base64 encoded
  timestamp: number;
}

/**
 * Safety number computed from two identity keys.
 */
export interface SafetyNumber {
  numeric: string;      // 60-digit numeric code (12 groups of 5)
  fingerprint: string;  // Short 8-char fingerprint
}

/**
 * Create an identity card for sharing.
 */
export async function createIdentityCard(
  username: string,
  userId: string
): Promise<IdentityCard> {
  const publicKey = await getPublicIdentity();
  return {
    version: 1,
    username,
    userId,
    identityKey: arrayToBase64(publicKey),
    timestamp: Date.now(),
  };
}

/**
 * Serialize an identity card to a shareable string.
 */
export function serializeIdentityCard(card: IdentityCard): string {
  const json = JSON.stringify(card);
  return btoa(json);
}

/**
 * Parse a serialized identity card.
 */
export function parseIdentityCard(serialized: string): IdentityCard {
  try {
    const json = atob(serialized);
    const card = JSON.parse(json) as IdentityCard;

    // Validate card structure
    if (
      card.version !== 1 ||
      typeof card.username !== 'string' ||
      typeof card.userId !== 'string' ||
      typeof card.identityKey !== 'string' ||
      typeof card.timestamp !== 'number'
    ) {
      throw new Error('Invalid identity card format');
    }

    return card;
  } catch (e) {
    throw new Error('Failed to parse identity card: ' + (e instanceof Error ? e.message : 'Unknown error'));
  }
}

/**
 * Generate a deep link for sharing identity.
 */
export function generateDeepLink(card: IdentityCard): string {
  const params = new URLSearchParams({
    u: card.username,
    i: card.userId,
    k: card.identityKey,
    t: card.timestamp.toString(),
  });
  return `chai://add?${params.toString()}`;
}

/**
 * Generate a web link for sharing identity (for platforms that don't support deep links).
 */
export function generateWebLink(card: IdentityCard, baseUrl: string = 'https://chai.im'): string {
  const params = new URLSearchParams({
    u: card.username,
    i: card.userId,
    k: card.identityKey,
    t: card.timestamp.toString(),
  });
  return `${baseUrl}/add?${params.toString()}`;
}

/**
 * Parse identity from a deep link or web link.
 */
export function parseIdentityLink(url: string): IdentityCard | null {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const username = params.get('u');
    const userId = params.get('i');
    const identityKey = params.get('k');
    const timestamp = params.get('t');

    if (!username || !userId || !identityKey || !timestamp) {
      return null;
    }

    return {
      version: 1,
      username,
      userId,
      identityKey,
      timestamp: parseInt(timestamp, 10),
    };
  } catch {
    return null;
  }
}

/**
 * Compute a safety number from two identity keys.
 * This allows users to verify they're talking to the right person.
 *
 * Uses SHA-256 hash of both keys concatenated in sorted order
 * to ensure both parties compute the same number.
 */
export async function computeSafetyNumber(
  myIdentityKey: Uint8Array,
  theirIdentityKey: Uint8Array
): Promise<SafetyNumber> {
  // Sort keys to ensure same result regardless of order
  const myKeyStr = arrayToBase64(myIdentityKey);
  const theirKeyStr = arrayToBase64(theirIdentityKey);

  const [first, second] = myKeyStr < theirKeyStr
    ? [myIdentityKey, theirIdentityKey]
    : [theirIdentityKey, myIdentityKey];

  // Concatenate keys
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);

  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to numeric string (60 digits, 12 groups of 5)
  let numeric = '';
  for (let i = 0; i < 30; i++) {
    const val = hashArray[i % hashArray.length];
    numeric += val.toString().padStart(2, '0');
  }

  // Format as groups of 5
  const groups: string[] = [];
  for (let i = 0; i < 60; i += 5) {
    groups.push(numeric.slice(i, i + 5));
  }

  // Short fingerprint (first 8 chars of base64 hash)
  const fingerprint = arrayToBase64(hashArray).slice(0, 8);

  return {
    numeric: groups.join(' '),
    fingerprint,
  };
}

/**
 * Compute safety number with current user's identity.
 */
export async function computeSafetyNumberWithPeer(
  peerIdentityKey: Uint8Array
): Promise<SafetyNumber> {
  const myKey = await getPublicIdentity();
  return computeSafetyNumber(myKey, peerIdentityKey);
}

/**
 * Generate a QR code data URL for an identity card.
 * Uses a simple SVG-based approach (no external dependencies).
 */
export function generateQRCodeData(card: IdentityCard): string {
  // Return the serialized data - actual QR rendering done by component
  return serializeIdentityCard(card);
}

/**
 * Verify that an identity key is valid (32 bytes, non-zero).
 */
export function isValidIdentityKey(key: string | Uint8Array): boolean {
  try {
    const bytes = typeof key === 'string' ? base64ToArray(key) : key;
    if (bytes.length !== 32) return false;
    // Check not all zeros
    return bytes.some(b => b !== 0);
  } catch {
    return false;
  }
}

// Utility functions for Base64 encoding/decoding
function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Export utilities
export { arrayToBase64, base64ToArray };
