# Employee Portal

직원 인적사항 관리와 Background Check(BG) 연동 포털. Spring Boot 4 + React(Vite), Railway 단일 서비스.

- 설계 판단: [DECISIONS.md](DECISIONS.md)
- 요구사항 정리: [docs/requirements.md](docs/requirements.md)
- AI 협업 기록: [AI_LOG.md](AI_LOG.md)

## 평가 안내
- 제출용 계정: 관리자 `admin`, 직원 `EMP-003`. 비밀번호는 제출 메일로 따로 전달한다(레포에 두지 않는다).
- **퇴사 처리는 제출용 직원 계정(EMP-003)이 아닌 다른 직원으로 시험해 달라.** 계정은 평가자끼리 공유한다.
  - 새 직원을 등록하면 계정과 임시 비밀번호가 함께 발급된다. 그 직원을 퇴사 처리하면 로그인 차단까지 확인할 수 있다.
  - 실수로 차단했다면 관리자 화면에서 차단을 취소할 수 있다.

## API 목록

> 구현 브랜치 순서대로 채운다. 명세 yaml 은 따로 쓰지 않는다(6시간 기준 비용 대비 효과가 작다).
> 구현된 API 는 로컬 Swagger UI 로 확인한다(아래 "개발 편의 도구").

### 공통
- 인증: 세션 쿠키. 상태를 바꾸는 요청(POST/PUT/PATCH/DELETE)은 CSRF 토큰 헤더가 필요하다.
- 오류 응답: `{ "code": "...", "message": "..." }`

| 상태 | 의미 |
|---|---|
| 400 | 입력 오류 |
| 401 | 로그인하지 않음, 세션 만료, 또는 접근 차단(퇴사) |
| 403 | 권한 없음(직원이 관리자 API 호출 등) |
| 404 | 대상 없음 |
| 409 | 충돌(BG 진행 중 재실행 등) |
| 422 | 실행 불가(생년월일 없음, 퇴사자 BG 실행 등) |

### 인증 — `feat/auth`
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/auth/csrf` | CSRF 토큰 발급 |
| POST | `/api/auth/login` | `{ loginId, password }`. 실패는 이유와 관계없이 401 `INVALID_CREDENTIALS`, "아이디 또는 비밀번호가 올바르지 않습니다" |
| POST | `/api/auth/logout` | 204 |
| GET | `/api/auth/me` | 현재 사용자(아이디, 역할, 사번). 세션이 없거나 차단이면 401 |

### 직원 본인 — `feat/my-profile`
세션에서 본인을 식별한다. 경로에 id 를 받지 않는다(N3).

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/me/profile` | 내 인적사항 |
| PATCH | `/api/me/profile` | 연락처, 이메일, 주소, 비상연락처만 수정. 성명·생년월일은 수정 불가(보내도 무시). 즉시 반영하고 바뀐 필드 이름만 기록(판단 4) |
| GET | `/api/me/background-checks` | 조회 일자와 진행 상태(`IN_PROGRESS`/`COMPLETED`/`NOT_COMPLETED`)만. 판정·상세 결과는 주지 않는다 |

### 관리자: 직원 — `feat/admin-employee`
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/employees` | 목록(사번순). 사번, 성명, 생년월일, 상태(`ACTIVE`/`BLOCK_SCHEDULED`/`BLOCKED`), 차단일. 최근 BG 판정은 `feat/background-check` 에서 추가 |
| POST | `/api/admin/employees` | 직원 등록 + 계정 생성(F3). 201. 사번은 서버가 발급(EMP-011~). 응답에 임시 비밀번호(16자)를 **한 번만** 담는다(`no-store`). 생년월일은 비워 둘 수 있다 |
| GET | `/api/admin/employees/{employeeNo}` | 상세 |
| PATCH | `/api/admin/employees/{employeeNo}` | 수정. 성·이름·생년월일 포함. 보내지 않은(null) 필드는 바꾸지 않는다. 성명은 성+이름으로 다시 만든다 |
| PUT | `/api/admin/employees/{employeeNo}/access-block` | `{ blockedOn }` 접근 차단일 설정(퇴사 처리). 본문을 비우면 오늘. 그날 00:00 KST 부터 차단. 오늘 이하면 그 직원의 세션을 즉시 삭제 |
| DELETE | `/api/admin/employees/{employeeNo}/access-block` | 차단 취소(오입력 정정) |

### 관리자: Background Check — `feat/background-check`
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/employees/{employeeNo}/background-checks` | 실행. 202(`PENDING`). 외부 POST 전에 PENDING 행을 먼저 만들어 중복 실행을 막는다. 진행 중이면 409, 생년월일 없음·퇴사자면 422. POST 가 4xx 면 `FAILED`, 타임아웃·5xx 면 `UNRESOLVED` |
| GET | `/api/admin/employees/{employeeNo}/background-checks` | 이력(최신순). 판정만. 보관 기간이 지났으면 빈 목록 |
| GET | `/api/admin/background-checks/{id}` | 상세 결과(범죄·학력·경력). `Cache-Control: no-store`. 저장된 결과만 읽고 외부 API 를 부르지 않는다. 보관 기간이 지났으면 404 |

- 결과는 백그라운드 폴링이 채운다: 첫 폴링은 POST 후 25초, 간격 10초 고정, 5분이 지나면 `UNRESOLVED`. Retry-After 는 따르지 않는다. 값의 근거는 [MEASUREMENTS.md](MEASUREMENTS.md) §7.
- MEASUREMENTS §7 의 "동기 GET(2초 × 최대 8회, 예산 10초)" 경로는 두지 않았다. 결과는 DB 에서만 읽고, 진행 중인 건은 폴링이 갱신한다.

### 기타
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 헬스체크(공개) |

## 데이터 모델

### 관계와 제약
| 관계 | 카디널리티 | 구현 | 제약 | 삭제 정책 |
|---|---|---|---|---|
| 직원 : 계정 | 1 : 0..1 | `account.employee_id` NULL 허용 + UNIQUE(`account_employee_uk`) | `account_role_ck`: ADMIN 이면 `employee_id` NULL, EMPLOYEE 면 NOT NULL | RESTRICT |
| 직원 : 변경 기록 | 1 : N | `employee_change_log.employee_id` NOT NULL | `field_name` 허용 목록 CHECK | RESTRICT |
| 계정(수정한 사람) : 변경 기록 | 1 : N | `employee_change_log.changed_by` NOT NULL | — | RESTRICT |
| 직원 : 신원조회 | 1 : N | `background_check.employee_id` NOT NULL. 재조회 허용, 이전 결과는 이력 | 직원당 `PENDING` 하나(조건부 유니크), 최종 판정은 checkId·완료 시각 필수(CHECK) | RESTRICT |
| 계정(실행한 관리자) : 신원조회 | 1 : N | `background_check.requested_by` NOT NULL | — | RESTRICT |
| 계정 : 세션 | 1 : N (논리) | `spring_session.principal_name` = `login_id`. FK 아님(Spring Session 테이블) | — | 퇴사 처리 시 앱이 삭제 |

- **삭제 정책은 RESTRICT.** 직원은 삭제하지 않는다(퇴사도 레코드를 보존하고 차단일만 둔다). 실수로 지우려 하면 DB 가 막는다.
- 접근 차단일은 계정이 아니라 **직원**에 둔다(퇴사는 인사상의 사실). 계정은 연결된 직원의 차단일로 판단하고, 연결이 없으면 ADMIN 만 통과한다(fail-closed).

### 다대다는 두지 않았다
- 계정당 권한이 하나(ADMIN 또는 EMPLOYEE)라서 `account.role` 칼럼으로 충분하다.
- 권한이 여러 개 필요해지면(예: BG 열람 권한 분리) `account_roles(account_id, role)` 중간 테이블로 확장한다.

### 의도한 비정규화: 성명
- `employee.full_name` 은 `last_name || first_name` 과 중복이다. **의도한 비정규화다.**
  - 과제 원문의 성명 문자열을 그대로 보존하고, BG API 에는 성·이름을 따로 보내야 한다(복성은 문자열 규칙으로 나눌 수 없다).
  - 어긋남은 CHECK 제약 `employee_name_split_ck (full_name = last_name || first_name)` 으로 막는다. 앱도 성·이름을 고칠 때 성명을 다시 만든다.
- 그 밖의 비정규화는 하지 않는다. 예: 관리자 목록의 "직원별 최신 신원조회 상태"를 직원 테이블에 복사하지 않고 조회 때 가져온다(아래).

### 신원조회 테이블
- 인덱스
  - `(employee_id, requested_at DESC)`: 직원별 이력과 최신 1건
  - `status = 'PENDING'` 부분 인덱스: 백그라운드 폴링 대상 조회
  - `(employee_id) WHERE status = 'PENDING'` 조건부 유니크: 같은 직원에게 진행 중인 조회가 둘 생기지 않게 DB 에서 막는다(중복 실행 409)
- 상태: `PENDING`(진행 중), `CLEAR`(이상 없음), `FLAGGED`(외부 판정 "검토 필요" — 사람이 볼 것),
  `UNRESOLVED`(**결과 미확인** — 시스템이 결과를 모름, 빨간 배지), `FAILED`(POST 가 4xx 로 거절, 외부에 생성 안 됨)
  - `UNRESOLVED` 가 되는 경우: POST 가 애매하게 실패(타임아웃·5xx), 폴링 한도 초과, checkId 없이 설정 시간 넘게 남은 PENDING(행 생성 직후 서버가 죽은 경우 — 폴링 작업이 복구)
  - **`UNRESOLVED` 는 외부 API 의 `GET /background-checks?employeeId={사번}` 으로 실제 생성 여부를 확인할 수 있다.** 자동 확인 기능은 아직 없다(시간이 남으면 추가).
- 관리자 목록의 최신 상태: N+1 없이 단일 쿼리(`DISTINCT ON (employee_id) ... ORDER BY employee_id, requested_at DESC`)로 가져온다. 쿼리 수가 1번인지 테스트로 확인한다.
- 이 규모(직원 수십 명)에서는 비정규화 없이 조회로 충분하다.

## 개발 편의 도구 (운영에서는 비활성화)
| 도구 | 로컬 | 운영(Railway) |
|---|---|---|
| Swagger UI / OpenAPI 문서 (springdoc) | `./gradlew bootRun`(local 프로필) → http://localhost:8080/swagger-ui.html | **꺼짐.** 켜져 있으면 누구나 API 목록과 요청 형식을 볼 수 있다. |
| SQL 로그 | local 프로필에서 켜짐(바인딩 값은 찍지 않음) | 꺼짐 |

- 기본 설정(`application.yaml`)이 곧 운영 설정이고, 여기서 springdoc 을 끈다. 로컬은 `application-local.yaml` 에서만 켠다.
  Railway 는 `java -jar` 로 실행되어 local 프로필이 켜지지 않는다. `SPRING_PROFILES_ACTIVE` 변수를 Railway 에 넣지 않는다.
- `SwaggerDisabledByDefaultTest` 가 기본 설정에서 OpenAPI 문서가 노출되지 않는지 확인한다.
- Swagger 에서 시험하는 순서: `GET /api/auth/csrf` → `POST /api/auth/login` → 나머지. CSRF 쿠키 값은 Swagger 가 헤더로 자동으로 싣는다.
- IntelliJ 로 실행할 때는 Active profiles 에 `local` 을 직접 지정한다(`bootRun` 을 거치지 않기 때문).

## 넣지 않은 것
| 항목 | 이유 |
|---|---|
| 관리자 계정 차단 | 접근 차단일은 인사상의 사실이라 직원이 가진다. 관리자는 직원 레코드가 없는 별도 계정이라 차단할 수단이 없다. 관리자가 1명이고 자기 자신은 퇴사 처리하지 않으므로 받아들인다. 관리자가 여러 명이 되면 필요하다. |
| 시드 직원 계정 발급 API | 과제 요구는 새 직원 계정 생성(F3) 하나다. 퇴사 처리 시험은 새로 등록한 직원으로 한다. |
| 비밀번호 변경, 최소 길이 검사 | 사람이 비밀번호를 정하는 곳이 제출용 계정의 환경변수뿐이다(임시 비밀번호는 서버 생성, 회원가입 없음). 변경이나 가입 기능이 생기면 백엔드 검사를 추가한다. |
| 첫 로그인 시 비밀번호 변경 강제 | 평가자 여럿이 같은 계정을 쓴다. 한 명이 바꾸면 나머지가 로그인할 수 없다. |
| BG 열람 권한 분리 | 관리자 전체가 열람한다. 관리자가 1명이라 분리해도 시연할 수 없다. |
| 직원 본인의 BG 결과 열람 | 조회 사실만 보여 준다. 관리자 검토 전 공개와 정정 경로 부재 때문이다. 확장한다면 관리자 검토 후 공개. |
| API 명세 yaml | 이 표와 로컬 Swagger(코드에서 자동 생성)로 대신한다. |
| 신원조회 열람 기록 | 과제 요구는 열람 **통제**이고 관리자 권한으로 충족한다. 관리자가 여러 명이 되면 필요하다. |
| 보관 기간 지난 신원조회 결과의 자동 삭제 | 조회할 때 보여 주지 않는 필터링까지만 한다. 기간이 지난 행은 DB 에 남는다. 실제 파기가 필요하면 스케줄러 삭제를 추가한다. |
| UNRESOLVED 자동 확인 | 외부 목록 조회로 실제 생성 여부를 확인할 수 있지만 수동이다(시간이 남으면 추가). |
| 변경 기록 조회 API·화면 | 변경 기록은 DB(`employee_change_log`)에만 남긴다. 분쟁·계정 탈취 확인 때 DB 에서 조회한다. |
| 변경 전후 값 기록 | 누가·언제·어떤 필드만 남긴다. 과거 연락처·주소가 쌓이지 않게(최소 수집). 대신 탈취 후 원래 값으로 되돌릴 수는 없다. |
