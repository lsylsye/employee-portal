import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { homeOf } from '../components/Layout'
import { Alert, Button, Field } from '../components/ui'
import { errorMessage } from '../lib/useLoad'

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">사내 직원 관리 시스템</h1>
        <Field
          label="아이디"
          hint="직원은 사번(예: EMP-001)"
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
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? '로그인 중...' : '로그인'}
        </Button>
      </form>
    </div>
  )
}
