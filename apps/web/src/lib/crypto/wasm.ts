/**
 * WASM crypto module wrapper.
 *
 * This module loads and initializes the chai-crypto WASM module
 * compiled from Rust.
 */

// Type declarations for the WASM module
interface ChaiCryptoWasm {
  CryptoManager: {
    new(): CryptoManager;
    from_bytes(data: Uint8Array): CryptoManager;
  };
}

interface CryptoManager {
  generate_prekey_bundle(): Uint8Array;
  init_session(recipientId: string, bundle: Uint8Array): void;
  encrypt(recipientId: string, plaintext: Uint8Array): Uint8Array;
  decrypt(senderId: string, ciphertext: Uint8Array): Uint8Array;
  export_identity(): Uint8Array;
  export_session(peerId: string): Uint8Array;
  import_session(peerId: string, data: Uint8Array): void;
}

let wasmModule: ChaiCryptoWasm | null = null;
let cryptoManager: CryptoManager | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM crypto module.
 */
export async function initCrypto(): Promise<CryptoManager> {
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
    cryptoManager = wasmModule.CryptoManager.from_bytes(storedIdentity);
  } else {
    cryptoManager = new wasmModule.CryptoManager();
    await saveIdentityToStorage(cryptoManager.export_identity());
  }

  return cryptoManager;
}

async function loadWasmModule(): Promise<void> {
  try {
    // Dynamic import of the WASM module
    // The actual path will depend on the wasm-pack output location
    const module = await import('@/wasm/chai_crypto');
    await module.default(); // Initialize WASM
    wasmModule = module as unknown as ChaiCryptoWasm;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    throw error;
  }
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
  return crypto.generate_prekey_bundle();
}

/**
 * Initialize a session with a recipient.
 */
export async function initSession(
  recipientId: string,
  bundle: Uint8Array
): Promise<void> {
  const crypto = await initCrypto();
  crypto.init_session(recipientId, bundle);
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
  return crypto.export_session(peerId);
}

/**
 * Import a session from storage.
 */
export async function importSession(
  peerId: string,
  data: Uint8Array
): Promise<void> {
  const crypto = await initCrypto();
  crypto.import_session(peerId, data);
}
