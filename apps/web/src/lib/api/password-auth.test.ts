import { describe, it, expect, vi, beforeEach } from 'vitest'
import { passwordRegister, passwordLogin } from './password-auth'

describe('password-auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('passwordRegister', () => {
    it('should register successfully', async () => {
      const mockResponse = {
        user_id: 'user-123',
        session_token: 'token-abc',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await passwordRegister(
        'testuser',
        'password123',
        new Uint8Array([1, 2, 3])
      )

      expect(result).toEqual(mockResponse)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5000/auth/password/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'testuser',
            password: 'password123',
            identity_key: [1, 2, 3],
          }),
        })
      )
    })

    it('should throw on registration failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Username taken' }),
      } as Response)

      await expect(
        passwordRegister('testuser', 'password', new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('Username taken')
    })

    it('should throw generic error when no error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response)

      await expect(
        passwordRegister('testuser', 'password', new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('Registration failed')
    })
  })

  describe('passwordLogin', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        user_id: 'user-123',
        session_token: 'token-xyz',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await passwordLogin('testuser', 'password123')

      expect(result).toEqual(mockResponse)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5000/auth/password/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'testuser',
            password: 'password123',
          }),
        })
      )
    })

    it('should throw on invalid credentials', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      } as Response)

      await expect(
        passwordLogin('testuser', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should throw generic error when no error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response)

      await expect(
        passwordLogin('testuser', 'password')
      ).rejects.toThrow('Login failed')
    })
  })
})
