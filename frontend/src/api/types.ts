// 프론트 ↔ 백엔드 API 계약. 기준은 루트 README "API 목록"이다.
// 날짜는 'YYYY-MM-DD'(KST 기준 날짜), 시각은 ISO-8601 UTC 문자열. 화면에서 KST로 바꿔 보여준다(N15).
// 필드 이름은 백엔드 엔티티(Employee)와 같게 둔다. [미구현] 표시는 백엔드가 아직 없는 API 라서,
// 구현할 때 이 이름을 따르거나 여기를 고친다.

export type Role = 'ADMIN' | 'EMPLOYEE'

/** GET /api/auth/me, POST /api/auth/login 응답 (AuthController.MeResponse) */
export type SessionUser = {
  loginId: string
  role: Role
  /** 관리자는 직원 레코드가 없는 별도 계정이라 null (F-c) */
  employeeNo: string | null
}

/** POST /api/auth/login 요청 */
export type LoginRequest = { loginId: string; password: string }

/** 오류 응답 { code, message } (common.ApiError) */
export type ApiErrorBody = { code: string; message: string }

/** 직원이 직접 고칠 수 있는 인적사항 (F-a). 성명·생년월일은 관리자만 수정(F-b) */
export type ContactFields = {
  phone: string | null
  email: string | null
  address: string | null
  emergencyContact: string | null
}

/** GET /api/me/profile (MyProfileController.Profile) */
export type MyProfile = ContactFields & {
  employeeNo: string
  fullName: string
  birthDate: string | null
}

/**
 * PATCH /api/me/profile. 허용 필드만 받는 전용 DTO (판단 4).
 * null(또는 생략)은 "바꾸지 않음", 빈 문자열은 "지움"이다. 그래서 화면은 입력값을 문자열 그대로 보낸다.
 */
export type UpdateMyProfileRequest = { [K in keyof ContactFields]: string }

/** [미구현] GET /api/me/background-checks 항목. 조회 일자와 진행 상태만 (판단 3) */
export type MyBackgroundCheck = { requestedAt: string; state: 'IN_PROGRESS' | 'DONE' }

/**
 * 재직 상태. 저장하지 않고 접근 차단일과 오늘(KST)로 계산한다(DECISIONS 1).
 * - ACTIVE 재직: 차단일 없음
 * - BLOCK_SCHEDULED 차단 예정: 차단일 > 오늘
 * - BLOCKED 차단: 차단일 <= 오늘
 */
export type EmploymentStatus = 'ACTIVE' | 'BLOCK_SCHEDULED' | 'BLOCKED'

/** 외부 API 상태 + 우리 쪽 폴링 포기 상태(N11, 화면 표기 "추적 실패") */
export type BgStatus = 'pending' | 'clear' | 'flagged' | 'needs_attention'

/** GET /api/admin/employees 항목(AdminEmployeeDto.Summary). 동명이인 구분을 위해 사번·생년월일을 항상 같이 준다(F-i) */
export type EmployeeSummary = {
  employeeNo: string
  fullName: string
  birthDate: string | null
  status: EmploymentStatus
  accessBlockedOn: string | null
  /** 목록에는 판정만 (판단 3). [미구현] feat/background-check 에서 추가되기 전에는 필드가 없다 */
  latestBgStatus?: BgStatus | null
}

/** GET /api/admin/employees/{employeeNo} (AdminEmployeeDto.Detail) */
export type EmployeeDetail = EmployeeSummary &
  ContactFields & {
    /** lastName = 성. 문자열 분리가 아니라 저장된 값을 쓴다 */
    lastName: string
    firstName: string
    /** 계정이 없으면 null (시드 9명은 계정 없음) */
    loginId: string | null
  }

/**
 * POST /api/admin/employees (AdminEmployeeDto.CreateRequest). 201.
 * 성·이름은 공백 없이(성명 = 성 + 이름). 연락처도 함께 받을 수 있지만 화면에서는 직원이 채운다. 사번은 서버가 시퀀스로 발급(EMP-011~).
 * 생년월일은 비워 둘 수 있다(EMP-007 같은 경우). 대신 BG 실행이 막힌다.
 */
export type CreateEmployeeRequest = {
  lastName: string
  firstName: string
  birthDate: string | null
}

/** POST /api/admin/employees 응답(AdminEmployeeDto.Created). 아이디=사번, 임시 비밀번호는 이 응답에서 한 번만 온다(F-d) */
export type CreateEmployeeResponse = {
  employee: EmployeeDetail
  loginId: string
  temporaryPassword: string
}

/**
 * PATCH /api/admin/employees/{employeeNo}: 성·이름 정정, 생년월일 입력(F-e).
 * null 인 필드는 바꾸지 않는다(생년월일을 비우는 수단은 없다).
 */
export type UpdateEmployeeRequest = {
  lastName: string
  firstName: string
  birthDate: string | null
}

/** PUT /api/admin/employees/{employeeNo}/access-block. 그날 00:00 KST 부터 차단. 응답은 Detail(화면은 다시 읽는다) */
export type AccessBlockRequest = { blockedOn: string }

/** [미구현] GET /api/admin/employees/{employeeNo}/background-checks 항목. 판정만 */
export type BgCheckSummary = {
  id: number
  requestedAt: string
  status: BgStatus
  completedAt: string | null
}

/**
 * [미구현] GET /api/admin/background-checks/{id}. "결과 보기"로 열 때만 호출하고, 열람 기록이 남는다.
 * creditScore는 수집하지 않는다(최소 수집). 응답은 Cache-Control: no-store.
 */
export type BgCheckDetail = BgCheckSummary & {
  criminalRecord: boolean | null
  educationVerified: boolean | null
  employmentVerified: boolean | null
}
