import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/api/client'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
  isLoggedIn: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('token', token)
        set({ token, user })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, user: null })
      },
      isLoggedIn: () => !!get().token,
    }),
    { name: 'auth-storage' }
  )
)
