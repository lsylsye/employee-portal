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
