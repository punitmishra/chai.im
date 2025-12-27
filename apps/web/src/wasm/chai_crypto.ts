/**
 * Mock WASM crypto module for development.
 * This provides a simple implementation for testing when the real WASM isn't built.
 */

let initialized = false;

export class CryptoManager {
  private identity: Uint8Array;
  private sessions: Map<string, Uint8Array> = new Map();

  constructor() {
    // Generate random 32-byte identity
    this.identity = new Uint8Array(32);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(this.identity);
    }
  }

  static fromBytes(bytes: Uint8Array): CryptoManager {
    const manager = new CryptoManager();
    manager.identity = bytes.slice(0, 32);
    return manager;
  }

  exportIdentity(): Uint8Array {
    return this.identity;
  }

  publicIdentity(): Uint8Array {
    return this.identity;
  }

  generatePrekeyBundle(): Uint8Array {
    // Generate mock 128-byte bundle (identity + signed prekey + signature)
    const bundle = new Uint8Array(128);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(bundle);
    }
    // Copy identity to first 32 bytes
    bundle.set(this.identity, 0);
    return bundle;
  }

  generateOneTimePrekeys(count: number): Uint8Array {
    // Each prekey is 32 bytes
    const prekeys = new Uint8Array(count * 32);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(prekeys);
    }
    return prekeys;
  }

  initSession(recipientId: string, bundle: Uint8Array): Uint8Array {
    // Store session for recipient
    const sessionKey = new Uint8Array(32);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(sessionKey);
    }
    this.sessions.set(recipientId, sessionKey);
    return sessionKey;
  }

  receiveSession(senderId: string, _initialData: Uint8Array): void {
    // Store session for sender
    const sessionKey = new Uint8Array(32);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(sessionKey);
    }
    this.sessions.set(senderId, sessionKey);
  }

  hasSession(peerId: string): boolean {
    return this.sessions.has(peerId);
  }

  encrypt(_recipientId: string, plaintext: Uint8Array): Uint8Array {
    // In dev mode, just return plaintext with a marker prefix
    // Real encryption would use the session key
    const marker = new TextEncoder().encode('DEV:');
    const result = new Uint8Array(marker.length + plaintext.length);
    result.set(marker, 0);
    result.set(plaintext, marker.length);
    return result;
  }

  decrypt(_senderId: string, ciphertext: Uint8Array): Uint8Array {
    // Check for dev marker
    const marker = new TextEncoder().encode('DEV:');
    const prefix = ciphertext.slice(0, marker.length);
    if (new TextDecoder().decode(prefix) === 'DEV:') {
      return ciphertext.slice(marker.length);
    }
    // Fallback for non-dev encrypted data
    return ciphertext;
  }

  exportSession(peerId: string): Uint8Array {
    return this.sessions.get(peerId) || new Uint8Array(32);
  }

  importSession(peerId: string, data: Uint8Array): void {
    this.sessions.set(peerId, data);
  }
}

export function init(): void {
  initialized = true;
  console.log('[DEV] Mock crypto initialized');
}

export default async function initWasm(): Promise<void> {
  // Mock WASM initialization
  return Promise.resolve();
}
