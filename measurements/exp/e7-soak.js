// E7 장시간 저속 샘플링: 같은 checkId 를 10초마다 GET (기본 2시간 = 720건).
// 시간대에 따라 오류율·지연이 달라지는지 확인해 다른 실험 값이 특정 시점의 우연이 아닌지 본다.
// 실행: RUN_ID=<id> caffeinate -i node measurements/exp/e7-soak.js
//
// - 재시도 탐침(E6)은 붙이지 않는다: 일정한 부하 패턴을 유지하고, E6 예산(200)을 주 실험에 남기기 위함.
// - 대상 checkId 를 만들기 위한 POST 가 5xx 면 "다른 employeeId 로" 새로 만든다(같은 요청 재전송이 아니므로 중복 생성 아님).
import { createClient, measId, runIdFromEnv, sleep } from '../lib/client.js'

const runId = runIdFromEnv()
const INTERVAL_MS = 10_000
const DURATION_MIN = Number(process.env.DURATION_MIN ?? 120)
const client = createClient({ runId, exp: 'e7', rps: 1, probeOnError: false })

let checkId
for (let attempt = 1; attempt <= 3 && !checkId; attempt++) {
  const r = await client.post('/background-checks', {
    employeeId: measId(runId, 'e7', attempt),
    firstName: '측정',
    lastName: '장',
    dateOfBirth: '1990-01-01',
  }, { meta: { employeeId: measId(runId, 'e7', attempt), phase: 'setup' } })
  if (r.skipped) break
  if (r.status === 201) checkId = r.json.checkId
  else await sleep(5_000)
}
if (!checkId) {
  console.error('[e7] 대상 checkId 생성 실패 — 종료')
  process.exit(1)
}

const total = Math.floor((DURATION_MIN * 60_000) / INTERVAL_MS)
const start = Date.now()
console.log(`[e7] runId=${runId} checkId=${checkId} ${total}건 / ${DURATION_MIN}분 시작`)
for (let i = 0; i < total; i++) {
  const wait = start + i * INTERVAL_MS - Date.now() // 고정 일정: 응답 지연이 간격을 밀지 않게
  if (wait > 0) await sleep(wait)
  const r = await client.get(`/background-checks/${checkId}`, { meta: { phase: 'soak', i } })
  if (r.skipped) {
    console.log(`[e7] 호출 상한 도달 — ${i}건에서 중단`)
    break
  }
  if (i % 60 === 0) console.log(`[e7] ${i}/${total} last=${r.status} ${r.rec.latencyMs}ms`)
}
console.log('[e7] 완료', client.stats())
