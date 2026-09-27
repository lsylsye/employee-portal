import { useState } from 'react'
import { ApiError } from '../api'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from './useLoad'

/** 저장·실행 버튼 공통. 401 이면 로그인 화면으로, 나머지 오류는 메시지로 보여 준다 */
export function useSubmit() {
  const { sessionExpired } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(action: () => Promise<void>) {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) sessionExpired()
      else setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return { error, submitting, submit }
}
