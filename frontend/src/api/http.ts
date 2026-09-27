import { type Api, ApiError } from './api'

// 세션 쿠키 인증. 같은 origin 이라 credentials 기본값(same-origin)으로 쿠키가 실린다.
// CSRF: Spring CookieCsrfTokenRepository 가 내려주는 XSRF-TOKEN 쿠키를 헤더로 되돌려 보낸다(N2).
function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const token = csrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(res.status, data?.message ?? `요청을 처리하지 못했어요 (HTTP ${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const enc = encodeURIComponent

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

  getMyProfile: () => request('GET', '/api/me'),
  updateMyProfile: (req) => request('PUT', '/api/me', req),

  listEmployees: () => request('GET', '/api/admin/employees'),
  getEmployee: (no) => request('GET', `/api/admin/employees/${enc(no)}`),
  createEmployee: (req) => request('POST', '/api/admin/employees', req),
  updateEmployeeIdentity: (no, req) => request('PATCH', `/api/admin/employees/${enc(no)}`, req),
  resignEmployee: (no, req) => request('POST', `/api/admin/employees/${enc(no)}/resignation`, req),

  listBackgroundChecks: (no) => request('GET', `/api/admin/employees/${enc(no)}/background-checks`),
  requestBackgroundCheck: (no) => request('POST', `/api/admin/employees/${enc(no)}/background-checks`),
  getBackgroundCheckDetail: (id) => request('GET', `/api/admin/background-checks/${id}`),
}
