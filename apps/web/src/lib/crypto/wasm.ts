/**
 * WASM crypto module wrapper.
 *
 * This module loads and initializes the chai-crypto WASM module
 * compiled from Rust.
 */

import type { CryptoManager as WasmCryptoManager } from '@/wasm/chai_crypto';
import {
  lockIdentity,
  unlockIdentity,
  serializeLockedKey,
  deserializeLockedKey,
  isLocked,
} from './keyLocker';
import { DB_NAME, STORE_NAME, DB_VERSION } from '@/lib/config';
import logger from '@/lib/logger';

let wasmModule: typeof import('@/wasm/chai_crypto') | null = null;
let cryptoManager: WasmCryptoManager | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM crypto module.
 * This auto-loads unlocked identity from storage.
 * For password-protected identities, use initCryptoWithPassword instead.
 */
export async function initCrypto(): Promise<WasmCryptoManager> {
  if (cryptoManager) {
    return cryptoManager;
  }

  if (!initPromise) {
    initPromise = loadWasmModule();
  }

  await initPromise;

  if (!wasmModule) {
    throw new Error('Failed to load WASM module');
  }

  // Try to load existing identity from IndexedDB
  const storedIdentity = await loadIdentityFromStorage();

  if (storedIdentity) {
    // Check if identity is locked (encrypted with password)
    if (isLocked(storedIdentity)) {
      throw new Error('Identity is password-protected. Use initCryptoWithPassword().');
    }
    try {
      cryptoManager = wasmModule.CryptoManager.fromBytes(storedIdentity);
      logger.crypto.identityRestored();
    } catch (e) {
      logger.crypto.identityRestoreFailed(e);
      cryptoManager = new wasmModule.CryptoManager();
      await saveIdentityToStorage(cryptoManager.exportIdentity());
      logger.crypto.identityCreated();
    }
  } else {
    cryptoManager = new wasmModule.CryptoManager();
    await saveIdentityToStorage(cryptoManager.exportIdentity());
    logger.crypto.identityCreated();
  }

  return cryptoManager;
}

/**
 * Initialize crypto with a password-protected identity.
 * Use this when the user logs in with a password.
 */
export async function initCryptoWithPassword(password: string): Promise<WasmCryptoManager> {
  if (cryptoManager) {
    return cryptoManager;
  }

  if (!initPromise) {
    initPromise = loadWasmModule();
  }

  await initPromise;

  if (!wasmModule) {
    throw new Error('Failed to load WASM module');
  }

  const storedIdentity = await loadIdentityFromStorage();

  if (!storedIdentity) {
    throw new Error('No identity found. Register first.');
  }

  if (!isLocked(storedIdentity)) {
    // Identity not locked, load directly
    cryptoManager = wasmModule.CryptoManager.fromBytes(storedIdentity);
    return cryptoManager;
  }

  // Unlock the identity with password
  const lockedKey = deserializeLockedKey(storedIdentity);
  const unlocked = await unlockIdentity(lockedKey, password);
  cryptoManager = wasmModule.CryptoManager.fromBytes(unlocked);

  return cryptoManager;
}

/**
 * Create a new identity and lock it with a password.
 * Use this during password-based registration.
 */
export async function createLockedIdentity(password: string): Promise<{
  manager: WasmCryptoManager;
  publicIdentity: Uint8Array;
}> {
  if (!initPromise) {
    initPromise = loadWasmModule();
  }

  await initPromise;

  if (!wasmModule) {
    throw new Error('Failed to load WASM module');
  }

  // Generate new identity
  const manager = new wasmModule.CryptoManager();
  cryptoManager = manager;

  // Export identity and lock it
  const identity = manager.exportIdentity();
  const locked = await lockIdentity(identity, password);
  const serialized = serializeLockedKey(locked);

  // Save locked identity
  await saveIdentityToStorage(serialized);

  return {
    manager,
    publicIdentity: manager.publicIdentity(),
  };
}

/**
 * Check if stored identity is password-protected.
 */
export async function isIdentityLocked(): Promise<boolean> {
  const storedIdentity = await loadIdentityFromStorage();
  if (!storedIdentity) return false;
  return isLocked(storedIdentity);
}

/**
 * Clear the current crypto manager (for logout).
 */
export function clearCrypto(): void {
  cryptoManager = null;
}

async function loadWasmModule(): Promise<void> {
  try {
    // Dynamic import of the WASM module
    const module = await import('@/wasm/chai_crypto');

    // Initialize WASM
    await module.default();

    // Call init to set up console logging
    module.init();

    wasmModule = module;
    logger.debug('WASM crypto module loaded');
  } catch (error) {
    logger.error('Failed to load WASM module', error);
    throw error;
  }
}

/**
 * Get the crypto manager (throws if not initialized).
 */
export function getCryptoManager(): WasmCryptoManager {
  if (!cryptoManager) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
  return cryptoManager;
}

/**
 * Encrypt a message for a recipient.
 */
export async function encryptMessage(
  recipientId: string,
  plaintext: string
): Promise<Uint8Array> {
  const crypto = await initCrypto();
  const encoder = new TextEncoder();
  return crypto.encrypt(recipientId, encoder.encode(plaintext));
}

/**
 * Decrypt a message from a sender.
 */
export async function decryptMessage(
  senderId: string,
  ciphertext: Uint8Array
): Promise<string> {
  const crypto = await initCrypto();
  const decrypted = crypto.decrypt(senderId, ciphertext);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Generate a prekey bundle for registration.
 */
export async function generatePrekeyBundle(): Promise<Uint8Array> {
  const crypto = await initCrypto();
  return crypto.generatePrekeyBundle();
}

/**
 * Generate one-time prekeys.
 */
export async function generateOneTimePrekeys(count: number): Promise<Uint8Array> {
  const crypto = await initCrypto();
  return crypto.generateOneTimePrekeys(count);
}

/**
 * Initialize a session with a recipient.
 */
export async function initSession(
  recipientId: string,
  bundle: Uint8Array
): Promise<Uint8Array> {
  const crypto = await initCrypto();
  return crypto.initSession(recipientId, bundle);
}

/**
 * Receive a session from a sender.
 */
export async function receiveSession(
  senderId: string,
  initialData: Uint8Array
): Promise<void> {
  const crypto = await initCrypto();
  crypto.receiveSession(senderId, initialData);
}

/**
 * Check if a session exists with a peer.
 */
export async function hasSession(peerId: string): Promise<boolean> {
  const crypto = await initCrypto();
  return crypto.hasSession(peerId);
}

/**
 * Get the public identity key.
 */
export async function getPublicIdentity(): Promise<Uint8Array> {
  const crypto = await initCrypto();
  return crypto.publicIdentity();
}

// IndexedDB storage helpers
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function loadIdentityFromStorage(): Promise<Uint8Array | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('identity');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}

async function saveIdentityToStorage(identity: Uint8Array): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(identity, 'identity');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Export a session for storage.
 */
export async function exportSession(peerId: string): Promise<Uint8Array> {
  const crypto = await initCrypto();
  return crypto.exportSession(peerId);
}

/**
 * Import a session from storage.
 */
export async function importSession(
  peerId: string,
  data: Uint8Array
): Promise<void> {
  const crypto = await initCrypto();
  crypto.importSession(peerId, data);
}

/**
 * Save a session to IndexedDB.
 */
export async function saveSessionToStorage(peerId: string): Promise<void> {
  try {
    const sessionData = await exportSession(peerId);
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(sessionData, `session:${peerId}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        logger.crypto.sessionSaved(peerId);
        resolve();
      };
    });
  } catch (e) {
    logger.crypto.sessionSaveFailed(e);
  }
}

/**
 * Load a session from IndexedDB.
 */
export async function loadSessionFromStorage(peerId: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    const sessionData: Uint8Array | null = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(`session:${peerId}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });

    if (sessionData) {
      await importSession(peerId, sessionData);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
