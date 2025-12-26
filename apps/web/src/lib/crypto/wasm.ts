/**
 * WASM crypto module wrapper.
 *
 * This module loads and initializes the chai-crypto WASM module
 * compiled from Rust.
 */

import type { CryptoManager as WasmCryptoManager } from '@/wasm/chai_crypto';

let wasmModule: typeof import('@/wasm/chai_crypto') | null = null;
let cryptoManager: WasmCryptoManager | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM crypto module.
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
    try {
      cryptoManager = wasmModule.CryptoManager.fromBytes(storedIdentity);
    } catch (e) {
      console.warn('Failed to restore identity, creating new one:', e);
      cryptoManager = new wasmModule.CryptoManager();
      await saveIdentityToStorage(cryptoManager.exportIdentity());
    }
  } else {
    cryptoManager = new wasmModule.CryptoManager();
    await saveIdentityToStorage(cryptoManager.exportIdentity());
  }

  return cryptoManager;
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
  } catch (error) {
    console.error('Failed to load WASM module:', error);
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
const DB_NAME = 'chai-crypto';
const STORE_NAME = 'keys';

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

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
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.warn('Failed to save session:', e);
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
