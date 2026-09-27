// backend/.env 에서 BGCHECK_API_KEY 만 읽는다. 값은 절대 출력하지 않는다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ENV_PATH = fileURLToPath(new URL('../../backend/.env', import.meta.url))

export function loadApiKey() {
  if (process.env.BGCHECK_API_KEY) return process.env.BGCHECK_API_KEY
  const line = readFileSync(ENV_PATH, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('BGCHECK_API_KEY='))
  const key = line?.slice('BGCHECK_API_KEY='.length).trim()
  if (!key) throw new Error('BGCHECK_API_KEY 가 backend/.env 또는 환경변수에 없습니다')
  return key
}
