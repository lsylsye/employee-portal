import type {
  AccessBlockRequest,
  BgCheckDetail,
  BgCheckSummary,
  CreateEmployeeRequest,
  CreateEmployeeResponse,
  EmployeeDetail,
  EmployeeSummary,
  LoginRequest,
  MyBackgroundCheck,
  MyProfile,
  SessionUser,
  UpdateEmployeeRequest,
  UpdateMyProfileRequest,
} from './types'

/**
 * 화면이 쓰는 API. 실제 구현(http.ts)과 목 구현(mock.ts)이 같은 모양을 따른다.
 * 응답 본문이 README 에 정해지지 않은 변경 요청(차단 설정·취소, BG 실행)은 void 로 두고, 화면이 다시 읽는다.
 */
export type Api = {
  login(req: LoginRequest): Promise<SessionUser>
  changePassword(req: { currentPassword: string; newPassword: string }): Promise<void>
  logout(): Promise<void>
  /** 로그인 안 되어 있으면 null */
  currentUser(): Promise<SessionUser | null>

  getMyProfile(): Promise<MyProfile>
  updateMyProfile(req: UpdateMyProfileRequest): Promise<MyProfile>
  listMyBackgroundChecks(): Promise<MyBackgroundCheck[]>

  listEmployees(): Promise<EmployeeSummary[]>
  getEmployee(employeeNo: string): Promise<EmployeeDetail>
  createEmployee(req: CreateEmployeeRequest): Promise<CreateEmployeeResponse>
  updateEmployee(employeeNo: string, req: UpdateEmployeeRequest): Promise<EmployeeDetail>
  /** 퇴사 처리·퇴사일 변경(효력 전만) */
  setAccessBlock(employeeNo: string, req: AccessBlockRequest): Promise<void>
  /** 계정 복구(퇴사 번복). 퇴사일부터 7일 안에서만. 지나면 영구 퇴사. 재입사는 새 사번으로 등록한다 */
  recoverAccount(employeeNo: string): Promise<void>

  listBackgroundChecks(employeeNo: string): Promise<BgCheckSummary[]>
  requestBackgroundCheck(employeeNo: string): Promise<void>
  getBackgroundCheckDetail(id: number): Promise<BgCheckDetail>
}

export class ApiError extends Error {
  readonly status: number
  /** 서버 오류 코드(ErrorCode). 본문이 없으면 null */
  readonly code: string | null

  constructor(status: number, code: string | null, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * 화면 문구는 해요체로 통일한다. 서버 메시지(고정 문구)는 코드로 바꿔 보여 주고,
 * 모르는 코드는 서버 메시지를 그대로 쓴다.
 */
const MESSAGES: Record<string, string> = {
  CURRENT_PASSWORD_INCORRECT: '현재 비밀번호가 올바르지 않아요.',
  INVALID_NEW_PASSWORD: '새 비밀번호는 8자 이상, 72바이트 이하이며 현재 비밀번호와 달라야 해요.',
  INVALID_REQUEST: '입력한 값을 다시 확인해 주세요.',
  INVALID_CREDENTIALS: '아이디 또는 비밀번호가 올바르지 않아요.',
  UNAUTHENTICATED: '로그인이 필요해요.',
  ACCESS_BLOCKED: '접근이 차단된 계정이에요.',
  FORBIDDEN: '권한이 없어요.',
  EMPLOYEE_NOT_FOUND: '직원을 찾을 수 없어요.',
  RESIGNATION_ALREADY_EFFECTIVE: '이미 퇴사한 직원은 퇴사일을 바꿀 수 없어요. 복구 기간 안이면 계정 복구를 해 주세요.',
  ACCOUNT_RECOVERY_NOT_AVAILABLE: '퇴사 처리된 직원만 계정을 복구할 수 있어요.',
  ACCOUNT_RECOVERY_EXPIRED: '계정 복구 기간이 지나 영구 퇴사 처리됐어요.',
  BIRTH_DATE_IN_FUTURE: '생년월일은 오늘 이후일 수 없어요.',
  CSRF_INVALID: '보안 토큰이 만료됐어요. 페이지를 새로고침해 주세요.',
  BACKGROUND_CHECK_NOT_FOUND: '신원 조회 결과를 찾을 수 없어요.',
  BACKGROUND_CHECK_IN_PROGRESS: '이미 진행 중인 신원 조회가 있어요. 끝나면 다시 요청해 주세요.',
  BIRTH_DATE_REQUIRED: '생년월일이 확인되지 않아 신원 조회를 할 수 없어요. 신원 정보에서 생년월일을 먼저 입력해 주세요.',
  EMPLOYEE_ACCESS_BLOCKED: '퇴사 처리된 직원은 신원 조회를 할 수 없어요.',
}

export function messageOf(code: string | null, serverMessage: string | undefined, status: number): string {
  return (code && MESSAGES[code]) || serverMessage || `요청을 처리하지 못했어요 (HTTP ${status})`
}
