import { type Api, ApiError, messageOf } from './api'
import type { ApiErrorBody } from './types'

// 세션 쿠키 인증. 같은 origin 이라 credentials 기본값(same-origin)으로 쿠키가 실린다.
// CSRF(N2): 서버가 XSRF-TOKEN 쿠키를 내려주고, 상태를 바꾸는 요청은 그 값을 X-XSRF-TOKEN 헤더로 보낸다.
// 로그인 요청에도 필요하고, 로그인·로그아웃 때 토큰이 바뀌거나 지워진다. 그래서 쿠키가 없으면 먼저 발급받는다.
function csrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function ensureCsrf(): Promise<string | null> {
  if (!csrfCookie()) await fetch('/api/auth/csrf')
  return csrfCookie()
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const token = await ensureCsrf()
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  return fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body)

  // 토큰이 어긋났으면(다른 탭에서 로그아웃 등) 한 번만 새로 받아 다시 보낸다
  if (res.status === 403 && method !== 'GET') {
    const err = (await res.clone().json().catch(() => null)) as ApiErrorBody | null
    if (err?.code === 'CSRF_INVALID') {
      await fetch('/api/auth/csrf')
      res = await send(method, path, body)
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null
    const code = err?.code ?? null
    throw new ApiError(res.status, code, messageOf(code, err?.message, res.status))
  }
  if (res.status === 204 || res.headers.get('Content-Length') === '0') return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const enc = encodeURIComponent
const employee = (no: string) => `/api/admin/employees/${enc(no)}`

export const httpApi: Api = {
  login: (req) => request('POST', '/api/auth/login', req),
  logout: () => request('POST', '/api/auth/logout'),
  currentUser: async () => {
    try {
      return await request('GET', '/api/auth/me')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  },

  getMyProfile: () => request('GET', '/api/me/profile'),
  updateMyProfile: (req) => request('PATCH', '/api/me/profile', req),
  listMyBackgroundChecks: () => request('GET', '/api/me/background-checks'),

  listEmployees: () => request('GET', '/api/admin/employees'),
  getEmployee: (no) => request('GET', employee(no)),
  createEmployee: (req) => request('POST', '/api/admin/employees', req),
  updateEmployee: (no, req) => request('PATCH', employee(no), req),
  setAccessBlock: (no, req) => request('PUT', `${employee(no)}/access-block`, req),
  cancelAccessBlock: (no) => request('DELETE', `${employee(no)}/access-block`),

  listBackgroundChecks: (no) => request('GET', `${employee(no)}/background-checks`),
  requestBackgroundCheck: (no) => request('POST', `${employee(no)}/background-checks`),
  getBackgroundCheckDetail: (id) => request('GET', `/api/admin/background-checks/${id}`),
}
