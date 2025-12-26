/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_cryptomanager_free: (a: number, b: number) => void;
export const cryptomanager_decrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
export const cryptomanager_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
export const cryptomanager_exportIdentity: (a: number) => [number, number];
export const cryptomanager_exportSession: (a: number, b: number, c: number) => [number, number, number, number];
export const cryptomanager_fromBytes: (a: number, b: number) => [number, number, number];
export const cryptomanager_generateOneTimePrekeys: (a: number, b: number) => [number, number];
export const cryptomanager_generatePrekeyBundle: (a: number) => [number, number];
export const cryptomanager_hasSession: (a: number, b: number, c: number) => number;
export const cryptomanager_importSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
export const cryptomanager_initSession: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
export const cryptomanager_new: () => number;
export const cryptomanager_publicIdentity: (a: number) => [number, number];
export const cryptomanager_receiveSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
export const init: () => void;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
