// 프론트 ↔ 백엔드 API 계약. 백엔드 DTO(record)는 이 형태를 기준으로 만든다.
// 날짜는 'YYYY-MM-DD'(KST 기준 날짜), 시각은 ISO-8601 UTC 문자열. 화면에서 KST로 바꿔 보여준다(N15).
// ⚠️ 잠정: 아직 판단하지 않은 항목. 확정되면 이 주석을 지운다.

export type Role = 'ADMIN' | 'EMPLOYEE'

/** 세션 사용자. GET /api/auth/me, POST /api/auth/login 응답 */
export type SessionUser = {
  username: string
  role: Role
  /** 관리자는 직원 레코드가 없어서 null (⚠️ 잠정 F-c: 관리자는 시드 밖 별도 계정) */
  employeeNo: string | null
  displayName: string
}

export type LoginRequest = { username: string; password: string }

/** 직원이 직접 고칠 수 있는 인적사항 (⚠️ 잠정 F-a) */
export type ContactFields = {
  phone: string
  email: string
  address: string
}

/**
 * 직원 본인 정보. GET /api/me
 * 성명·생년월일은 BG 조회 입력값이라 본인이 수정하지 않는다(F-b).
 */
export type MyProfile = ContactFields & {
  employeeNo: string
  fullName: string
  birthDate: string | null
  /** 판단 (3) b안: 조회 일자와 진행 상태만. 판정·상세는 주지 않는다 */
  backgroundChecks: { requestedAt: string; state: 'IN_PROGRESS' | 'DONE' }[]
}

/** PUT /api/me 요청. 즉시 반영 (⚠️ 잠정: 판단 (4) 미정) */
export type UpdateMyProfileRequest = ContactFields

/**
 * 재직 상태. 저장하지 않고 접근 차단일과 오늘(KST)로 계산한다(DECISIONS 1).
 * - ACTIVE: 차단일 없음
 * - RESIGN_SCHEDULED: 차단일 > 오늘
 * - RESIGNED: 차단일 <= 오늘
 */
export type EmploymentStatus = 'ACTIVE' | 'RESIGN_SCHEDULED' | 'RESIGNED'

/** 외부 API 상태 + 우리 쪽 폴링 포기 상태(N11) */
export type BgStatus = 'pending' | 'clear' | 'flagged' | 'needs_attention'

/** GET /api/admin/employees 항목. 동명이인 구분을 위해 사번·생년월일을 항상 같이 준다(F-i) */
export type EmployeeSummary = {
  employeeNo: string
  fullName: string
  birthDate: string | null
  status: EmploymentStatus
  accessBlockedFrom: string | null
  /** 목록에는 판정만 (판단 3) */
  latestBgStatus: BgStatus | null
}

/** GET /api/admin/employees/{employeeNo} */
export type EmployeeDetail = EmployeeSummary &
  ContactFields & {
    /** lastName = 성. 문자열 분리가 아니라 저장된 값을 쓴다 */
    lastName: string
    firstName: string
    username: string
  }

/**
 * POST /api/admin/employees 요청. 사번은 서버가 발급한다.
 * 생년월일은 비워 둘 수 있다(EMP-007 같은 경우). 대신 BG 실행이 막힌다.
 */
export type CreateEmployeeRequest = {
  lastName: string
  firstName: string
  birthDate: string | null
}

/** POST /api/admin/employees 응답 (⚠️ 잠정 F-d: 아이디=사번, 초기 비밀번호는 이 응답에서 한 번만 보여준다) */
export type CreateEmployeeResponse = {
  employee: EmployeeDetail
  username: string
  initialPassword: string
}

/** PATCH /api/admin/employees/{employeeNo}: 성·이름 정정, 생년월일 입력(F-e) */
export type UpdateEmployeeIdentityRequest = {
  lastName: string
  firstName: string
  birthDate: string | null
}

/** POST /api/admin/employees/{employeeNo}/resignation. 차단일 기본값은 오늘(KST) */
export type ResignRequest = { accessBlockedFrom: string }

/** GET /api/admin/employees/{employeeNo}/background-checks 항목. 판정만 */
export type BgCheckSummary = {
  id: number
  requestedAt: string
  status: BgStatus
  completedAt: string | null
}

/**
 * GET /api/admin/background-checks/{id}. "결과 보기"로 열 때만 호출하고, 열람 기록이 남는다.
 * creditScore는 수집하지 않는다(최소 수집). 응답은 Cache-Control: no-store.
 */
export type BgCheckDetail = BgCheckSummary & {
  criminalRecord: boolean | null
  educationVerified: boolean | null
  employmentVerified: boolean | null
}

/** 오류 응답 공통 형태 */
export type ApiErrorBody = { message: string }
