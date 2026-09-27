import type { Api } from './api'
import { httpApi } from './http'
import { mockApi } from './mock'

// 백엔드 API 가 생기기 전까지 `npm run dev:mock` 으로 목을 쓴다(VITE_USE_MOCK=true).
// 배포 빌드는 기본값이 실제 API 다.
export const api: Api = import.meta.env.VITE_USE_MOCK === 'true' ? mockApi : httpApi

export { ApiError } from './api'
export type * from './types'
