# Employee Portal

직원 인적사항 관리와 외부 Background Check API 연동 포털

- 배포 주소: https://lsy-portal.up.railway.app

## 기술 스택
| 구분 | 사용 |
|---|---|
| 백엔드 | Java 17, Spring Boot 4 (Spring Security, Spring Data JPA, Spring Session JDBC) |
| 프론트엔드 | React 19, TypeScript, Vite |
| 데이터베이스 | PostgreSQL, Flyway |
| 배포 | Railway (React 빌드를 포함한 Spring Boot JAR 하나, Dockerfile) |

## 테스트 계정
| 역할 | 아이디 | 비밀번호 |
|---|---|---|
| 관리자 | `admin` |  |
| 직원 | `EMP-003` |  |

- 계정은 평가자끼리 공유한다.
- 시드 직원 10명 중 EMP-003만 계정이 있다. 다른 직원으로 로그인하려면 관리자 화면에서 새 직원을 등록한다(임시 비밀번호 발급).
- **퇴사 처리는 새로 등록한 직원으로 시험해 달라.** 퇴사일부터 7일이 지나면 영구 퇴사되어 복구할 수 없다.

## ERD

<!-- ERD 이미지: docs/erd.dbml 로 만든 다이어그램을 여기에 넣는다 -->

## 문서
- [DECISIONS.md](DECISIONS.md) 설계 판단 · [MEASUREMENTS.md](MEASUREMENTS.md) BG API 실측 · [AI_LOG.md](AI_LOG.md) AI 협업 기록
- [docs/architecture.md](docs/architecture.md) 구현 설명·데이터 모델·운영 설정·로컬 실행 · [docs/api.md](docs/api.md) API 목록
