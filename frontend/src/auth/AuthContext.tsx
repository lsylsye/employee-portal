import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { api, type LoginRequest, type SessionUser } from '../api'

type AuthState = {
  /** undefined: 아직 확인 중, null: 로그인 안 됨 */
  user: SessionUser | null | undefined
  login(req: LoginRequest): Promise<SessionUser>
  logout(): Promise<void>
  /** API 가 401 을 주면 호출한다. 퇴사 처리로 세션이 끊긴 경우도 여기로 온다 */
  sessionExpired(): void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)

  useEffect(() => {
    api
      .currentUser()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  const login = useCallback(async (req: LoginRequest) => {
    const u = await api.login(req)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
  }, [])

  const sessionExpired = useCallback(() => setUser(null), [])

  return <AuthContext.Provider value={{ user, login, logout, sessionExpired }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 밖에서 useAuth 를 호출했습니다')
  return ctx
}
