import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import type { Role } from '../api'
import { useAuth } from '../auth/AuthContext'
import { Button, Loading } from './ui'

/**
 * 로그인과 역할을 확인하는 화면 틀. 화면 가드는 편의일 뿐이고, 실제 접근 통제는 서버가 한다(F7).
 */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) {
    return (
      <div className="p-8">
        <Loading />
      </div>
    )
  }
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={homeOf(role === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN')} replace />

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link to={homeOf(user!.role)} className="font-semibold text-gray-900">
            사내 직원 관리 시스템
          </Link>
          {user!.role === 'ADMIN' && (
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link to="/admin" className="hover:text-gray-900">
                직원 목록
              </Link>
              <Link to="/admin/employees/new" className="hover:text-gray-900">
                계정 생성
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {user!.displayName}
            {user!.employeeNo && <span className="ml-1 text-gray-400">({user!.employeeNo})</span>}
          </span>
          <Button variant="secondary" onClick={onLogout}>
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function homeOf(role: Role): string {
  return role === 'ADMIN' ? '/admin' : '/me'
}

/** "/" 진입 시 역할에 맞는 첫 화면으로 보낸다 */
export function RootRedirect() {
  const { user } = useAuth()
  if (user === undefined) return null
  return <Navigate to={user ? homeOf(user.role) : '/login'} replace />
}
