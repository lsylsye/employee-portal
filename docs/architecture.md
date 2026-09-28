# 구조와 운영

## 어떻게 만들었나

### 구조
- **Spring Boot 4.0.8 (Java 17) + React 19 (Vite, TypeScript, shadcn/ui).**
  - React 빌드 결과를 Spring의 정적 파일로 넣어 **JAR 하나**로 배포한다(Dockerfile, Railway).
  - 화면과 API가 같은 주소라 CORS가 필요 없고, 세션 쿠키를 그대로 쓴다.
- **PostgreSQL + Flyway.** 스키마와 시드 10명은 마이그레이션(V1~V7)으로 재현된다.
- **외부 BG API는 백엔드가 중계한다.** 이 API에는 CORS가 없고, 후보자 키를 브라우저에 노출하지 않기 위해서다.

### 인증과 권한
- **서버 세션 + Spring Session JDBC**(세션을 DB에 저장). JWT는 쓰지 않았다. 퇴사자를 즉시 끊는 게 핵심인데, JWT는 발급한 토큰을 만료 전에 무효화하기 어렵다.
- **권한**
  - `/api/admin/**`는 관리자만 쓸 수 있다.
  - 직원 API(`/api/me/**`)는 경로에 id를 받지 않고 세션의 사번으로 본인을 찾는다. id만 바꿔 남의 정보를 보는 경로(IDOR)가 없다.
- **CSRF**: SPA 방식(쿠키 → 헤더)으로 막는다.
- **로그인 실패 메시지는 이유와 관계없이 하나다.** 퇴사자 검사는 비밀번호 확인 **뒤**에 한다. 먼저 하면 응답 시간 차이로 퇴사 여부가 드러난다.
- 로그인하지 않은 요청은 세션을 만들지 않는다. 요청만 반복해서 세션 테이블을 채우는 경로를 막았다.

### 퇴사 처리 — [DECISIONS (1)](../DECISIONS.md)
- 퇴사일(= 접근 차단일)은 계정이 아니라 **직원**에 둔다. 퇴사는 인사상의 사실이고, 계정이 없는 직원도 퇴사 처리할 수 있어야 한다.
- **요청마다 `퇴사일 <= 오늘(KST)`을 비교해서 막는다.**
  - 예약 퇴사도 스케줄러 없이 동작한다.
  - 서버 시간대가 UTC라서 현재 시각은 `Clock`(Asia/Seoul)을 주입받아 쓴다.
- 오늘 이하로 퇴사 처리하면 그 직원의 세션 행을 **즉시** 지운다.
- 퇴사 취소는 없다.
  - 퇴사 예정일 때는 퇴사일만 바꿀 수 있다.
  - 효력이 생긴 뒤에는 **7일 동안만 계정 복구**가 되고, 그 뒤로는 영구 퇴사다.
- 레코드는 지우지 않는다. 재입사자는 새 사번으로 등록한다.

### 신원 조회 — [DECISIONS (2)(3)](../DECISIONS.md), [MEASUREMENTS](../MEASUREMENTS.md)
- **관리자가 버튼으로 실행한다.**
  - 외부 POST를 보내기 **전에** `PENDING` 행을 먼저 만든다.
  - DB 조건부 유니크 제약으로 직원당 `PENDING`을 하나만 허용한다. 버튼을 두 번 눌러도 외부 POST는 한 번만 나간다. 외부 API가 멱등하지 않아서다(실측).
- **결과는 백그라운드 폴링이 채운다.**
  - 첫 폴링은 25초 뒤, 이후 10초 간격, 최대 5분까지 기다린다.
  - Retry-After는 따르지 않는다. 기다려도 성공률이 오르지 않았다(실측).
- **최소 수집**
  - 최종 판정일 때만 결과를 저장하고, `creditScore`는 저장하지 않는다.
  - 외부 응답에 섞여 오는 후보자 키(`tenant` 필드)는 옮기지 않는다.
- **열람 통제**
  - 상세 결과는 관리자만 보고, 응답에 `no-store`를 붙인다.
  - 직원은 진행 상태만 본다.
  - 퇴사일 + 1년이 지나면 결과를 보여 주지 않는다.
- **상태 5개**
  - `PENDING`: 조회 중
  - `CLEAR`: 이상 없음
  - `FLAGGED`: 검토 필요
  - `UNRESOLVED`: 결과 미확인, 시스템이 결과를 모름
  - `FAILED`: 요청 실패, 외부가 거절

### 직원 정보 수정 — [DECISIONS (4)](../DECISIONS.md)
- 본인은 연락처·이메일·주소·비상연락처만 고칠 수 있다. 성명과 생년월일은 BG 입력값이라 관리자만 고친다.
- 즉시 반영하고, **누가·언제·어떤 필드**를 바꿨는지만 기록한다. 값은 남기지 않는다.

### 데이터
- 테이블
  - `employee`: 인사 레코드
  - `account`: 로그인 수단. 관리자는 직원 레코드가 없는 별도 계정이다.
  - `background_check`: 신원 조회 요청과 결과
  - `employee_change_log`: 정보 변경 기록
  - `spring_session`: 세션
- 관계는 모두 FK와 `ON DELETE RESTRICT`로 묶었다. 다대다는 없다.
- `full_name`이 성·이름과 겹치는 것은 **의도한 비정규화**다. 원문 성명을 보존하기 위해서이고, CHECK 제약으로 어긋남을 막는다.
- 관리자 목록의 "직원별 최신 신원 조회 상태"는 `DISTINCT ON` **쿼리 한 번**으로 가져온다. N+1 없이 동작하는지 테스트로 확인했다.
- 자세한 내용: 아래 "데이터 모델"

### 테스트
- 백엔드 108건. 단위 테스트(도메인 규칙)와 통합 테스트(실제 PostgreSQL 테스트 DB, MockMvc)로 나뉜다.
- 핵심 테스트
  - **T1 접근 통제**: 직원이 남의 정보나 관리자 API에 접근하면 거부된다.
  - **T2 퇴사자 차단**: KST 자정 경계에서 동작한다. 이미 로그인한 세션도 끊긴다.
  - **T3 시드 성·이름 분리**: 복성과 외자가 맞게 나뉜다.
- 외부 BG API는 stub이나 가짜 클라이언트로 테스트한다. 실제 호출은 본인 키로 확인용으로 한 번만 했다.

---

## 로컬 실행
- 백엔드
  1. `backend/.env.example`을 `backend/.env`로 복사하고 값을 채운다. DB 접속 정보와 `BGCHECK_API_KEY`는 필수다.
  2. `cd backend && ./gradlew bootRun`을 실행한다. 주소는 http://localhost:8080 이다.
  3. 로컬에서만 Swagger를 볼 수 있다: http://localhost:8080/swagger-ui.html
- 프론트
  - `cd frontend && npm ci && npm run dev`: API는 8080으로 프록시된다.
  - 백엔드 없이 보려면 `npm run dev:mock`을 쓴다.
- 테스트: `cd backend && ./gradlew test`. 별도 DB `employee_portal_test`가 필요하다.

---

## 데이터 모델

### 테이블
| 테이블 | 역할 |
|---|---|
| `employee` | 인사 레코드. 사번, 성명(원문)·성·이름, 생년월일, 연락처, 퇴사일(`access_blocked_on`) |
| `account` | 로그인 수단. 직원은 사번이 아이디, 관리자는 직원 레코드가 없는 별도 계정 |
| `background_check` | 신원 조회 요청과 결과(판정·범죄 기록·학력·경력). `creditScore` 컬럼은 없다 |
| `employee_change_log` | 직원 정보 변경 사실(누가·언제·누구의·어떤 필드). 값은 없다 |
| `spring_session`, `spring_session_attributes` | 서버 세션(Spring Session JDBC) |

### 관계와 제약
| 관계 | 카디널리티 | 구현 | 제약 | 삭제 정책 |
|---|---|---|---|---|
| 직원 : 계정 | 1 : 0..1 | `account.employee_id` NULL 허용 + UNIQUE | `account_role_ck`: ADMIN 이면 `employee_id` NULL, EMPLOYEE 면 NOT NULL | RESTRICT |
| 직원 : 신원 조회 | 1 : N | `background_check.employee_id` NOT NULL. 재조회 허용, 이전 결과는 이력 | 직원당 `PENDING` 하나(조건부 유니크), 최종 판정은 checkId·완료 시각 필수(CHECK) | RESTRICT |
| 계정(실행한 관리자) : 신원 조회 | 1 : N | `background_check.requested_by` NOT NULL | — | RESTRICT |
| 직원 : 변경 기록 | 1 : N | `employee_change_log.employee_id` NOT NULL | `field_name` 허용 목록 CHECK | RESTRICT |
| 계정(수정한 사람) : 변경 기록 | 1 : N | `employee_change_log.changed_by` NOT NULL | — | RESTRICT |
| 계정 : 세션 | 1 : N (논리) | `spring_session.principal_name` = `login_id`. FK 아님(Spring Session 테이블) | — | 퇴사 처리 시 앱이 삭제 |

- **삭제 정책은 RESTRICT.** 직원은 삭제하지 않는다(퇴사도 레코드를 보존하고 퇴사일만 둔다). 실수로 지우려 하면 DB 가 막는다.
- 퇴사일은 계정이 아니라 **직원**에 둔다(퇴사는 인사상의 사실). 계정은 연결된 직원의 퇴사일로 판단하고, 연결이 없으면 ADMIN 만 통과한다(fail-closed).
- **다대다는 두지 않았다.** 계정당 권한이 하나(ADMIN 또는 EMPLOYEE)라서 `account.role` 칼럼으로 충분하다. 권한이 여러 개 필요해지면 `account_roles(account_id, role)` 중간 테이블로 확장한다.

### 의도한 비정규화: 성명
- `employee.full_name` 은 `last_name || first_name` 과 중복이다. **의도한 비정규화다.**
  - 과제 원문의 성명 문자열을 보존하고, BG API 에는 성·이름을 따로 보내야 한다(복성은 문자열 규칙으로 나눌 수 없다).
  - 어긋남은 CHECK 제약 `employee_name_split_ck (full_name = last_name || first_name)` 으로 막는다. 앱도 성·이름을 고칠 때 성명을 다시 만든다.
- 그 밖의 비정규화는 하지 않는다. 관리자 목록의 "직원별 최신 신원 조회 상태"도 직원 테이블에 복사하지 않고 조회 때 가져온다.

### 신원 조회 테이블
- 인덱스
  - `(employee_id, requested_at DESC)`: 직원별 이력과 최신 1건
  - `requested_at WHERE status = 'PENDING'` 부분 인덱스: 백그라운드 폴링 대상
  - `UNIQUE (employee_id) WHERE status = 'PENDING'`: 같은 직원에게 진행 중인 조회가 둘 생기지 않게 DB 에서 막는다
- 관리자 목록의 최신 상태는 `DISTINCT ON (employee_id) ... ORDER BY employee_id, requested_at DESC` 단일 쿼리로 가져온다. 쿼리 수가 1번인지 테스트로 확인하고, 일부러 N+1 로 바꿨을 때 테스트가 실패하는 것도 확인했다.
- 상태: `PENDING`(조회 중), `CLEAR`(이상 없음), `FLAGGED`(검토 필요: 외부 판정), `UNRESOLVED`(결과 미확인: 시스템이 결과를 모름), `FAILED`(요청 실패: 외부가 4xx 로 거절)
  - `UNRESOLVED` 가 되는 경우: POST 가 애매하게 실패(타임아웃·5xx), 폴링 5분 초과, checkId 없이 1분 넘게 남은 PENDING(행 생성 직후 서버가 죽은 경우를 폴링 작업이 복구)

### 마이그레이션(Flyway)
| 버전 | 내용 |
|---|---|
| V1 | Spring Session 테이블 |
| V2 | 직원·계정 |
| V3 | 시드 10명(성·이름 명시 분리, EMP-007 생년월일 NULL) |
| V4 | 퇴사일을 계정에서 직원으로 이동 |
| V5 | 사번 시퀀스(EMP-011~) |
| V6 | 변경 기록, FK RESTRICT 명시 |
| V7 | 신원 조회 |

---

## 운영 설정 (Railway)

`employee-portal` 서비스 변수. 비밀값은 기본값 없이 환경변수로만 받는다.

| 변수 | 필수 | 설명 |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | ✅ | Postgres 서비스 참조. 없으면 기동 실패 |
| `BGCHECK_API_KEY` | ✅ | 외부 BG API 후보자 키. 없으면 기동 실패 |
| `ADMIN_PASSWORD` | 제출용 | `admin` 계정을 기동 시 한 번 만든다. 이미 있으면 건드리지 않는다 |
| `SUBMISSION_EMPLOYEE_NO`, `SUBMISSION_EMPLOYEE_PASSWORD` | 제출용 | 제출용 직원 계정(EMP-003) |

- 제출용 계정 변수가 비어 있으면 계정을 만들지 않고 경고 로그만 남긴다. 실제로 첫 배포 때 `ADMIN_PASSWORD` 가 비어 관리자 계정이 없었고, DB 에 직접 넣어 복구했다(AI_LOG 운영 기록).
- 계정이 생긴 뒤 변수를 바꿔도 비밀번호는 바뀌지 않는다.
- `SPRING_PROFILES_ACTIVE` 는 넣지 않는다(아래 "개발 편의 도구"가 켜질 수 있다).

정책 값(설정 파일 `application.yaml`):

| 키 | 기본값 | 의미 |
|---|---|---|
| `employee.recovery-window` | `7d` | 퇴사일부터 계정 복구 가능 기간 |
| `bg.retention-after-block` | `1y` | 퇴사일 + 이 기간이 지난 신원 조회 결과는 보여 주지 않는다 |
| `bg.post-timeout`, `bg.poll-timeout` | `5s`, `31s` | 외부 호출 타임아웃(MEASUREMENTS §7-1) |
| `bg.polling.first-delay`, `interval`, `max-wait` | `25s`, `10s`, `5m` | 폴링(MEASUREMENTS §7-3) |
| `bg.polling.orphan-pending-after` | `1m` | checkId 없는 PENDING 복구 기준 |

---

## 개발 편의 도구 (운영에서는 비활성화)
| 도구 | 로컬 | 운영(Railway) |
|---|---|---|
| Swagger UI / OpenAPI 문서 (springdoc) | `./gradlew bootRun`(local 프로필) → http://localhost:8080/swagger-ui.html | **꺼짐.** 켜져 있으면 누구나 API 목록과 요청 형식을 볼 수 있다 |
| SQL 로그 | local 프로필에서 켜짐(바인딩 값은 찍지 않음) | 꺼짐 |

- 기본 설정(`application.yaml`)이 곧 운영 설정이고, 여기서 springdoc 을 끈다. 로컬은 `application-local.yaml` 에서만 켠다. Railway 는 `java -jar` 로 실행되어 local 프로필이 켜지지 않는다.
- `SwaggerDisabledByDefaultTest` 가 기본 설정에서 OpenAPI 문서가 노출되지 않는지 확인한다.
- Swagger 에서 시험하는 순서: `GET /api/auth/csrf` → `POST /api/auth/login` → 나머지. CSRF 쿠키 값은 Swagger 가 헤더로 자동으로 싣는다.
- IntelliJ 로 실행할 때는 Active profiles 에 `local` 을 직접 지정한다(`bootRun` 을 거치지 않기 때문).

---

## 넣지 않은 것
| 항목 | 이유 |
|---|---|
| 퇴사 취소(기간 제한 없음) | 퇴사 예정은 퇴사일 변경으로, 퇴사 후에는 7일 계정 복구로만 되돌린다. 그 뒤로는 영구 퇴사다 |
| 관리자 계정 차단 | 퇴사일은 직원이 가진다. 관리자는 직원 레코드가 없는 별도 계정이라 차단할 수단이 없다. 관리자가 1명이고 자기 자신은 퇴사 처리하지 않으므로 받아들인다 |
| 관리자 계정 생성 API | 인증 없이 열면 누구나 관리자가 되고, 관리자만 쓰게 하면 관리자를 잃었을 때 쓸 수 없다. 운영자가 DB 나 환경변수로 관리한다 |
| 시드 직원 계정 발급 | 과제 요구는 새 직원 계정 생성 하나다. 직원 로그인은 EMP-003 이나 새로 등록한 직원으로 확인한다 |
| 비밀번호 변경, 최소 길이 검사 | 사람이 비밀번호를 정하는 곳이 제출용 계정의 환경변수뿐이다(임시 비밀번호는 서버 생성, 회원가입 없음). 변경이나 가입 기능이 생기면 백엔드 검사를 추가한다 |
| 첫 로그인 시 비밀번호 변경 강제 | 평가자 여럿이 같은 계정을 쓴다. 한 명이 바꾸면 나머지가 로그인할 수 없다 |
| BG 열람 권한 분리 | 관리자 전체가 열람한다. 관리자가 1명이라 분리해도 시연할 수 없다 |
| 직원 본인의 BG 결과 열람 | 조회 사실만 보여 준다. 관리자 검토 전 공개와 정정 경로 부재 때문이다. 확장한다면 관리자 검토 후 공개 |
| 신원 조회 열람 기록 | 과제 요구는 열람 **통제**이고 관리자 권한으로 충족한다. 관리자가 여러 명이 되면 필요하다 |
| 보관 기간 지난 결과의 자동 삭제 | 조회할 때 보여 주지 않는 필터링까지만 한다. 기간이 지난 행은 DB 에 남는다 |
| UNRESOLVED 자동 확인 | 외부 목록 조회로 생성 여부를 확인할 수 있지만 수동이다 |
| 동기 GET(결과 새로고침) | 결과는 DB 에서만 읽고 진행 중인 건은 폴링이 갱신한다 |
| 변경 기록 조회 API·화면, 변경 전후 값 | 누가·언제·어떤 필드만 DB 에 남긴다(최소 수집). 대신 탈취 후 원래 값으로 되돌릴 수는 없다 |
| API 명세 yaml | [api.md](api.md) 표와 로컬 Swagger 로 대신한다 |
