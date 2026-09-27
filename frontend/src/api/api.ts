import type {
  BgCheckDetail,
  BgCheckSummary,
  CreateEmployeeRequest,
  CreateEmployeeResponse,
  EmployeeDetail,
  EmployeeSummary,
  LoginRequest,
  MyProfile,
  ResignRequest,
  SessionUser,
  UpdateEmployeeIdentityRequest,
  UpdateMyProfileRequest,
} from './types'

/** 화면이 쓰는 API. 실제 구현(http.ts)과 목 구현(mock.ts)이 같은 모양을 따른다 */
export type Api = {
  login(req: LoginRequest): Promise<SessionUser>
  logout(): Promise<void>
  /** 로그인 안 되어 있으면 null */
  currentUser(): Promise<SessionUser | null>

  getMyProfile(): Promise<MyProfile>
  updateMyProfile(req: UpdateMyProfileRequest): Promise<MyProfile>

  listEmployees(): Promise<EmployeeSummary[]>
  getEmployee(employeeNo: string): Promise<EmployeeDetail>
  createEmployee(req: CreateEmployeeRequest): Promise<CreateEmployeeResponse>
  updateEmployeeIdentity(employeeNo: string, req: UpdateEmployeeIdentityRequest): Promise<EmployeeDetail>
  resignEmployee(employeeNo: string, req: ResignRequest): Promise<EmployeeDetail>

  listBackgroundChecks(employeeNo: string): Promise<BgCheckSummary[]>
  requestBackgroundCheck(employeeNo: string): Promise<BgCheckSummary>
  getBackgroundCheckDetail(id: number): Promise<BgCheckDetail>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
