import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import { useAuth } from '../auth/AuthContext'

/**
 * 화면 진입 시 데이터를 불러오는 공통 훅. 401 이면 세션 만료로 처리해 로그인 화면으로 보낸다.
 * key 가 바뀌면(예: 사번) 다시 불러온다.
 */
export function useLoad<T>(load: () => Promise<T>, key = '') {
  const { sessionExpired } = useAuth()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // load 는 렌더마다 새로 만들어지므로 최신 것을 ref 로 들고 있는다
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current())
      setError(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) sessionExpired()
      else setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sessionExpired])

  useEffect(() => {
    void reload()
  }, [reload, key])

  return { data, setData, error, loading, reload }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '알 수 없는 오류가 생겼어요.'
}
