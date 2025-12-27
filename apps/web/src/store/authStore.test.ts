import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      sessionToken: null,
      isAuthenticated: false,
    })
  })

  describe('initial state', () => {
    it('should start with no user', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.sessionToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('setUser', () => {
    it('should set user and token', () => {
      const user = { id: 'user-123', username: 'testuser' }
      const token = 'session-token-xyz'

      useAuthStore.getState().setUser(user, token)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.sessionToken).toBe(token)
      expect(state.isAuthenticated).toBe(true)
    })

    it('should overwrite existing user', () => {
      const user1 = { id: 'user-1', username: 'user1' }
      const user2 = { id: 'user-2', username: 'user2' }

      useAuthStore.getState().setUser(user1, 'token1')
      useAuthStore.getState().setUser(user2, 'token2')

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user2)
      expect(state.sessionToken).toBe('token2')
    })
  })

  describe('logout', () => {
    it('should clear user and token', () => {
      const user = { id: 'user-123', username: 'testuser' }
      useAuthStore.getState().setUser(user, 'token')

      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.sessionToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it('should handle logout when already logged out', () => {
      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })
})
