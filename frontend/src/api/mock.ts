// 백엔드가 생기기 전까지 쓰는 목 구현. 규칙은 백엔드가 지킬 동작을 흉내만 낸다.
// 상태는 sessionStorage 에 둬서 새로고침해도 유지되고, 탭을 닫으면 초기화된다.
// 목 계정: admin / admin1234, 직원은 사번 / password (예: EMP-001 / password)
import { todayKst } from '../lib/date'
import { type Api, ApiError } from './api'
import type {
  BgCheckDetail,
  BgCheckSummary,
  EmployeeDetail,
  EmployeeSummary,
  EmploymentStatus,
  MyProfile,
  SessionUser,
} from './types'

type MockEmployee = {
  employeeNo: string
  lastName: string
  firstName: string
  birthDate: string | null
  phone: string
  email: string
  address: string
  password: string
  accessBlockedFrom: string | null
}

type MockBg = BgCheckDetail & { employeeNo: string; finalStatus: 'clear' | 'flagged' }

type MockDb = {
  employees: MockEmployee[]
  checks: MockBg[]
  nextBgId: number
  session: string | null // username
}

const ADMIN = { username: 'admin', password: 'admin1234', displayName: '관리자' }
const STORAGE_KEY = 'mock-db-v1'
/** pending 이 최종 상태가 되기까지 걸리는 시간(목). 실측 p50 61s 는 시연에 길어서 줄였다 */
const MOCK_PENDING_MS = 8000

// 시드 10명. 성·이름은 문자열 분리가 아니라 명시적으로 나눈 값(requirements §1)
function seed(): MockDb {
  const rows: [string, string, string, string | null][] = [
    ['EMP-001', '김', '민준', '1990-03-15'],
    ['EMP-002', '김', '민준', '1994-11-02'],
    ['EMP-003', '남궁', '서준', '1988-07-21'],
    ['EMP-004', '황보', '라온', '1995-02-09'],
    ['EMP-005', '김', '솔', '1992-12-30'],
    ['EMP-006', '선우', '진', '1991-05-05'],
    ['EMP-007', '이', '서연', null],
    ['EMP-008', '박', '민준', '1993-08-17'],
    ['EMP-009', '최', '지우', '1996-04-03'],
    ['EMP-010', '정', '하윤', '1989-10-11'],
  ]
  const employees = rows.map(([employeeNo, lastName, firstName, birthDate], i) => ({
    employeeNo,
    lastName,
    firstName,
    birthDate,
    phone: `010-1000-${String(1001 + i)}`,
    email: `${employeeNo.toLowerCase()}@example.com`,
    address: '서울특별시',
    password: 'password',
    accessBlockedFrom: null,
  }))
  const now = Date.now()
  const checks: MockBg[] = [
    bg(1, 'EMP-001', 'clear', now - 3 * 86400_000, now - 3 * 86400_000 + 61_000),
    bg(2, 'EMP-003', 'flagged', now - 86400_000, now - 86400_000 + 45_000),
  ]
  return { employees, checks, nextBgId: 3, session: null }
}

function bg(id: number, employeeNo: string, finalStatus: 'clear' | 'flagged', requested: number, completed: number | null): MockBg {
  const done = completed !== null
  return {
    id,
    employeeNo,
    finalStatus,
    requestedAt: new Date(requested).toISOString(),
    completedAt: done ? new Date(completed).toISOString() : null,
    status: done ? finalStatus : 'pending',
    criminalRecord: done ? finalStatus === 'flagged' : null,
    educationVerified: done ? true : null,
    employmentVerified: done ? finalStatus === 'clear' : null,
  }
}

function load(): MockDb {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    // 저장소를 못 쓰면 시드로 시작한다
  }
  return seed()
}

// 모듈 최상단에서 불러오면 부수효과가 생겨 배포 번들에서 목 코드가 제거되지 않는다. 처음 쓸 때 불러온다
let cached: MockDb | undefined
function data(): MockDb {
  return (cached ??= load())
}

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data()))
  } catch {
    // 목이므로 저장 실패는 무시한다
  }
}

/** 네트워크처럼 보이게 약간 늦춘다 */
function delay<T>(fn: () => T, ms = 250): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const result = fn()
        save()
        resolve(result)
      } catch (e) {
        reject(e)
      }
    }, ms)
  })
}

// 판정은 요청마다 차단일 <= 오늘(KST) 비교 (DECISIONS 1)
function statusOf(e: MockEmployee): EmploymentStatus {
  if (!e.accessBlockedFrom) return 'ACTIVE'
  return e.accessBlockedFrom <= todayKst() ? 'RESIGNED' : 'RESIGN_SCHEDULED'
}

/** pending 이 충분히 지났으면 최종 상태로 바꾼다(백엔드 폴링 흉내) */
function settle(c: MockBg) {
  if (c.status !== 'pending') return
  const requested = Date.parse(c.requestedAt)
  if (Date.now() - requested < MOCK_PENDING_MS) return
  Object.assign(c, bg(c.id, c.employeeNo, c.finalStatus, requested, requested + MOCK_PENDING_MS))
}

function checksOf(employeeNo: string): MockBg[] {
  return data().checks
    .filter((c) => c.employeeNo === employeeNo)
    .map((c) => (settle(c), c))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
}

function toSummary(e: MockEmployee): EmployeeSummary {
  return {
    employeeNo: e.employeeNo,
    fullName: e.lastName + e.firstName,
    birthDate: e.birthDate,
    status: statusOf(e),
    accessBlockedFrom: e.accessBlockedFrom,
    latestBgStatus: checksOf(e.employeeNo)[0]?.status ?? null,
  }
}

function toDetail(e: MockEmployee): EmployeeDetail {
  return {
    ...toSummary(e),
    lastName: e.lastName,
    firstName: e.firstName,
    phone: e.phone,
    email: e.email,
    address: e.address,
    username: e.employeeNo,
  }
}

function toProfile(e: MockEmployee): MyProfile {
  return {
    employeeNo: e.employeeNo,
    fullName: e.lastName + e.firstName,
    birthDate: e.birthDate,
    phone: e.phone,
    email: e.email,
    address: e.address,
    backgroundChecks: checksOf(e.employeeNo).map((c) => ({
      requestedAt: c.requestedAt,
      state: c.status === 'pending' ? 'IN_PROGRESS' : 'DONE',
    })),
  }
}

function toBgSummary(c: MockBg): BgCheckSummary {
  return { id: c.id, requestedAt: c.requestedAt, status: c.status, completedAt: c.completedAt }
}

function sessionUser(): SessionUser | null {
  if (!data().session) return null
  if (data().session === ADMIN.username) {
    return { username: ADMIN.username, role: 'ADMIN', employeeNo: null, displayName: ADMIN.displayName }
  }
  const e = data().employees.find((x) => x.employeeNo === data().session)
  // 퇴사(차단일 도래)면 기존 세션도 다음 요청에서 끊긴다
  if (!e || statusOf(e) === 'RESIGNED') {
    data().session = null
    return null
  }
  return { username: e.employeeNo, role: 'EMPLOYEE', employeeNo: e.employeeNo, displayName: e.lastName + e.firstName }
}

function requireRole(role: 'ADMIN' | 'EMPLOYEE'): SessionUser {
  const user = sessionUser()
  if (!user) throw new ApiError(401, '로그인이 필요합니다.')
  if (user.role !== role) throw new ApiError(403, '권한이 없습니다.')
  return user
}

function findEmployee(employeeNo: string): MockEmployee {
  const e = data().employees.find((x) => x.employeeNo === employeeNo)
  if (!e) throw new ApiError(404, '직원을 찾을 수 없습니다.')
  return e
}

function requireName(lastName: string, firstName: string) {
  if (!lastName.trim() || !firstName.trim()) throw new ApiError(400, '성과 이름을 모두 입력해 주세요.')
}

// 로그인 실패 메시지는 이유와 관계없이 하나 (DECISIONS 1)
const LOGIN_FAILED = '아이디 또는 비밀번호가 올바르지 않습니다.'

export const mockApi: Api = {
  login: ({ username, password }) =>
    delay(() => {
      if (username === ADMIN.username && password === ADMIN.password) {
        data().session = ADMIN.username
        return sessionUser()!
      }
      const e = data().employees.find((x) => x.employeeNo === username)
      if (!e || e.password !== password || statusOf(e) === 'RESIGNED') throw new ApiError(401, LOGIN_FAILED)
      data().session = e.employeeNo
      return sessionUser()!
    }),
  logout: () =>
    delay(() => {
      data().session = null
    }),
  currentUser: () => delay(() => sessionUser(), 50),

  getMyProfile: () => delay(() => toProfile(findEmployee(requireRole('EMPLOYEE').employeeNo!))),
  updateMyProfile: (req) =>
    delay(() => {
      const e = findEmployee(requireRole('EMPLOYEE').employeeNo!)
      Object.assign(e, { phone: req.phone.trim(), email: req.email.trim(), address: req.address.trim() })
      return toProfile(e)
    }),

  listEmployees: () =>
    delay(() => {
      requireRole('ADMIN')
      return data().employees.map(toSummary)
    }),
  getEmployee: (no) =>
    delay(() => {
      requireRole('ADMIN')
      return toDetail(findEmployee(no))
    }),
  createEmployee: (req) =>
    delay(() => {
      requireRole('ADMIN')
      requireName(req.lastName, req.firstName)
      const next = data().employees.length + 1
      const employeeNo = `EMP-${String(next).padStart(3, '0')}`
      const initialPassword = Math.random().toString(36).slice(2, 10)
      const e: MockEmployee = {
        employeeNo,
        lastName: req.lastName.trim(),
        firstName: req.firstName.trim(),
        birthDate: req.birthDate || null,
        phone: '',
        email: '',
        address: '',
        password: initialPassword,
        accessBlockedFrom: null,
      }
      data().employees.push(e)
      return { employee: toDetail(e), username: employeeNo, initialPassword }
    }),
  updateEmployeeIdentity: (no, req) =>
    delay(() => {
      requireRole('ADMIN')
      requireName(req.lastName, req.firstName)
      const e = findEmployee(no)
      Object.assign(e, { lastName: req.lastName.trim(), firstName: req.firstName.trim(), birthDate: req.birthDate || null })
      return toDetail(e)
    }),
  resignEmployee: (no, req) =>
    delay(() => {
      requireRole('ADMIN')
      if (!req.accessBlockedFrom) throw new ApiError(400, '접근 차단일을 입력해 주세요.')
      const e = findEmployee(no)
      e.accessBlockedFrom = req.accessBlockedFrom
      return toDetail(e)
    }),

  listBackgroundChecks: (no) =>
    delay(() => {
      requireRole('ADMIN')
      findEmployee(no)
      return checksOf(no).map(toBgSummary)
    }),
  requestBackgroundCheck: (no) =>
    delay(() => {
      requireRole('ADMIN')
      const e = findEmployee(no)
      if (statusOf(e) === 'RESIGNED') throw new ApiError(409, '퇴사한 직원은 조회할 수 없습니다.')
      if (!e.birthDate) throw new ApiError(422, '생년월일이 확인되지 않아 조회할 수 없습니다.')
      if (checksOf(no).some((c) => c.status === 'pending')) throw new ApiError(409, '진행 중인 조회가 있습니다.')
      const c = bg(data().nextBgId++, no, Math.random() < 0.8 ? 'clear' : 'flagged', Date.now(), null)
      data().checks.push(c)
      return toBgSummary(c)
    }, 600),
  getBackgroundCheckDetail: (id) =>
    delay(() => {
      requireRole('ADMIN')
      const c = data().checks.find((x) => x.id === id)
      if (!c) throw new ApiError(404, '조회 결과를 찾을 수 없습니다.')
      settle(c)
      return {
        ...toBgSummary(c),
        criminalRecord: c.criminalRecord,
        educationVerified: c.educationVerified,
        employmentVerified: c.employmentVerified,
      }
    }),
}
