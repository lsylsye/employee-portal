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
  /** 접근 차단일 설정(퇴사 처리) */
  setAccessBlock(employeeNo: string, req: AccessBlockRequest): Promise<void>
  /** 차단 취소(오입력 정정). 재입사는 새 사번으로 등록한다 */
  cancelAccessBlock(employeeNo: string): Promise<void>

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
  INVALID_REQUEST: '입력한 값을 다시 확인해 주세요.',
  INVALID_CREDENTIALS: '아이디 또는 비밀번호가 올바르지 않아요.',
  UNAUTHENTICATED: '로그인이 필요해요.',
  ACCESS_BLOCKED: '접근이 차단된 계정이에요.',
  FORBIDDEN: '권한이 없어요.',
  EMPLOYEE_NOT_FOUND: '직원을 찾을 수 없어요.',
  BIRTH_DATE_IN_FUTURE: '생년월일은 오늘 이후일 수 없어요.',
  CSRF_INVALID: '보안 토큰이 만료됐어요. 페이지를 새로고침해 주세요.',
}

export function messageOf(code: string | null, serverMessage: string | undefined, status: number): string {
  return (code && MESSAGES[code]) || serverMessage || `요청을 처리하지 못했어요 (HTTP ${status})`
}
