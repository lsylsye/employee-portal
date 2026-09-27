// E2 GET 상세 지연: 이 runId 에서 만든 checkId(E0·E1) 를 돌아가며 GET 1,000건, 동시 요청 8개.
// → p50/p95/p99/최댓값, 상태코드 분포, checkId 별 지속 실패 재확인 → GET 타임아웃, DECISIONS (3) 확정 근거.
// 실행: RUN_ID=<id> node measurements/exp/e2-get-latency.js
//
// 동시 8개인 이유: 실패 포함 평균 지연 5.4초(n=734)라 순차로는 1,000건에 약 90분.
// 동시성의 영향은 E5 에서 1~16 단계로 따로 비교한다.
import { readFileSync } from 'node:fs'
import { createClient, RAW_DIR, runIdFromEnv } from '../lib/client.js'

const runId = runIdFromEnv()
const TOTAL = Number(process.env.TOTAL ?? 1000)
const WORKERS = Number(process.env.WORKERS ?? 8)
const client = createClient({ runId, exp: 'e2', rps: 10 })

const ids = [...new Set(
  ['e0', 'e1']
    .flatMap((e) => readFileSync(`${RAW_DIR}${runId}-${e}.ndjson`, 'utf8').trim().split('\n').map((l) => JSON.parse(l)))
    .filter((r) => r.method === 'POST' && r.checkId)
    .map((r) => r.checkId),
)]
console.log(`[e2] 대상 checkId ${ids.length}개, ${TOTAL}건, 동시 ${WORKERS}`)

let next = 0
let stop = false
async function worker() {
  while (!stop) {
    const i = next++
    if (i >= TOTAL) return
    const r = await client.get(`/background-checks/${ids[i % ids.length]}`, { meta: { i, concurrency: WORKERS } })
    if (r.skipped) return void (stop = true)
    if (i % 100 === 0) console.log(`[e2] ${i}/${TOTAL} ${r.status ?? r.rec.errorClass} ${r.rec.latencyMs}ms`)
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker))
await client.drain()
console.log('[e2] 완료', client.stats())
