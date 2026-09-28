import { Loader2, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import type { Role } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { Field, InlineError } from '@/components/common'
import { homeOf } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/useLoad'

type RoleOption = {
  role: Role
  label: string
  icon: LucideIcon
  idLabel: string
  placeholder: string
  description: string
  /** 조사가 달라서(직원으로 / 관리자로) 문구를 통째로 둔다 */
  submitLabel: string
}

// 로그인 유형. 화면 안내일 뿐이고 접근 통제는 서버가 한다.
// 고른 유형과 계정 역할이 다르면 일반 로그인 실패와 같은 메시지를 보여 준다(AuthContext.login).
const ROLE_OPTIONS: RoleOption[] = [
  { role: 'EMPLOYEE', label: '직원', icon: UserRound, idLabel: '사번', placeholder: 'EMP-003', description: '사번과 비밀번호로 로그인해 주세요.', submitLabel: '직원으로 로그인하기' },
  { role: 'ADMIN', label: '관리자', icon: ShieldCheck, idLabel: '관리자 아이디', placeholder: 'admin', description: '관리자 아이디와 비밀번호로 로그인해 주세요.', submitLabel: '관리자로 로그인하기' },
]

// 마지막으로 고른 유형을 기억해서 관리자는 다음부터 관리자 탭으로 열리게 한다(편의용, 없어도 동작)
const ROLE_KEY = 'login-role'

function savedRole(): Role {
  try {
    return localStorage.getItem(ROLE_KEY) === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'
  } catch {
    return 'EMPLOYEE'
  }
}

function saveRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    // 저장소를 못 쓰면 기억하지 않는다
  }
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [role, setRole] = useState<Role>(savedRole)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homeOf(user.role)} replace />

  const option = ROLE_OPTIONS.find((o) => o.role === role)!

  function changeRole(next: Role) {
    setRole(next)
    setError(null)
    saveRole(next)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const u = await login({ loginId: loginId.trim(), password }, role)
      // 로그인 전에 가려던 화면이 역할에 맞으면 그리로 보낸다
      const from = (location.state as { from?: string } | null)?.from
      const home = homeOf(u.role)
      navigate(from?.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      // 실패 이유(없는 계정, 비밀번호, 퇴사, 유형 불일치)와 관계없이 같은 메시지다
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>사내 직원 관리</CardTitle>
          <CardDescription>{option.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            {/* 네이티브 라디오라서 키보드(방향키)와 스크린리더가 그대로 동작한다 */}
            <fieldset className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <legend className="sr-only">로그인 유형</legend>
              {ROLE_OPTIONS.map(({ role: value, label, icon: Icon }) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="login-role"
                    value={value}
                    checked={role === value}
                    onChange={() => changeRole(value)}
                    className="peer sr-only"
                  />
                  <span className="flex h-8 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </span>
                </label>
              ))}
            </fieldset>
            <Field
              label={option.idLabel}
              placeholder={option.placeholder}
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
            <Field
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <InlineError>{error}</InlineError>}
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden />}
              {option.submitLabel}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
