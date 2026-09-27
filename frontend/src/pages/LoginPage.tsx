import { Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { Field, InlineError } from '@/components/common'
import { homeOf } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/useLoad'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homeOf(user.role)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const u = await login({ username: username.trim(), password })
      // 로그인 전에 가려던 화면이 역할에 맞으면 그리로 보낸다
      const from = (location.state as { from?: string } | null)?.from
      const home = homeOf(u.role)
      navigate(from?.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      // 실패 이유(없는 계정, 비밀번호, 퇴사)는 서버가 한 메시지로 통일해서 준다
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
          <CardDescription>사번이나 관리자 아이디로 로그인해 주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field
              label="아이디"
              placeholder="EMP-001"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              로그인하기
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
