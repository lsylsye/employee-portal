// 프론트 ↔ 백엔드 API 계약. 기준은 루트 README "API 목록"이다.
// 날짜는 'YYYY-MM-DD'(KST 기준 날짜), 시각은 ISO-8601 UTC 문자열. 화면에서 KST로 바꿔 보여준다(N15).
// 필드 이름은 백엔드 응답(DTO)과 같게 둔다.

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

/**
 * GET /api/me/background-checks 항목(BackgroundCheckDto.MyItem). 조회 일자와 진행 상태만 (판단 3 b안).
 * NOT_COMPLETED 는 시스템 사정으로 끝나지 못한 것(결과 미확인·요청 실패)을 묶은 값이다. 판정(FLAGGED 등)을 드러내지 않는다.
 */
export type MyBackgroundCheck = { requestedAt: string; progress: 'IN_PROGRESS' | 'COMPLETED' | 'NOT_COMPLETED' }

/**
 * 재직 상태. 저장하지 않고 퇴사일(접근 차단일)과 오늘(KST)로 계산한다(DECISIONS 1).
 * - ACTIVE 재직: 차단일 없음
 * - BLOCK_SCHEDULED 차단 예정: 차단일 > 오늘
 * - BLOCKED 차단: 차단일 <= 오늘
 */
export type EmploymentStatus = 'ACTIVE' | 'BLOCK_SCHEDULED' | 'BLOCKED'

/**
 * 신원 조회 상태(BackgroundCheckStatus). FLAGGED 와 UNRESOLVED 는 의미가 완전히 다르다.
 * - PENDING 조회 중
 * - CLEAR 이상 없음 / FLAGGED 검토 필요: 외부 판정(사람이 볼 것)
 * - UNRESOLVED 결과 미확인: 시스템이 결과를 모름(POST 타임아웃·5xx, 폴링 5분 초과, 복구). 외부 목록 조회로 생성 여부 확인 가능
 * - FAILED 요청 실패: 외부가 요청을 4xx 로 거절, 외부에 생성되지 않음
 */
export type BgStatus = 'PENDING' | 'CLEAR' | 'FLAGGED' | 'UNRESOLVED' | 'FAILED'

/** 목록·상세 공통 직원 필드. 동명이인 구분을 위해 사번·생년월일을 항상 같이 준다(F-i) */
type EmployeeBase = {
  employeeNo: string
  fullName: string
  birthDate: string | null
  status: EmploymentStatus
  accessBlockedOn: string | null
}

/** GET /api/admin/employees 항목(AdminEmployeeDto.Summary) */
export type EmployeeSummary = EmployeeBase & {
  /** 최신 신원 조회 판정만 (판단 3). 조회가 없거나 보관 기간이 지났으면 null */
  latestCheckStatus: BgStatus | null
  latestCheckRequestedAt: string | null
}

/** GET /api/admin/employees/{employeeNo} (AdminEmployeeDto.Detail). 최신 신원 조회 필드는 없다 */
export type EmployeeDetail = EmployeeBase &
  ContactFields & {
    /** lastName = 성. 문자열 분리가 아니라 저장된 값을 쓴다 */
    lastName: string
    firstName: string
    /** 계정이 없으면 null (시드 9명은 계정 없음) */
    loginId: string | null
    /** 계정 복구(퇴사 번복)를 할 수 있는 마지막 날(KST). 퇴사일부터 7일. 복구할 수 없는 상태(재직·퇴사 예정·영구 퇴사)면 null */
    recoverableUntil: string | null
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

/**
 * PUT /api/admin/employees/{employeeNo}/access-block: 퇴사 처리·퇴사일 변경. 그날 00:00 KST 부터 차단. 응답은 Detail(화면은 다시 읽는다).
 * 이미 퇴사 효력이 생긴 직원은 퇴사일을 바꿀 수 없다(409 RESIGNATION_ALREADY_EFFECTIVE).
 */
export type AccessBlockRequest = { blockedOn: string }

/** GET /api/admin/employees/{employeeNo}/background-checks 항목(BackgroundCheckDto.HistoryItem). 판정만, 최신순 */
export type BgCheckSummary = {
  id: number
  requestedAt: string
  status: BgStatus
  completedAt: string | null
  /** UNRESOLVED·FAILED 의 사유 코드(예: POLL_TIMEOUT, POST_400). 그 외에는 null */
  failureReason: string | null
}

/**
 * GET /api/admin/background-checks/{id} (BackgroundCheckDto.Detail). "결과 보기"로 열 때만 호출한다.
 * 저장된 결과만 읽는다(외부 API 를 부르지 않는다). creditScore 는 수집하지 않는다(최소 수집). 응답은 Cache-Control: no-store.
 * 보관 기간(차단일 + 1년)이 지났으면 404.
 */
export type BgCheckDetail = BgCheckSummary & {
  employeeNo: string
  fullName: string
  criminalRecord: boolean | null
  educationVerified: boolean | null
  employmentVerified: boolean | null
}
