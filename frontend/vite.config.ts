import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // 로컬 개발: /api 요청을 Spring Boot 로 넘긴다. 배포에서는 같은 JAR 이 서빙하므로 프록시가 필요 없다.
    proxy: {
      // 다른 포트의 백엔드를 붙일 때: API_PROXY_TARGET=http://localhost:8081 npm run dev
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
    },
  },
})
