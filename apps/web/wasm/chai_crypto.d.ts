/* tslint:disable */
/* eslint-disable */

export class CryptoManager {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Restore from exported identity bytes.
   */
  static fromBytes(data: Uint8Array): CryptoManager;
  /**
   * Check if a session exists with a peer.
   */
  hasSession(peer_id: string): boolean;
  /**
   * Initialize a session with a peer using their prekey bundle.
   * bundle_data format: same as generatePrekeyBundle output
   */
  initSession(peer_id: string, bundle_data: Uint8Array): Uint8Array;
  /**
   * Export a session for storage.
   */
  exportSession(peer_id: string): Uint8Array;
  /**
   * Import a session from storage.
   */
  importSession(peer_id: string, data: Uint8Array): void;
  /**
   * Export the identity key bytes for storage.
   */
  exportIdentity(): Uint8Array;
  /**
   * Get the public identity key.
   */
  publicIdentity(): Uint8Array;
  /**
   * Receive a session from a peer's initial message.
   */
  receiveSession(peer_id: string, initial_data: Uint8Array): void;
  /**
   * Generate a prekey bundle for registration.
   * Returns serialized bundle data.
   */
  generatePrekeyBundle(): Uint8Array;
  /**
   * Generate additional one-time prekeys.
   * Returns array of (id, public_key) pairs as bytes.
   */
  generateOneTimePrekeys(count: number): Uint8Array;
  /**
   * Create a new crypto manager with a fresh identity.
   */
  constructor();
  /**
   * Decrypt a message from a peer.
   */
  decrypt(peer_id: string, ciphertext: Uint8Array): Uint8Array;
  /**
   * Encrypt a message for a peer.
   */
  encrypt(peer_id: string, plaintext: Uint8Array): Uint8Array;
}

/**
 * Initialize console logging for WASM debugging.
 */
export function init(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_cryptomanager_free: (a: number, b: number) => void;
  readonly cryptomanager_decrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly cryptomanager_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly cryptomanager_exportIdentity: (a: number) => [number, number];
  readonly cryptomanager_exportSession: (a: number, b: number, c: number) => [number, number, number, number];
  readonly cryptomanager_fromBytes: (a: number, b: number) => [number, number, number];
  readonly cryptomanager_generateOneTimePrekeys: (a: number, b: number) => [number, number];
  readonly cryptomanager_generatePrekeyBundle: (a: number) => [number, number];
  readonly cryptomanager_hasSession: (a: number, b: number, c: number) => number;
  readonly cryptomanager_importSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly cryptomanager_initSession: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly cryptomanager_new: () => number;
  readonly cryptomanager_publicIdentity: (a: number) => [number, number];
  readonly cryptomanager_receiveSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly init: () => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
