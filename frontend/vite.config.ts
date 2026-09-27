import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 로컬 개발: /api 요청을 Spring Boot 로 넘긴다. 배포에서는 같은 JAR 이 서빙하므로 프록시가 필요 없다.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
