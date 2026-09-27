// E5 동시성: GET 상세를 동시 1→2→4→8→16 단계마다 100건(단계당 최대 5분), POST 는 1→4→8 단계마다 20건.
// → 단계별 지연 백분위수·5xx 비율 변화 → 과부하 판단, 앱의 동시 호출 상한.
// 실행: RUN_ID=<id> node measurements/exp/e5-concurrency.js
//
// - rps 제한 없음(동시 16 은 10 rps 제한과 양립 불가). 대신 호출 상한 + 503 비율 50% 초과 시 해당 단계 중단.
// - 단계 결과 요약은 analyze.js 가 concurrency 필드로 집계한다.
import { readFileSync } from 'node:fs'
import { createClient, measId, RAW_DIR, runIdFromEnv } from '../lib/client.js'

const runId = runIdFromEnv()
const client = createClient({ runId, exp: 'e5', rps: 0, probeOnError: false })
const GET_PER_LEVEL = 100
const POST_PER_LEVEL = 20
const LEVEL_MAX_MS = 5 * 60_000

const ids = [...new Set(
  readFileSync(`${RAW_DIR}${runId}-e1.ndjson`, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    .filter((r) => r.method === 'POST' && r.checkId).map((r) => r.checkId),
)]

async function level(kind, conc, total) {
  const started = Date.now()
  let next = 0
  let n503 = 0
  let done = 0
  let stopped = null
  async function worker() {
    while (!stopped) {
      const i = next++
      if (i >= total) return
      if (Date.now() - started > LEVEL_MAX_MS) return void (stopped = 'time')
      const meta = { kind, concurrency: conc, i }
      const r = kind === 'GET'
        ? await client.get(`/background-checks/${ids[i % ids.length]}`, { meta })
        : await client.post('/background-checks', { employeeId: measId(runId, `e5c${conc}`, i + 1), firstName: '지우', lastName: '최', dateOfBirth: '1996-04-03' }, { meta: { ...meta, employeeId: measId(runId, `e5c${conc}`, i + 1) } })
      if (r.skipped) return void (stopped = 'budget')
      done++
      if (r.status === 503) n503++
      if (done >= 20 && n503 / done > 0.5) return void (stopped = '503>50%')
    }
  }
  await Promise.all(Array.from({ length: conc }, worker))
  console.log(`[e5] ${kind} 동시 ${String(conc).padStart(2)}: ${done}건 ${((Date.now() - started) / 1000).toFixed(0)}s 503=${n503}${stopped ? ` 중단(${stopped})` : ''}`)
}

for (const c of [1, 2, 4, 8, 16]) await level('GET', c, GET_PER_LEVEL)
for (const c of [1, 4, 8]) await level('POST', c, POST_PER_LEVEL)
console.log('[e5] 완료', client.stats())
