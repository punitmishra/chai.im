/* tslint:disable */
/* eslint-disable */

/**
 * Crypto manager for handling E2E encryption from JavaScript.
 */
export class CryptoManager {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Ensure our sender key for a group exists and return its distribution
     * message (bincode bytes) to encrypt and send to each group member.
     */
    createSenderKey(group_id: string): Uint8Array;
    /**
     * Receive a Prekey message: establish session and decrypt.
     * Parses PrekeyMessagePayload (bincode), establishes session, returns plaintext.
     */
    decryptPrekey(peer_id: string, ciphertext: Uint8Array): Uint8Array;
    /**
     * Decrypt a message from a peer.
     */
    decrypt(peer_id: string, ciphertext: Uint8Array): Uint8Array;
    /**
     * Encrypt a message for a peer.
     */
    encrypt(peer_id: string, plaintext: Uint8Array): Uint8Array;
    /**
     * Export the identity key bytes for storage.
     */
    exportIdentity(): Uint8Array;
    /**
     * Export a session for storage.
     */
    exportSession(peer_id: string): Uint8Array;
    /**
     * Restore from exported identity bytes.
     */
    static fromBytes(data: Uint8Array): CryptoManager;
    /**
     * Generate additional one-time prekeys.
     * Returns array of (id, public_key) pairs as bytes.
     */
    generateOneTimePrekeys(count: number): Uint8Array;
    /**
     * Generate a prekey bundle for registration.
     * Returns serialized bundle data.
     */
    generatePrekeyBundle(): Uint8Array;
    /**
     * Decrypt a group message from a sender using their installed sender key.
     */
    groupDecrypt(group_id: string, sender_id: string, message: Uint8Array): Uint8Array;
    /**
     * Encrypt a group message with our sender key; returns bincode bytes.
     */
    groupEncrypt(group_id: string, plaintext: Uint8Array): Uint8Array;
    /**
     * Whether we have created our own sender key for a group.
     */
    hasSenderKey(group_id: string): boolean;
    /**
     * Check if a session exists with a peer.
     */
    hasSession(peer_id: string): boolean;
    /**
     * Import a session from storage.
     */
    importSession(_peer_id: string, data: Uint8Array): void;
    /**
     * Initiate a session and encrypt the first message (Prekey message).
     * Returns PrekeyMessagePayload as bincode bytes, compatible with CLI.
     */
    initSessionAndEncrypt(peer_id: string, bundle_data: Uint8Array, plaintext: Uint8Array): Uint8Array;
    /**
     * Initialize a session with a peer using their prekey bundle.
     * bundle_data format: same as generatePrekeyBundle output
     */
    initSession(peer_id: string, bundle_data: Uint8Array): Uint8Array;
    /**
     * Create a new crypto manager with a fresh identity.
     */
    constructor();
    /**
     * Install a peer's sender key (already decrypted from the pairwise channel).
     */
    processSenderKeyDistribution(group_id: string, sender_id: string, distribution: Uint8Array): void;
    /**
     * Get the public identity key.
     */
    publicIdentity(): Uint8Array;
    /**
     * Receive a session from a peer's initial message.
     */
    receiveSession(peer_id: string, initial_data: Uint8Array): void;
    /**
     * Our existing sender-key distribution message for a group (for a new member),
     * or null if we have not created one.
     */
    senderKeyDistribution(group_id: string): Uint8Array | undefined;
}

/**
 * Create a CryptoManager from a mnemonic phrase.
 */
export function cryptoFromMnemonic(words: string, passphrase: string): CryptoManager;

/**
 * Generate a new BIP39 mnemonic phrase.
 * word_count: 12 or 24
 */
export function generateMnemonic(word_count: number): string;

/**
 * Initialize console logging for WASM debugging.
 */
export function init(): void;

/**
 * Sign a challenge with an identity key (for authentication).
 * Returns the Ed25519 signature.
 */
export function signChallenge(identity_bytes: Uint8Array, challenge: Uint8Array): Uint8Array;

/**
 * Validate a BIP39 mnemonic phrase.
 */
export function validateMnemonic(words: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_cryptomanager_free: (a: number, b: number) => void;
    readonly cryptoFromMnemonic: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly cryptomanager_createSenderKey: (a: number, b: number, c: number) => [number, number, number, number];
    readonly cryptomanager_decrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly cryptomanager_decryptPrekey: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly cryptomanager_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly cryptomanager_exportIdentity: (a: number) => [number, number];
    readonly cryptomanager_exportSession: (a: number, b: number, c: number) => [number, number, number, number];
    readonly cryptomanager_fromBytes: (a: number, b: number) => [number, number, number];
    readonly cryptomanager_generateOneTimePrekeys: (a: number, b: number) => [number, number];
    readonly cryptomanager_generatePrekeyBundle: (a: number) => [number, number];
    readonly cryptomanager_groupDecrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly cryptomanager_groupEncrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly cryptomanager_hasSenderKey: (a: number, b: number, c: number) => number;
    readonly cryptomanager_hasSession: (a: number, b: number, c: number) => number;
    readonly cryptomanager_importSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly cryptomanager_initSession: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly cryptomanager_initSessionAndEncrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly cryptomanager_new: () => number;
    readonly cryptomanager_processSenderKeyDistribution: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly cryptomanager_publicIdentity: (a: number) => [number, number];
    readonly cryptomanager_receiveSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly cryptomanager_senderKeyDistribution: (a: number, b: number, c: number) => [number, number];
    readonly generateMnemonic: (a: number) => [number, number, number, number];
    readonly init: () => void;
    readonly signChallenge: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly validateMnemonic: (a: number, b: number) => number;
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
