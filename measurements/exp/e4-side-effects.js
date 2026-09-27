// E4 실패한 POST 의 부수효과: 결과가 불확실한 POST(5xx / timeout / network) 가 실제로 레코드를 만들었는가.
// 새 POST 는 보내지 않는다. 원자료에서 대상 employeeId 를 모아 목록 GET 으로 확인한다.
// → POST 재시도 허용 여부, POST 타임아웃 뒤 처리 방식의 근거.
// 실행(모든 실험이 끝난 뒤): RUN_ID=<id> node measurements/exp/e4-side-effects.js
//
// - 실험마다 POST 1건 = 고유 employeeId 이므로, 목록 totalCount 로 "생성됨" 을 판별할 수 있다.
//   (E3 중복 실험은 employeeId 를 공유하므로 제외한다)
// - 목록 GET 도 5xx 가 잦아 200 을 받을 때까지 최대 4회(2초 간격) 시도. GET 이라 재시도해도 부작용이 없다.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient, RAW_DIR, runIdFromEnv, sleep } from '../lib/client.js'

const runId = runIdFromEnv()
const LIST_ATTEMPTS = 4
const client = createClient({ runId, exp: 'e4', rps: 5, probeOnError: false })

const posts = readdirSync(RAW_DIR)
  .filter((f) => f.startsWith(`${runId}-`) && f.endsWith('.ndjson') && !f.endsWith('-e3.ndjson') && !f.endsWith('-e4.ndjson'))
  .flatMap((f) => readFileSync(RAW_DIR + f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)))
  .filter((r) => r.method === 'POST' && r.employeeId)

const uncertain = posts.filter((r) => r.errorClass === 'timeout' || r.errorClass === 'network' || r.httpStatus >= 500)
const kind = (r) => r.errorClass ?? `http-${r.httpStatus}`
console.log(`[e4] POST ${posts.length}건 중 결과 불확실 ${uncertain.length}건`)

const results = []
for (const p of uncertain) {
  const path = `/background-checks?employeeId=${encodeURIComponent(p.employeeId)}`
  let found
  for (let a = 1; a <= LIST_ATTEMPTS; a++) {
    const r = await client.get(path, { meta: { employeeId: p.employeeId, sourceExp: p.exp, sourceSeq: p.seq, sourceKind: kind(p), attempt: a } })
    if (r.skipped) break
    if (r.status === 200) {
      found = { totalCount: r.json.totalCount, statuses: r.json.checks?.map((c) => c.status) }
      break
    }
    await sleep(2_000)
  }
  const created = found ? found.totalCount > 0 : null // null = 목록 조회를 끝내 못 함(판별 불가)
  results.push({ employeeId: p.employeeId, sourceExp: p.exp, kind: kind(p), postLatencyMs: p.latencyMs, timeoutMs: p.timeoutMs ?? 30_000, created, ...found })
  console.log(`[e4] ${p.employeeId} ${kind(p).padEnd(10)} → created=${created} ${found ? JSON.stringify(found.statuses) : ''}`)
}

const summary = {}
for (const r of results) {
  const s = (summary[r.kind] ??= { n: 0, created: 0, notCreated: 0, unknown: 0 })
  s.n++
  if (r.created === true) s.created++
  else if (r.created === false) s.notCreated++
  else s.unknown++
}
const out = fileURLToPath(new URL('../results/', import.meta.url))
mkdirSync(out, { recursive: true })
writeFileSync(`${out}${runId}-e4-side-effects.json`, JSON.stringify({ summary, results }, null, 2))
console.log('[e4] 요약', summary, client.stats())
