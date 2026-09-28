# API 목록

- 모든 API 는 `/api` 아래에 있다. 로컬에서는 Swagger UI(코드에서 자동 생성)로도 볼 수 있다([architecture.md](architecture.md) "개발 편의 도구").
- 명세 yaml 은 따로 쓰지 않는다(6시간 기준 비용 대비 효과가 작다).

## 공통
- 인증: 세션 쿠키. 상태를 바꾸는 요청(POST/PUT/PATCH/DELETE)은 CSRF 토큰이 필요하다(`XSRF-TOKEN` 쿠키 값을 `X-XSRF-TOKEN` 헤더로).
- 날짜는 `YYYY-MM-DD`(KST 기준 날짜), 시각은 ISO-8601 UTC.
- 오류 응답: `{ "code": "...", "message": "..." }`

| 상태 | 의미 | 주요 코드 |
|---|---|---|
| 400 | 입력 오류 | `INVALID_REQUEST`, `BIRTH_DATE_IN_FUTURE` |
| 401 | 로그인하지 않음·로그인 실패·퇴사로 차단 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `ACCESS_BLOCKED` |
| 403 | 권한 없음, CSRF 토큰 없음 | `FORBIDDEN`, `CSRF_INVALID` |
| 404 | 대상 없음 | `EMPLOYEE_NOT_FOUND`, `BACKGROUND_CHECK_NOT_FOUND` |
| 409 | 충돌 | `BACKGROUND_CHECK_IN_PROGRESS`, `RESIGNATION_ALREADY_EFFECTIVE`, `ACCOUNT_RECOVERY_NOT_AVAILABLE`, `ACCOUNT_RECOVERY_EXPIRED` |
| 422 | 실행 불가 | `BIRTH_DATE_REQUIRED`, `EMPLOYEE_ACCESS_BLOCKED` |

## 인증
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/auth/csrf` | CSRF 토큰 쿠키 발급. 204 |
| POST | `/api/auth/login` | `{ loginId, password }`. 실패는 이유(없는 아이디·틀린 비밀번호·퇴사)와 관계없이 401 `INVALID_CREDENTIALS` |
| POST | `/api/auth/logout` | 세션 무효화. 204 |
| GET | `/api/auth/me` | 현재 사용자(아이디, 역할, 사번). 세션이 없거나 퇴사로 차단되면 401 |

## 직원 본인
세션의 사번으로 본인을 찾는다. 경로에 id 를 받지 않는다(IDOR 방지).

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/me/profile` | 내 인적사항 |
| PATCH | `/api/me/profile` | 연락처·이메일·주소·비상연락처만 수정. 성명·생년월일은 보내도 무시. 즉시 반영하고 바뀐 필드 이름만 기록 |
| GET | `/api/me/background-checks` | 조회 일자와 진행 상태(`IN_PROGRESS`/`COMPLETED`/`NOT_COMPLETED`)만. 판정·결과는 주지 않는다 |

관리자 계정은 직원 레코드가 없어서 이 API 들은 404 다.

## 관리자: 직원
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/employees` | 목록(사번순). 사번·성명·생년월일·재직 상태(`ACTIVE`/`BLOCK_SCHEDULED`/`BLOCKED`)·퇴사일·최신 신원 조회 판정(`latestCheckStatus`, 없거나 보관 기간이 지났으면 null). 쿼리 한 번 |
| POST | `/api/admin/employees` | 직원 등록 + 계정 생성. 201. 사번은 서버가 발급(EMP-011~). 응답에 임시 비밀번호(16자)를 **한 번만** 담는다(`no-store`). 생년월일은 비워 둘 수 있다 |
| GET | `/api/admin/employees/{employeeNo}` | 상세. 계정 복구 가능한 마지막 날(`recoverableUntil`) 포함 |
| PATCH | `/api/admin/employees/{employeeNo}` | 수정(성·이름·생년월일 포함). 보내지 않은(null) 필드는 바꾸지 않는다. 성명은 성+이름으로 다시 만든다 |
| PUT | `/api/admin/employees/{employeeNo}/access-block` | `{ blockedOn }` 퇴사 처리·퇴사일 변경. 비우면 오늘. 그날 00:00 KST 부터 차단. 오늘 이하면 그 직원의 세션을 즉시 삭제. 이미 퇴사 효력이 생긴 직원은 409 |
| DELETE | `/api/admin/employees/{employeeNo}/access-block` | 계정 복구(퇴사 번복). 퇴사일부터 7일 안에서만. 지나면 409(영구 퇴사), 재직·퇴사 예정이면 409 |

## 관리자: 신원 조회(Background Check)
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/employees/{employeeNo}/background-checks` | 실행. 202(`PENDING`). 진행 중이면 409, 생년월일 없음·퇴사자면 422. 외부 POST 가 4xx 면 `FAILED`, 타임아웃·5xx 면 `UNRESOLVED` |
| GET | `/api/admin/employees/{employeeNo}/background-checks` | 이력(최신순). 판정과 실패 사유만. 보관 기간이 지났으면 빈 목록 |
| GET | `/api/admin/background-checks/{id}` | 상세 결과(범죄 기록·학력·경력). `Cache-Control: no-store`. 저장된 결과만 읽고 외부 API 를 부르지 않는다. 보관 기간이 지났으면 404 |

- 결과는 백그라운드 폴링이 채운다. 첫 폴링은 POST 후 25초, 간격 10초 고정, 5분이 지나면 `UNRESOLVED`. Retry-After 는 따르지 않는다. 근거는 [MEASUREMENTS.md](../MEASUREMENTS.md) §7.
- MEASUREMENTS §7 의 "동기 GET(2초 × 최대 8회)" 경로는 두지 않았다. 결과는 DB 에서만 읽는다.
- `UNRESOLVED` 는 외부 API 의 `GET /background-checks?employeeId={사번}` 으로 실제 생성 여부를 확인할 수 있다(수동).

## 기타
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 헬스체크(공개) |
