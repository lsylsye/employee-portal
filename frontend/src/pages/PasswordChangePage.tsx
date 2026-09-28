import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { Field, InlineError, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'

export function PasswordChangePage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { sessionExpired } = useAuth()
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (newPassword !== confirmation) return setError('새 비밀번호가 서로 일치하지 않아요.')
    if (!newPassword.trim() || newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) return setError('새 비밀번호는 8자 이상, 72바이트 이하로 입력해 주세요.')
    if (currentPassword === newPassword) return setError('현재 비밀번호와 다른 비밀번호를 입력해 주세요.')
    setBusy(true)
    try {
      await api.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      sessionExpired()
      toast.success('비밀번호를 변경했어요. 새 비밀번호로 로그인해 주세요.')
      navigate('/login', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) sessionExpired()
      setError(e instanceof Error ? e.message : '비밀번호를 변경하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <PageHeader title="비밀번호 변경" description="변경하면 모든 기기에서 로그아웃돼요. 새 비밀번호로 다시 로그인해 주세요." />
    <form onSubmit={submit} className="grid max-w-lg gap-6 rounded-xl border bg-card p-6">
      <Field label="현재 비밀번호" type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={busy} />
      <Field label="새 비밀번호" type="password" autoComplete="new-password" required minLength={8} maxLength={72} hint="8자 이상으로 입력해 주세요. 영문·숫자는 최대 72자, 한글은 최대 24자예요." value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={busy} />
      <Field label="새 비밀번호 확인" type="password" autoComplete="new-password" required maxLength={72} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} />
      {error && <InlineError>{error}</InlineError>}
      <Button type="submit" disabled={busy}>{busy ? '변경하는 중…' : '비밀번호 변경하기'}</Button>
    </form>
  </>
}
