import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// Mock IndexedDB
const mockIDB = {
  open: vi.fn().mockImplementation(() => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockImplementation(() => ({
            onerror: null,
            onsuccess: null,
            result: null,
          })),
          put: vi.fn().mockImplementation(() => ({
            onerror: null,
            onsuccess: null,
          })),
        }),
      }),
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      createObjectStore: vi.fn(),
    },
  })),
}

Object.defineProperty(globalThis, 'indexedDB', {
  value: mockIDB,
  writable: true,
})

// Mock crypto.subtle for tests
const mockCrypto = {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  }),
  subtle: {
    importKey: vi.fn().mockResolvedValue({}),
    deriveKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(48)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
}

Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true,
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock fetch
globalThis.fetch = vi.fn()

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})
