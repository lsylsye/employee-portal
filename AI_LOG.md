# AI_LOG.md — AI 협업 기록

> 과제 제출물 4. 세션마다 계속 업데이트한다.
> 전체 대화 원문은 세션마다 Claude Code `/export`로 `docs/ai-transcripts/`에 저장한다.

---

## 제출용 요약 (마지막에 정리)

### A. AI의 제안을 거절하거나 되돌린 지점 (3개)
| # | AI가 제안한 것 | 내가 대신 택한 것 | 판단 근거 |
|---|---|---|---|
| 1 | Next.js 풀스택 + Vercel | Spring Boot + React + Railway | (본인 근거 작성) |
| 2 | Java 21 (Gradle toolchain으로 자동 설치) | Java 17 | (본인 근거 작성: 로컬 JDK 17 등) |
| 3 | | | |

### B. AI가 처음에 잘못 만들어서 고친 지점
- (진행하면서 기록: 무엇이 틀렸는지 / 테스트·로그·실측·코드 리딩 중 무엇으로 발견했는지)

### C. 지금 가장 설명하기 어려운 부분
- (마지막에 작성)

---

## 세션 로그

### 2026-09-27 · 세션 1 — 과제 분석, 스택·배포 결정, 초기 세팅 계획

**과제 분석**
- 과제 zip에 `InterviewTasks.txt`와 `swagger.yaml`(Background Check API)이 들어 있다.
- 평가: 배포된 앱을 직접 사용해 보고, 면접에서 코드와 판단 근거를 질문한다. 그래서 "설명 가능한 구조"가 우선이다.
- 진행 순서: 배포·초기 세팅을 먼저 하고, 나머지는 논의하면서 진행하기로 했다.

**결정 1 — 기술 스택**
- AI 제안: Next.js(App Router) + Prisma + Postgres를 Vercel에 배포. 한 레포로 가장 빠르다는 이유였다.
- 최종 선택: **Spring Boot + React**
- AI가 짚은 장단점: 백그라운드 작업(스케줄러 폴링)을 넣기 자연스럽다. 대신 배포 대상이 늘 수 있다.

**결정 2 — 배포 플랫폼**
- 최종 선택: **Railway**
- AI 의견:
  - 무료 Render와 달리 sleep이 없어서 평가 기간 동안 켜 둘 수 있다.
  - Postgres를 같은 프로젝트에서 붙일 수 있다.
  - 평가 기간 동안 유지하려면 Hobby 플랜(월 $5)이 필요하다.
  - 리전은 Singapore를 권장한다. 외부 API가 ap-northeast-2(서울)이기 때문이다.
- AI 제안(확정 전): React 빌드 결과를 Spring Boot `static/`에 넣어 **서비스 1개(JAR 하나)로 배포**
  - 근거: 같은 origin이라 CORS가 필요 없고 세션 쿠키 인증이 단순하다. 퇴사자 세션을 즉시 끊기 쉽다. 배포 대상이 하나다.

**결정 3 — Java 버전**
- AI 제안: Java 21(LTS). 로컬 JDK가 17이라 Gradle toolchain으로 자동 설치하는 방식.
- 최종 선택: **Java 17** → AI 제안 거절(A-2)

**결정 4 — Spring Initializr 설정 (AI 추천, 확정 전)**
- 기본 설정: Gradle - Groovy / Java / Boot 4.x 최신 정식 버전 / Jar / YAML / Java 17
  - Boot 3.5는 무료 지원이 2026-06에 끝났다. 제출 후에도 배포를 유지해야 하니 지원 중인 4.x를 추천했다.
  - 단, 4.x는 Jackson 3 등 인터넷 예제와 다른 부분이 있다.
- 의존성:
  - 넣을 것: Spring Web, Spring Security, Spring Data JPA, PostgreSQL Driver, Flyway, Validation, Actuator
  - 선택: Lombok, DevTools
- 제외한 것과 이유:
  - Thymeleaf: 화면은 React가 맡는다.
  - Docker Compose, Testcontainers: 로컬에 Docker가 없다.
  - H2: 로컬도 Postgres로 운영 환경과 맞춘다.
  - Spring Retry, Resilience4j: 재시도 값은 API 실측 후에 정한다.
  - Spring Session JDBC: 인증 방식을 정한 뒤 결정한다.

**논의 — Lombok을 넣을지 (AI 추천: 넣되 쓸 어노테이션을 제한)**
- 질문: 엔티티가 많지 않은데 Lombok이 필요한가?
- AI 의견:
  - 엔티티는 4~5개로 적다.
  - 하지만 Lombok을 가장 많이 쓰는 곳은 엔티티가 아니다. 서비스·컨트롤러의 생성자 주입(`@RequiredArgsConstructor`)과 로그(`@Slf4j`)다. BG API 호출·재시도·실패를 로그로 남겨야 해서 `@Slf4j`의 쓸모가 크다.
  - DTO는 `record`로 쓰니 Lombok이 필요 없다.
- 허용: `@Getter`, `@NoArgsConstructor(access = PROTECTED)`, `@RequiredArgsConstructor`, `@Slf4j`
- 금지:
  - 엔티티에 `@Data`, `@Setter`, `@EqualsAndHashCode`, `@ToString`: 양방향 연관관계에서 서로 계속 호출하는 문제, 지연 로딩 프록시 문제, 변경 지점이 흩어지는 문제가 생긴다.
  - `@Builder`는 필요한 생성자에만 붙인다.
- 반대 선택(안 넣기)의 장점: 빌드 설정이 단순하고, 생성되는 코드를 설명할 필요가 없다.

**진행 — Spring Boot 초기 세팅 push** (레포 github.com/lsylsye/employee-portal, public)
- AI가 발견한 것: 과제 원문 zip과 `.idea/`가 public 레포에 커밋되어 push됨.
- 처리:
  - 루트 `.gitignore`를 추가했다. 대상은 `*.zip`, IDE 파일, `.env*`(X-Candidate-Key 유출 방지), 프론트·백엔드 빌드 산출물.
  - 선택지 3개 중 **히스토리까지 제거**를 골랐다(사용자 선택). 나머지는 새 커밋만 추가하기, 레포를 private으로 전환하기였다.
  - 방법: 초기 커밋을 `--amend`로 zip과 `.idea`가 없는 버전으로 교체하고 `--force-with-lease`로 push했다. 커밋이 1개뿐이고 혼자 쓰는 레포라 지금이 비용이 가장 적은 시점이었다.
  - 한계: GitHub는 연결이 끊긴 옛 커밋도 해시를 알면 한동안 접근할 수 있게 둔다. 그래서 이 로그에서도 옛 해시를 지웠다. 과제 원문에 키가 없어서 이 수준에서 마무리했다.

**논의 — 브랜치 전략 (AI 추천, 확정 전)**
- AI 추천: `main`은 곧 배포 브랜치(Railway 자동 배포)로 두고, 기능 단위로 짧게 쓰는 브랜치(`feat/auth` 등)를 만들어 PR로 main에 병합한다. `develop` 브랜치까지 두는 git-flow는 혼자 하는 6시간 과제에 과하다.
- 근거:
  1. 평가자가 제출 후에도 배포된 앱을 쓰므로 main은 항상 동작해야 한다.
  2. PR 단위가 판단 단위가 되어 면접에서 설명하기 좋다.
  3. AI가 틀려서 고친 지점(B 항목)의 증거가 남는다.
- 반대 선택(main에 바로 커밋)의 장점: 오버헤드가 없다. 배포 전 초기 단계에서는 이게 충분하다.

**기록 규칙**
- 이 세션부터 모든 논의와 결정을 md로 기록한다(사용자 요청).
- 설계 판단은 `DECISIONS.md`, API 실측은 `MEASUREMENTS.md`, AI 협업 과정은 이 파일에 기록한다.

**논의 중 — 과제의 판단 항목 4개가 Initializr 설정에 영향을 주는가**
- 결론: 기본 의존성은 그대로다. 영향을 받는 건 (1) 퇴사자 세션 처리 방식에 따른 **Spring Session JDBC 추가 여부** 하나다. 나머지는 Spring 기본 기능으로 해결된다. 상세는 아래 표 참고.

| 항목 | 필요한 기술 | Initializr 영향 |
|---|---|---|
| (1) 퇴사자 접근 차단 | 기존 세션 즉시 무효화, 퇴사 예정일 처리 | 서버 세션 방식이면 **Spring Session JDBC 추가**. JWT 방식이면 OAuth2 Resource Server(또는 JWT 라이브러리) + 무효화 목록. 예정일 처리는 `@Scheduled` 또는 요청마다 검사(추가 없음) |
| (2) BG 실행 시점 | 비동기 요청, 백그라운드 폴링, 재시도 | `@Async`/`@Scheduled`는 기본 기능. 재시도는 Boot 4면 기본 `@Retryable`, Boot 3.5면 spring-retry 수동 추가 |
| (3) BG 보관·열람 통제 | 기한 지난 결과 자동 삭제, 역할 기반 열람, 열람 로그, 필드 암호화 | 스케줄러, method security, JPA Auditing, `AttributeConverter` 모두 기존 의존성으로 가능 |
| (4) 정보 수정 절차 | 승인 흐름, 변경 이력 | 테이블 설계로 해결. Hibernate Envers는 Initializr에 없고, 설명하기 쉽도록 이력 테이블을 직접 만드는 쪽을 권장 |

**확정 — Initializr 결과 (사용자가 직접 생성)**
- Spring Boot **4.0.8**, Java 17, Gradle 9.7.1(Groovy), 패키지 `com.bitcomputer.employee_portal`
- 의존성: webmvc, security, data-jpa, flyway(+postgresql), validation, actuator, **Lombok 포함**(AI 추천 수용, 허용 어노테이션 제한 규칙 적용)

**확정 — 브랜치 전략과 순서**
- 규칙: `<type>/<scope>`(type은 chore, feat, docs, fix, refactor), PR은 merge commit으로 병합한다. AI가 틀려서 고친 커밋을 이력에 남기기 위해서다.
- 순서:
  1. `chore/deploy-setup`
  2. `docs/bg-api-measurement`: 3~5번과 병행
  3. `feat/employee-schema`
  4. `feat/auth`
  5. `feat/admin-employee`
  6. `feat/my-profile`
  7. `feat/background-check`
  8. `docs/submission`
- 순서 근거:
  - 배포를 먼저 해서 이후 PR을 모두 실제 URL에서 확인한다.
  - 실측을 앞당긴다. 대기 시간은 작업 시간에서 제외되고, 7번의 타임아웃·재시도 값이 실측 결과에 달려 있다.
  - 3~7번은 의존 관계 순서다. 판단 쟁점은 해당 브랜치를 시작하기 직전에 논의한다.
- 사용자가 브랜치를 직접 만들고 전환했다(git 작업은 사용자가 주도).

### 2026-09-27 · `chore/deploy-setup`

**AI 제안을 사용자 지적으로 바꾼 것 ① — DB 접속 정보 기본값** (A 항목 후보)
- AI가 처음 제안한 것: `${PGHOST:localhost}`, `${PGUSER:postgres}`, `${PGPASSWORD:}`처럼 모든 접속 정보에 로컬 기본값을 두고 프로필은 나누지 않는다.
- 사용자 지적: "비밀번호도 기본값으로 두는 게 맞나?"
- 바꾼 것:
  - 접속 정보(`PG*`)는 **기본값 없이** 필수로 한다.
  - 로컬 값은 `backend/.env`(gitignore 대상)에서 `spring.config.import: optional:file:.env[.properties]`로 읽는다.
  - 형식은 `.env.example`로 커밋한다.
  - `PORT`만 기본값 8080을 둔다. 비밀이 아니고 Railway가 항상 주입한다.
- 근거:
  - 기본값이 있으면 Railway 변수 연결이 빠져도 앱이 localhost로 조용히 떨어진다. 그러면 원인이 가려진 `connection refused`가 난다.
  - 기본값이 없으면 시작 시점에 `Could not resolve placeholder`로 바로 실패한다.
  - 나중에 `BGCHECK_API_KEY`에도 같은 원칙을 적용한다.
- 반대 선택의 장점: clone 후 `.env` 없이 바로 실행된다.

**AI가 처음에 잘못 판단한 것 ① — 로컬 DB 환경을 단정** (B 항목 후보, **로그로 발견**)
- 처음 판단:
  - AI가 `brew list`에 `postgresql@16`이 있는 것만 보고 로컬 DB를 Homebrew로 단정했다.
  - 그래서 "Homebrew엔 `postgres` 계정이 없으니 `PGUSER` 기본값 `postgres`는 틀렸다"고 스스로 정정했다.
- 실제 상황:
  - 로컬 검증 중 `brew services`가 `error` 상태인 것을 봤다.
  - 서비스 로그(`/opt/homebrew/var/log/postgresql@16.log`)에 `could not bind ... Address already in use`가 있었다.
  - `ps`로 확인하니 5432는 **EDB 설치판 PostgreSQL 17**(`/Library/PostgreSQL/17`, 시스템 LaunchDaemon)이 쓰고 있었다. EDB는 `postgres` 계정과 비밀번호를 만든다.
- 놓친 이유: 처음에 `lsof`로 5432를 확인했는데, 다른 사용자(postgres)로 실행되는 프로세스는 권한 없이 보이지 않아 "비어 있음"으로 잘못 읽었다.
- 결과:
  - 로컬 DB는 EDB 17(`postgres` 계정)을 쓴다.
  - "비밀번호에 기본값을 두지 않는다"는 결정은 오히려 근거가 강해졌다. 실제 로컬 DB에 비밀번호가 있다.
- 교훈: 포트 점유는 `lsof` 결과만으로 판단하지 말고 서비스 로그와 `ps`로 교차 확인한다.

**AI 제안을 사용자 지적으로 바꾼 것 ② — SPA 폴백 범위** (A 항목 후보)
- AI가 처음 제안한 것: 파일이 없고 `/api`가 아니면 전부 `index.html`로 폴백한다.
- 사용자 지적: "확장자가 있는데 파일이 없을 때는 404로 보내야 할 것 같다."
- 바꾼 것: 마지막 경로 조각에 확장자(`.`)가 있으면 폴백하지 않고 404를 반환한다.
- 근거:
  - 재배포 직후 열려 있던 페이지가 옛 해시의 JS를 요청하면, 폴백 시 200과 HTML이 와서 `MIME type "text/html"` 오류로 원인이 가려진다.
  - favicon이나 오타 난 경로도 404로 드러나야 한다.
- 제약: 화면 경로 마지막 조각에 `.`이 들어가면 404가 난다. 이 과제의 경로는 사번과 id만 써서 괜찮다.
- 다른 방법: `Accept: text/html`일 때만 폴백한다. 더 정확하지만 설명과 테스트가 복잡해서 택하지 않았다.

**그 밖의 결정 (AI 제안, 사용자 승인)**
- DB 접속에 `DATABASE_URL`이 아니라 `PG*` 변수를 쓴다. Railway의 `DATABASE_URL`은 `postgresql://user:pw@host` 형식이라 JDBC에 그대로 넣을 수 없다.
- SPA 새로고침 처리는 `PathResourceResolver`로 한다. Spring 7의 경로 패턴이 `/**/{path}` 형태를 막아서 컨트롤러 forward 방식 대신 이 방식을 택했다.
- 임시 SecurityConfig를 둔다. health와 정적 파일은 열고 `/api/**`는 인증을 요구한다. `feat/auth`에서 교체한다.
- Docker 빌드에서는 테스트를 제외한다(`-x test`). contextLoads 테스트가 DB를 요구해서, 테스트는 로컬 DB로 따로 돌린다.
- Railway 첫 배포는 배포 브랜치를 임시로 `chore/deploy-setup`에 두고 확인한다. 병합 후 `main`으로 되돌린다.

**논의 — Dockerfile vs Railway 자동 빌드(Railpack)** → **Dockerfile** (사용자 확정)
- 사용자 질문: "Dockerfile 말고 Railway 자동 빌드로 하면 안 되는 이유가 있어?"
- AI 설명: 자동 빌드는 폴더를 보고 언어 하나를 추측한다. 이 레포는 루트에 빌드 파일이 없고 backend(Java)와 frontend(Node)를 JAR 하나로 합쳐야 해서 그대로는 맞지 않는다.
- 자동 빌드로 가는 대안들:
  - 루트 디렉터리를 `backend`로 지정: 프론트가 빠진다.
  - `railpack.json`으로 두 언어 지정: Dockerfile만큼 작성해야 하고 Railway 전용 형식이다.
  - Gradle이 npm까지 실행: 설정이 복잡해진다.
  - 서비스 2개로 분리: 앞서 피한 CORS·쿠키 문제가 되살아난다.
- Dockerfile 근거:
  1. JDK 17과 Node 22 버전을 명시적으로 고정한다.
  2. 빌드 과정 전체가 파일 하나에 보여서 면접에서 설명하기 쉽다.
  3. Railway에 묶이지 않는다.
- 반대 선택의 장점: 관리할 파일이 적고, 캐시와 베이스 이미지 갱신을 Railway가 맡는다.
- 한계: 로컬에 Docker가 없어서 Dockerfile은 Railway 빌드로만 검증된다.
- 부수 변경: Dockerfile이 버전 번호와 관계없이 결과물을 찾도록 `bootJar` 결과 이름을 `app.jar`로 고정했다.

**구현 중 AI가 스스로 고친 것** (B 후보, 코드 리딩)
- 임시 SecurityConfig에서 formLogin과 httpBasic을 끄면 미인증 응답의 기본값이 **403**이 된다. 계획에는 "/api/**는 401"이라고 적었으므로 `HttpStatusEntryPoint(UNAUTHORIZED)`를 명시했다.
- 설치된 라우터가 `react-router-dom`이었는데, v7부터 권장 패키지가 `react-router`라서 교체했다. 실제 설치된 버전은 v8.4이며 `BrowserRouter`/`Routes`가 있는 것을 확인했다.

**로컬 검증 결과** (EDB PostgreSQL 17.11, `backend/.env`)
- 진행 중 문제: `.env`에 `PGPASSWORD`만 있어서 psql이 소켓·macOS 사용자로 접속하다 실패했다. 비밀번호 줄은 두고 비밀이 아닌 `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`만 추가했다. AI는 `.env` 값을 화면에 출력하지 않고 키 이름과 길이만 확인했다.
- 검증 절차: `./gradlew test` 통과 → Dockerfile 절차를 수동으로 재현(프론트 build → `static/` 복사 → `bootJar` → `java -jar`)

| 요청 | 결과 | 기대 |
|---|---|---|
| `/api/health` | 200 JSON | ✅ |
| `/actuator/health` | 200 `UP` (DB 포함) | ✅ |
| `/api/unknown` | 401 | ✅ index.html로 폴백되지 않음 |
| `/`, `/admin`, `/admin/employees/EMP-001` | 200 `text/html` | ✅ SPA 폴백 |
| `/assets/index-*.js` (실제 파일) | 200 `text/javascript` | ✅ |
| `/assets/old-hash.js`, `/robots.txt` (없는 파일) | 404 | ✅ 확장자 규칙 |
| Vite dev `localhost:5173/api/health` | 200 (프록시) | ✅ |

- 남은 경고(의도된 것):
  - Flyway `No migrations found`: 스키마는 `feat/employee-schema`에서 작성한다.
  - `Using generated security password`: 로그인은 `feat/auth`에서 구현한다.

**논의 — local/dev 환경 설정 분리** → 지금은 분리하지 않고, **`feat/employee-schema`에서 필요할 때 `local` 프로필 추가** (사용자 확정)
- 사용자 질문: "dev env랑 local env 분리해야 하는 거 아닌가?"
- AI가 제시한 기준:
  - **값**만 다르면 환경변수로 관리한다(DB 접속 정보, 포트, API 키).
  - **동작**이 다르면 프로필로 관리한다(SQL 로그, 쿠키 Secure, 에러 노출).
  - 현재 로컬과 Railway의 차이는 전부 값이다. 그래서 프로필을 나누면 파일만 늘어난다.
- 추가하는 방식(예정):
  - `application-local.yaml`에는 로컬 편의 설정만 둔다.
  - 활성화는 `build.gradle`의 `bootRun`에서 `spring.profiles.active=local`로 한다. 배포는 `java -jar`라서 자연스럽게 분리된다.
  - `prod` 프로필은 두지 않는다. 기본 설정이 곧 운영 설정이라, 운영 프로필을 켜는 걸 잊는 실수가 없다.
- 예정된 동작 차이:
  - 스키마 브랜치: SQL 로그
  - 인증 브랜치: 쿠키 Secure 속성 검토. 대부분 브라우저가 `localhost`를 안전한 주소로 취급해서 공통으로 둘 수도 있다.
- Railway에 dev·staging 환경을 따로 두지 않는다. 서비스와 DB가 두 벌이 되고, "로컬 검증 → 브랜치 배포 → main 병합" 흐름이 이미 스테이징 역할을 한다.
- 반대 선택(지금 local/dev 분리)의 장점: 환경별 차이가 파일로 미리 드러나고, 나중에 동작 차이가 생겨도 구조를 바꿀 필요가 없다.

### 2026-09-28 · `feat/frontend-views` (worktree `employee-portal-front`)

**작업 방식 — 프론트 전용 worktree** (사용자 확정)
- 사용자 질문: "지금 내가 브랜치 생성해서 옮기면 백엔드 브랜치도 바뀌어? 인텔리제이에서 하고 있는데"
- AI 확인: 브랜치는 worktree(폴더)마다 따로다. 이미 `employee-portal`(docs/bg-api-measurement)과 `employee-portal-feat`(feat/employee-schema) 두 개가 있었다. `employee-portal`에는 실측 쪽 미커밋 변경이 있어 그 폴더에서 브랜치를 바꾸면 변경이 섞인다.
- 결정: `git worktree add ../employee-portal-front -b feat/frontend-views main`. 백엔드·실측 작업과 서로 영향이 없다.
- 이 브랜치의 AI_LOG는 main 시점 버전이라 docs 브랜치와 병합할 때 이 섹션에서 충돌이 난다. 병합 시 이 섹션을 뒤에 붙인다.

**결정 (사용자 선택)**
- 데이터: **API 계약(TS 타입) + 목 데이터**. 백엔드 API가 아직 없어서 계약을 먼저 정하고, 백엔드 DTO(record)가 이 형태를 따른다. `npm run dev:mock`으로 목을 켠다.
- 스타일: **Tailwind CSS v4** (AI 추천은 순수 CSS였다, 사용자가 Tailwind 선택).
- 범위: 로그인, 직원 내 정보, 관리자 목록·상세·계정 생성, 관리자 BG 실행·결과.

**화면에 반영한 기존 결정**
- 로그인 실패 메시지 통일(DECISIONS 1), 접근 차단일 입력(기본값 오늘 KST, 즉시/예약), 401이면 로그인 화면으로(퇴사로 끊긴 세션 포함).
- 직원에게 BG는 조회 일자와 진행 상태만(판단 3 b안). 관리자 목록은 판정만, 상세는 "결과 보기"로만, 신용등급 미표시.
- 동명이인 구분: 목록에 사번·생년월일 항상 표시(F-i). 성·이름은 따로 입력·정정(복성 대응). EMP-007은 BG 실행 버튼을 막고 이유를 표시(F-e).
- 화면의 진행 중 갱신은 3초마다 **우리 서버**를 읽는다. 외부 API 폴링은 백엔드가 하므로 화면 갱신이 외부 호출을 늘리지 않는다.

**⚠️ 잠정값으로 넣은 것 (확정 필요, `src/api/types.ts`에 표시)**
- F-a 인적사항 필드: 휴대전화, 이메일, 주소
- F-b 직원은 연락처만 수정, 성명·생년월일은 관리자만
- F-c 관리자는 시드 밖 별도 계정(`admin`, 직원 레코드 없음)
- F-d 아이디=사번, 사번은 서버 발급, 초기 비밀번호는 생성 응답에서 한 번만 표시
- 판단 (4): 연락처 수정은 즉시 반영
- 판단 (2): 관리자가 버튼으로 실행, 진행 중인 조회가 있으면 재실행 불가

**AI가 스스로 고친 것** (B 후보)
- 목 전환을 `.env.development`로 하려 했으나 루트 `.gitignore`의 `.env.*`에 걸려 커밋되지 않았다(파일 목록으로 발견). 비밀값 규칙을 건드리지 않으려고 npm 스크립트(`VITE_USE_MOCK=true vite`)로 바꿨다.
- **목 API가 배포 번들에 포함됐다**(빌드 결과물을 grep해서 발견). `mock.ts` 최상단의 sessionStorage 로드가 부수효과라 트리 셰이킹되지 않았다. 목 계정 비밀번호와 시드가 배포 JS에 들어갈 뻔했다. 처음 쓸 때 불러오도록 바꿔 제거를 확인했다.

**검증** (목 모드, 헤드리스 브라우저 스크립트)
- 직원 로그인 → `/me`, 연락처 저장, 직원이 `/admin` 접근 시 `/me`로 이동
- 잘못된 비밀번호 → 통일 메시지
- 관리자: 목록 10명, EMP-007 생년월일 "확인되지 않음"·BG 실행 버튼 비활성, EMP-002 BG 실행 → 진행 중 → 완료 → 결과 보기
- EMP-009 오늘 날짜로 퇴사 처리 → 해당 계정 로그인 실패(통일 메시지)
- 계정 생성 → EMP-011, 초기 비밀번호 표시
- 콘솔 오류 0, 실패 요청 0. 배포 빌드에 목 코드 없음(grep)

**디자인 규칙과 shadcn/ui 채택** (사용자 제시 → AI 의견 → 사용자 확정)
- 사용자가 정한 규칙: 미니멀한 사내 관리자 화면(참고: flex, Stripe Dashboard, Linear 설정), 뉴트럴 그레이 + 파랑 하나, 8pt 간격, 라운드 8px, Pretendard, 해요체, 동사형 버튼. 앱 셸(사이드바 + 본문), 읽기/편집 모드 전환, 확인 다이얼로그, 상세 하단 위험 영역, 토스트, 빈 상태, 인라인 에러.
- 사용자 질문: "Tailwind + shadcn/ui가 어떤지, 설치 시간이 크면 Tailwind만."
- AI 의견: shadcn을 쓰되 필요한 것만(Button, Input, Label, Badge, Table, Card, AlertDialog, Sonner). 손으로 만들기 비싼 건 다이얼로그(포커스 가두기, Esc, 스크롤 잠금)와 토스트다. 사이드바는 shadcn Sidebar가 무거워서 직접 만든다. 복사된 코드가 늘어나 면접에서 설명할 부담이 생기므로 최소한만 둔다.
- 사용자 확정: 15분을 넘기면 Tailwind만으로 간다. `components/ui`는 가져온 그대로 두고 테마 변수만 고친다.
- 결과: 설치와 설정이 약 2분 걸렸다(01:15:52 → 01:18:01).
  - `~/.npm` 캐시 권한 오류(EACCES)가 있어서 임시 캐시 경로로 우회했다. 시스템 폴더는 건드리지 않았다.
  - 의존성에 낯선 `cn` 패키지가 추가돼서 확인했다. shadcn 팀 저장소(`shadcn-ui/cn`)의 공식 패키지로, clsx와 tailwind-merge를 대체한다.
  - `components/ui`를 수정하지 않으려고 eslint `react-refresh/only-export-components` 규칙만 해당 폴더에서 껐다.

**상태 색 매핑 — AI 제안을 사용자가 바꿈** (A 항목 후보)
- AI 제안: 검토 필요(flagged)=빨강. 결과상 위험 신호라는 이유였다.
- 사용자 결정: flagged=**주황**, 추적 실패=빨강.
- 사용자 근거:
  - flagged는 명세상 "추가 검토 필요"이지 "문제 있음"이 아니다.
  - 사람에 대한 판정에 빨강을 쓰면 관리자가 이미 문제 있는 사람처럼 받아들일 수 있다. 화면이 인사 판단을 앞서가지 않게 한다.
  - 빨강은 시스템 오류와 파괴적 동작(퇴사 처리)에만 쓴다.
  - "검토 필요"와 "퇴사 예정"은 둘 다 사람이 확인할 상태라서 같은 주황으로 묶는다.
- 접근성(사용자 요청): 배지는 항상 글자 + 아이콘으로 표시한다(색각 이상 고려). README 디자인 섹션에 표로 남겼다.
- AI가 덧붙인 한계: 주황은 글자 대비(AA 4.5:1)를 맞추려고 orange-700을 썼다. 그래서 빨강에 가깝게 보인다. 아이콘(삼각형 경고와 원형 X)과 글자로 구분된다.

**검증** (목 모드, 헤드리스 브라우저)
- 역할별 사이드바 메뉴 1개씩, 연락처 편집·저장 후 토스트와 읽기 모드 복귀, 로그인 실패 통일 메시지, 검색과 빈 상태
- EMP-007 조회 버튼 비활성, BG 요청 다이얼로그 → 조회 중 배지 → 완료 토스트 → 결과 보기
- 위험 영역: 차단일이 비면 인라인 에러가 나고 다이얼로그는 열리지 않음. 오늘은 즉시 차단, 미래는 예약(퇴사 예정 배지, "차단일 바꾸기")
- 퇴사자 로그인 실패, 404 화면. 콘솔 오류 0, 실패 요청 0
