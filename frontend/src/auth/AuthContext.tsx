import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { api, ApiError, messageOf, type LoginRequest, type Role, type SessionUser } from '../api'

type AuthState = {
  /** undefined: 아직 확인 중, null: 로그인 안 됨 */
  user: SessionUser | null | undefined
  /**
   * 로그인. expectedRole 은 로그인 화면에서 고른 역할이다.
   * 실제 계정 역할과 다르면 세션을 바로 닫고, 일반 로그인 실패와 같은 오류를 던진다(메시지 통일, DECISIONS 1).
   */
  login(req: LoginRequest, expectedRole: Role): Promise<SessionUser>
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

  const login = useCallback(async (req: LoginRequest, expectedRole: Role) => {
    const u = await api.login(req)
    if (u.role !== expectedRole) {
      // 사용자 상태에 올리기 전에 검사해서 화면이 다른 역할로 넘어가지 않게 한다
      await api.logout().catch(() => undefined)
      throw new ApiError(401, 'INVALID_CREDENTIALS', messageOf('INVALID_CREDENTIALS', undefined, 401))
    }
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
