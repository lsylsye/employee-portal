import { LogOut, ShieldX, UserRound, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import type { Role } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { Loading, StatusPage } from '@/components/common'
import { Button } from '@/components/ui/button'

type MenuItem = { to: string; label: string; icon: LucideIcon }

// 역할별 메뉴. 직원은 내 정보 하나, 관리자는 직원 목록 하나
const MENUS: Record<Role, MenuItem[]> = {
  EMPLOYEE: [{ to: '/me', label: '내 정보', icon: UserRound }],
  ADMIN: [{ to: '/admin', label: '직원 목록', icon: Users }],
}

/**
 * 로그인과 역할을 확인하고 앱 셸(사이드바 + 본문)을 그린다.
 * 화면 가드는 편의일 뿐이고, 실제 접근 통제는 서버가 한다(F7).
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

  // 다른 역할의 페이지: 조용히 옮기지 않고, 주소를 그대로 둔 채 이유와 돌아갈 길을 보여 준다
  return <AppShell>{user.role === role ? <Outlet /> : <Forbidden required={role} home={user.role} />}</AppShell>
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  )
}

const FORBIDDEN_REASON: Record<Role, string> = {
  ADMIN: '이 페이지는 관리자만 볼 수 있어요. 필요한 정보가 있으면 인사 담당자에게 문의해 주세요.',
  EMPLOYEE: '이 페이지는 직원 본인만 볼 수 있어요. 관리자 계정에는 직원 정보가 연결돼 있지 않아요.',
}

const HOME_LABEL: Record<Role, string> = {
  EMPLOYEE: '내 정보로 가기',
  ADMIN: '직원 목록으로 가기',
}

/** 403: 로그인은 됐지만 역할이 다른 페이지 */
function Forbidden({ required, home }: { required: Role; home: Role }) {
  return (
    <StatusPage
      icon={ShieldX}
      code="403"
      title="접근 권한이 없어요"
      description={FORBIDDEN_REASON[required]}
      action={
        <Button asChild>
          <Link to={homeOf(home)}>{HOME_LABEL[home]}</Link>
        </Button>
      }
    />
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-4 py-6">
      <p className="px-2 text-sm font-semibold">사내 직원 관리</p>
      <nav className="mt-6 grid gap-1">
        {MENUS[user!.role].map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            // 관리자 직원 목록은 상세·생성 화면에서도 선택된 상태로 둔다
            end={false}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60'
              }`
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t pt-4">
        <p className="px-2 text-sm font-medium">{user!.role === 'ADMIN' ? '관리자' : '직원'}</p>
        <p className="px-2 text-xs text-muted-foreground">{user!.loginId}</p>
        <Button variant="ghost" className="mt-2 w-full justify-start" onClick={onLogout}>
          <LogOut aria-hidden />
          로그아웃하기
        </Button>
      </div>
    </aside>
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
