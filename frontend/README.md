# Frontend

React 19 + TypeScript + Vite. UI 는 shadcn/ui(Tailwind CSS v4). 빌드 결과는 백엔드 JAR 의 정적 파일로 들어간다(루트 Dockerfile).

## 실행
| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버. `/api` 는 로컬 백엔드(8080)로 프록시된다 |
| `npm run dev:mock` | 백엔드 없이 목 API 로 실행(`VITE_USE_MOCK=true`). 목 계정: `admin` / `admin1234`, `EMP-003` / `password`. 목 데이터는 sessionStorage 에만 있다 |
| `npm run build` | 타입 검사(`tsc -b`) + 빌드 |
| `npm run lint` | ESLint |

목 API(`src/api/mock.ts`)는 배포 번들에 들어가지 않는다. 목에서는 EMP-010 의 신원 조회가 항상 "결과 미확인"으로 끝난다(빨간 배지 확인용).

## 구조
| 위치 | 내용 |
|---|---|
| `src/api/types.ts` | 백엔드 API 계약(타입). 필드 이름은 백엔드 DTO 와 같다 |
| `src/api/http.ts`, `src/api/mock.ts` | 실제 구현과 목 구현(같은 `Api` 모양) |
| `src/api/api.ts` | `Api` 타입, 오류 코드 → 해요체 문구 매핑 |
| `src/pages/LoginPage.tsx` | 로그인 |
| `src/pages/MyProfilePage.tsx` | 직원: 내 정보·연락처 수정·신원 조회 진행 상태 |
| `src/pages/admin/*` | 관리자: 직원 목록·등록·상세(신원 정정, 퇴사 처리·계정 복구), 신원 조회 |
| `src/components/status.tsx` | 재직·신원 조회 상태 배지(아래 색 규칙) |

- 역할별 라우트 가드로 직원은 관리자 화면에 들어갈 수 없다. 최종 권한 검사는 백엔드가 한다.
- 신원 조회 화면은 진행 중인 건이 있으면 3초마다 **우리 서버**를 다시 읽는다. 외부 API 는 백엔드만 부르므로 화면을 오래 열어 둬도 외부 호출이 늘지 않는다.

## 디자인 규칙

- 미니멀한 사내 관리자 화면: 뉴트럴 그레이 + 포인트 컬러 파랑 하나. 8pt 간격, 라운드 8px, 낮은 그림자, Pretendard.
- 글꼴: Pretendard 웹폰트(jsDelivr CDN, `src/styles/fonts.css`). 글꼴 이름은 `--font-sans` 토큰에서만 참조한다.
- 컴포넌트는 shadcn/ui(`src/components/ui`, 가져온 그대로)를 쓰고, 테마는 `src/index.css` 변수만 고친다.
- UX 라이팅은 해요체, 버튼은 동사형 라벨.

### 상태 색

배지는 색만으로 구분하지 않는다. 항상 **글자 + 아이콘**을 함께 쓴다(색각 이상 사용자 고려).
옅은 배경 + 진한 글자 + 아이콘 방식이다. 글자는 4.5:1, 아이콘은 비텍스트라 3:1 이상이면 된다.

| 상태 | 색 | 아이콘 | 배경 / 글자 / 아이콘 | 글자 대비 | 아이콘 대비 |
|---|---|---|---|---|---|
| 재직, 이상 없음 (CLEAR) | 초록 | CircleCheck | green 50 / 800 / 600 | 6.78 | 3.07 |
| 조회 중 | 파랑 | 스피너(Loader2) | blue 50 / 800 / 600 | 8.11 | 4.82 |
| 퇴사 예정, 검토 필요 (FLAGGED) | 주황(amber) | Clock, TriangleAlert | amber 50 / 800 / 600 | 6.88 | 3.08 |
| 결과 미확인 (UNRESOLVED: 시스템이 결과를 모름) | 빨강 | CircleHelp | red 50 / 800 / 600 | 7.67 | 4.36 |
| 요청 실패 (FAILED: 외부가 요청을 거절) | 빨강 | CircleX | red 50 / 800 / 600 | 7.67 | 4.36 |
| 퇴사, 조회 안 함 | 회색 | Ban, CircleMinus | neutral 100 / 700 / 500 | 9.53 | 4.34 |

- 대비는 배지 배경 기준이다. Tailwind 팔레트(OKLCH)를 sRGB로 바꿔 WCAG 2 공식으로 계산했다.
- amber-100 배경은 아이콘 대비가 2.87이라 3:1에 못 미친다. 그래서 50을 쓴다.
- 토큰: `src/index.css`의 `--status-<tone>-bg/-fg/-icon`.
- 주황은 **검토 필요와 퇴사 예정에만** 쓴다. 생년월일 없음 같은 데이터 공백은 회색 글자로 둔다.
- **flagged를 빨강으로 두지 않는 이유**: 명세상 "추가 검토 필요"이지 "문제 있음"이 아니다. 사람에 대한 판정에 빨강을 쓰면 화면이 인사 판단을 앞서간다. 그래서 주의 색(주황)으로 둔다.
- **빨강은 시스템 오류(결과 미확인·요청 실패)와 파괴적 동작(퇴사 처리)에만** 쓴다.
- "검토 필요"와 "퇴사 예정"은 둘 다 "사람이 확인해야 하는 상태"라 같은 주황으로 묶는다.
