// 백엔드가 생기기 전까지 쓰는 목 구현. 규칙은 백엔드가 지킬 동작을 흉내만 낸다(README "API 목록").
// 상태는 sessionStorage 에 둬서 새로고침해도 유지되고, 탭을 닫으면 초기화된다.
// 목 계정: admin / admin1234, 제출용 직원 EMP-003 / password. 시드 나머지 9명은 계정이 없다.
// 새로 등록한 직원은 계정과 임시 비밀번호가 함께 생긴다.
import { todayKst } from '../lib/date'
import { type Api, ApiError, messageOf } from './api'
import type {
  BgCheckDetail,
  BgCheckSummary,
  ContactFields,
  EmployeeDetail,
  EmployeeSummary,
  EmploymentStatus,
  MyProfile,
  SessionUser,
} from './types'

type MockEmployee = ContactFields & {
  employeeNo: string
  lastName: string
  firstName: string
  birthDate: string | null
  accessBlockedOn: string | null
}

type MockAccount = { loginId: string; password: string; employeeNo: string | null }

type MockBg = BgCheckDetail & { employeeNo: string; finalStatus: 'clear' | 'flagged' }

type MockDb = {
  employees: MockEmployee[]
  accounts: MockAccount[]
  checks: MockBg[]
  nextEmployeeNo: number
  nextBgId: number
  session: string | null // loginId
}

const STORAGE_KEY = 'mock-db-v2'
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
  const employees: MockEmployee[] = rows.map(([employeeNo, lastName, firstName, birthDate], i) => ({
    employeeNo,
    lastName,
    firstName,
    birthDate,
    phone: `010-1000-${String(1001 + i)}`,
    email: `${employeeNo.toLowerCase()}@example.com`,
    address: '서울특별시',
    emergencyContact: null,
    accessBlockedOn: null,
  }))
  const accounts: MockAccount[] = [
    { loginId: 'admin', password: 'admin1234', employeeNo: null },
    { loginId: 'EMP-003', password: 'password', employeeNo: 'EMP-003' },
  ]
  const now = Date.now()
  const checks: MockBg[] = [
    bg(1, 'EMP-001', 'clear', now - 3 * 86400_000, now - 3 * 86400_000 + 61_000),
    bg(2, 'EMP-003', 'flagged', now - 86400_000, now - 86400_000 + 45_000),
  ]
  return { employees, accounts, checks, nextEmployeeNo: 11, nextBgId: 3, session: null }
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

/** 서버의 { code, message } 오류를 흉내 낸다. 문구는 http 구현과 같은 코드 매핑을 쓴다 */
function fail(status: number, code: string, message?: string): never {
  throw new ApiError(status, code, messageOf(code, message, status))
}

// 판정은 요청마다 차단일 <= 오늘(KST) 비교 (DECISIONS 1)
function statusOf(e: MockEmployee): EmploymentStatus {
  if (!e.accessBlockedOn) return 'ACTIVE'
  return e.accessBlockedOn <= todayKst() ? 'BLOCKED' : 'BLOCK_SCHEDULED'
}

/** pending 이 충분히 지났으면 최종 상태로 바꾼다(백엔드 폴링 흉내) */
function settle(c: MockBg) {
  if (c.status !== 'pending') return
  const requested = Date.parse(c.requestedAt)
  if (Date.now() - requested < MOCK_PENDING_MS) return
  Object.assign(c, bg(c.id, c.employeeNo, c.finalStatus, requested, requested + MOCK_PENDING_MS))
}

function checksOf(employeeNo: string): MockBg[] {
  return data()
    .checks.filter((c) => c.employeeNo === employeeNo)
    .map((c) => (settle(c), c))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
}

function contact(e: MockEmployee): ContactFields {
  return { phone: e.phone, email: e.email, address: e.address, emergencyContact: e.emergencyContact }
}

function toSummary(e: MockEmployee): EmployeeSummary {
  return {
    employeeNo: e.employeeNo,
    fullName: e.lastName + e.firstName,
    birthDate: e.birthDate,
    status: statusOf(e),
    accessBlockedOn: e.accessBlockedOn,
    latestBgStatus: checksOf(e.employeeNo)[0]?.status ?? null,
  }
}

function toDetail(e: MockEmployee): EmployeeDetail {
  const account = data().accounts.find((a) => a.employeeNo === e.employeeNo)
  return { ...toSummary(e), ...contact(e), lastName: e.lastName, firstName: e.firstName, loginId: account?.loginId ?? null }
}

function toProfile(e: MockEmployee): MyProfile {
  return { employeeNo: e.employeeNo, fullName: e.lastName + e.firstName, birthDate: e.birthDate, ...contact(e) }
}

function toBgSummary(c: MockBg): BgCheckSummary {
  return { id: c.id, requestedAt: c.requestedAt, status: c.status, completedAt: c.completedAt }
}

function sessionUser(): SessionUser | null {
  const db = data()
  const account = db.accounts.find((a) => a.loginId === db.session)
  if (!account) return null
  if (account.employeeNo === null) return { loginId: account.loginId, role: 'ADMIN', employeeNo: null }
  // 퇴사(차단일 도래)면 기존 세션도 다음 요청에서 끊긴다
  const e = db.employees.find((x) => x.employeeNo === account.employeeNo)
  if (!e || statusOf(e) === 'BLOCKED') {
    db.session = null
    return null
  }
  return { loginId: account.loginId, role: 'EMPLOYEE', employeeNo: e.employeeNo }
}

function requireRole(role: 'ADMIN' | 'EMPLOYEE'): SessionUser {
  const user = sessionUser()
  if (!user) fail(401, 'UNAUTHENTICATED')
  if (user.role !== role) fail(403, 'FORBIDDEN')
  return user
}

function findEmployee(employeeNo: string): MockEmployee {
  const e = data().employees.find((x) => x.employeeNo === employeeNo)
  if (!e) fail(404, 'NOT_FOUND', '직원을 찾을 수 없어요.')
  return e
}

function requireName(lastName: string, firstName: string) {
  // 서버: 공백 없이 1자 이상 (성명 = 성 + 이름)
  if (!/^\S+$/.test(lastName) || !/^\S+$/.test(firstName)) fail(400, 'INVALID_REQUEST')
}

// 서버와 같게: null 은 바꾸지 않음, 문자열(빈 문자열 포함)은 그 값으로 저장
const keepOrSet = (next: string | null | undefined, prev: string | null) => (next == null ? prev : next.trim())

export const mockApi: Api = {
  login: ({ loginId, password }) =>
    delay(() => {
      const db = data()
      const account = db.accounts.find((a) => a.loginId === loginId)
      // 실패 이유(없는 아이디, 비밀번호, 차단)와 관계없이 같은 응답 (DECISIONS 1)
      if (!account || account.password !== password) fail(401, 'INVALID_CREDENTIALS')
      db.session = account.loginId
      const user = sessionUser()
      if (!user) fail(401, 'INVALID_CREDENTIALS')
      return user
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
      // 허용 필드만 반영한다(전용 DTO, 판단 4)
      Object.assign(e, {
        phone: keepOrSet(req.phone, e.phone),
        email: keepOrSet(req.email, e.email),
        address: keepOrSet(req.address, e.address),
        emergencyContact: keepOrSet(req.emergencyContact, e.emergencyContact),
      })
      return toProfile(e)
    }),
  listMyBackgroundChecks: () =>
    delay(() =>
      checksOf(requireRole('EMPLOYEE').employeeNo!).map((c) => ({
        requestedAt: c.requestedAt,
        state: c.status === 'pending' ? ('IN_PROGRESS' as const) : ('DONE' as const),
      })),
    ),

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
      const db = data()
      // 사번은 시퀀스로 발급(EMP-011~). 형식은 앱에서 만든다
      const employeeNo = `EMP-${String(db.nextEmployeeNo++).padStart(3, '0')}`
      const temporaryPassword = Math.random().toString(36).slice(2, 12)
      const e: MockEmployee = {
        employeeNo,
        lastName: req.lastName.trim(),
        firstName: req.firstName.trim(),
        birthDate: req.birthDate || null,
        phone: null,
        email: null,
        address: null,
        emergencyContact: null,
        accessBlockedOn: null,
      }
      db.employees.push(e)
      db.accounts.push({ loginId: employeeNo, password: temporaryPassword, employeeNo })
      return { employee: toDetail(e), loginId: employeeNo, temporaryPassword }
    }),
  updateEmployee: (no, req) =>
    delay(() => {
      requireRole('ADMIN')
      requireName(req.lastName, req.firstName)
      const e = findEmployee(no)
      Object.assign(e, { lastName: req.lastName.trim(), firstName: req.firstName.trim(), birthDate: req.birthDate || null })
      return toDetail(e)
    }),
  setAccessBlock: (no, req) =>
    delay(() => {
      requireRole('ADMIN')
      if (!req.blockedOn) fail(400, 'INVALID_REQUEST', '접근 차단일을 입력해 주세요.')
      findEmployee(no).accessBlockedOn = req.blockedOn
    }),
  cancelAccessBlock: (no) =>
    delay(() => {
      requireRole('ADMIN')
      findEmployee(no).accessBlockedOn = null
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
      if (statusOf(e) === 'BLOCKED') fail(422, 'BG_BLOCKED_EMPLOYEE', '퇴사한 직원은 신원 조회를 할 수 없어요.')
      if (!e.birthDate) fail(422, 'BG_BIRTH_DATE_MISSING', '생년월일이 확인되지 않아 신원 조회를 할 수 없어요.')
      if (checksOf(no).some((c) => c.status === 'pending')) fail(409, 'BG_IN_PROGRESS', '진행 중인 조회가 있어요.')
      const db = data()
      db.checks.push(bg(db.nextBgId++, no, Math.random() < 0.8 ? 'clear' : 'flagged', Date.now(), null))
    }, 600),
  getBackgroundCheckDetail: (id) =>
    delay(() => {
      requireRole('ADMIN')
      const c = data().checks.find((x) => x.id === id)
      if (!c) fail(404, 'NOT_FOUND', '조회 결과를 찾을 수 없어요.')
      settle(c)
      return {
        ...toBgSummary(c),
        criminalRecord: c.criminalRecord,
        educationVerified: c.educationVerified,
        employmentVerified: c.employmentVerified,
      }
    }),
}
