# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## 디자인 규칙

- 미니멀한 사내 관리자 화면: 뉴트럴 그레이 + 포인트 컬러 파랑 하나. 8pt 간격, 라운드 8px, 낮은 그림자, Pretendard.
- 컴포넌트는 shadcn/ui(`src/components/ui`, 가져온 그대로)를 쓰고, 테마는 `src/index.css` 변수만 고친다.
- UX 라이팅은 해요체, 버튼은 동사형 라벨.

### 상태 색

배지는 색만으로 구분하지 않는다. 항상 **글자 + 아이콘**을 함께 쓴다(색각 이상 사용자 고려).

| 상태 | 색 | 아이콘 | 토큰 |
|---|---|---|---|
| 재직 | 초록 | CircleCheck | `status-success` |
| 퇴사 예정 | 주황 | Clock | `status-warning` |
| 퇴사 | 회색 | Ban | `status-neutral` |
| 조회 중 | 파랑 | 스피너(Loader2) | `status-info` |
| 이상 없음 (clear) | 초록 | CircleCheck | `status-success` |
| 검토 필요 (flagged) | 주황 | TriangleAlert | `status-warning` |
| 추적 실패 | 빨강 | CircleX | `status-danger` |
| 조회 안 함 | 회색 | CircleMinus | `status-neutral` |

- **flagged를 빨강으로 두지 않는 이유**: 명세상 "추가 검토 필요"이지 "문제 있음"이 아니다. 사람에 대한 판정에 빨강을 쓰면 화면이 인사 판단을 앞서간다. 그래서 주의 색(주황)으로 둔다.
- **빨강은 시스템 오류(추적 실패)와 파괴적 동작(퇴사 처리)에만** 쓴다.
- "검토 필요"와 "퇴사 예정"은 둘 다 "사람이 확인해야 하는 상태"라 같은 주황으로 묶는다.
