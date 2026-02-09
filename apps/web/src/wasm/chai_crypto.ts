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
    // Format: [identity_key(32)] [signed_prekey(32)] [signature(64)]
    //         [signed_prekey_id(4-LE)] [has_otp(1)] [otp(32)?] [otp_id(4-LE)?]
    const bundle = new Uint8Array(169); // max size with OTP
    const view = new DataView(bundle.buffer);
    let offset = 0;

    // identity_key (32 bytes)
    bundle.set(this.identity, offset);
    offset += 32;

    // signed_prekey (32 bytes random)
    const spk = new Uint8Array(32);
    if (typeof crypto !== 'undefined') crypto.getRandomValues(spk);
    bundle.set(spk, offset);
    offset += 32;

    // signature (64 bytes random)
    const sig = new Uint8Array(64);
    if (typeof crypto !== 'undefined') crypto.getRandomValues(sig);
    bundle.set(sig, offset);
    offset += 64;

    // signed_prekey_id (4 bytes LE)
    view.setUint32(offset, 1, true);
    offset += 4;

    // One OTP
    bundle[offset] = 1; // has OTP
    offset += 1;
    const otp = new Uint8Array(32);
    if (typeof crypto !== 'undefined') crypto.getRandomValues(otp);
    bundle.set(otp, offset);
    offset += 32;
    view.setUint32(offset, 1, true); // otp_id = 1
    offset += 4;

    return bundle.slice(0, offset);
  }

  generateOneTimePrekeys(count: number): Uint8Array {
    // Format: [count(4-LE)] then [id(4-LE)][key(32)]...
    const data = new Uint8Array(4 + count * 36);
    const view = new DataView(data.buffer);
    view.setUint32(0, count, true);
    let offset = 4;

    for (let i = 0; i < count; i++) {
      view.setUint32(offset, i + 1, true); // id
      offset += 4;
      const key = new Uint8Array(32);
      if (typeof crypto !== 'undefined') crypto.getRandomValues(key);
      data.set(key, offset);
      offset += 32;
    }

    return data.slice(0, offset);
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

  initSessionAndEncrypt(recipientId: string, _bundle: Uint8Array, plaintext: Uint8Array): Uint8Array {
    // Establish session and return "encrypted" first message (Prekey payload)
    const sessionKey = new Uint8Array(32);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(sessionKey);
    }
    this.sessions.set(recipientId, sessionKey);

    // Mock: prefix with DEV: marker
    const marker = new TextEncoder().encode('DEV:');
    const result = new Uint8Array(marker.length + plaintext.length);
    result.set(marker, 0);
    result.set(plaintext, marker.length);
    return result;
  }

  decryptPrekey(senderId: string, ciphertext: Uint8Array): Uint8Array {
    // Establish session and decrypt a Prekey message
    const sessionKey = new Uint8Array(32);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(sessionKey);
    }
    this.sessions.set(senderId, sessionKey);

    // Mock: check for DEV: marker
    const marker = new TextEncoder().encode('DEV:');
    const prefix = ciphertext.slice(0, marker.length);
    if (new TextDecoder().decode(prefix) === 'DEV:') {
      return ciphertext.slice(marker.length);
    }
    return ciphertext;
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
