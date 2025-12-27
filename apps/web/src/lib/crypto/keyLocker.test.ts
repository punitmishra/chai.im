import { describe, it, expect } from 'vitest'
import {
  serializeLockedKey,
  deserializeLockedKey,
  isLocked,
  LockedKey,
} from './keyLocker'

describe('keyLocker', () => {
  describe('serializeLockedKey', () => {
    it('should serialize and deserialize a locked key', () => {
      const locked: LockedKey = {
        salt: new Uint8Array(32).fill(1),
        iv: new Uint8Array(12).fill(2),
        ciphertext: new Uint8Array([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]),
        version: 1,
      }

      const serialized = serializeLockedKey(locked)
      const deserialized = deserializeLockedKey(serialized)

      expect(deserialized.version).toBe(locked.version)
      expect(deserialized.salt).toEqual(locked.salt)
      expect(deserialized.iv).toEqual(locked.iv)
      expect(deserialized.ciphertext).toEqual(locked.ciphertext)
    })

    it('should produce correct format', () => {
      const locked: LockedKey = {
        salt: new Uint8Array(32).fill(0xAA),
        iv: new Uint8Array(12).fill(0xBB),
        ciphertext: new Uint8Array(20).fill(0xCC),
        version: 1,
      }

      const serialized = serializeLockedKey(locked)

      // Version byte + salt + iv + ciphertext
      expect(serialized.length).toBe(1 + 32 + 12 + 20)
      expect(serialized[0]).toBe(1) // version
    })
  })

  describe('deserializeLockedKey', () => {
    it('should throw on invalid data (too short)', () => {
      const tooShort = new Uint8Array(10)

      expect(() => deserializeLockedKey(tooShort)).toThrow('too short')
    })

    it('should throw on unsupported version', () => {
      // Create valid-length data with wrong version
      const wrongVersion = new Uint8Array(1 + 32 + 12 + 20)
      wrongVersion[0] = 99 // invalid version

      expect(() => deserializeLockedKey(wrongVersion)).toThrow('Unsupported locked key version')
    })
  })

  describe('isLocked', () => {
    it('should return true for locked keys (version 1)', () => {
      const lockedData = new Uint8Array(100)
      lockedData[0] = 1 // version byte

      expect(isLocked(lockedData)).toBe(true)
    })

    it('should return false for raw identity data', () => {
      // Raw WASM identity would not start with 0x01
      const rawData = new Uint8Array([0x00, 0x02, 0x03])

      expect(isLocked(rawData)).toBe(false)
    })

    it('should return false for empty data', () => {
      const emptyData = new Uint8Array(0)

      expect(isLocked(emptyData)).toBe(false)
    })
  })
})
