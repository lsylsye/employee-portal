// E1 생애주기: POST 50건(2초 간격, 매번 다른 employeeId) → pending 이면 1초 간격으로 GET 추적(최대 180초).
// → POST 상태코드 분포, 즉시 완료 비율, pending→최종 소요 시간, estimatedCompletionSeconds 정확도 → 폴링 주기·최대 대기.
// 실행: RUN_ID=<id> node measurements/exp/e1-lifecycle.js
//
// - POST 가 5xx 여도 같은 요청을 재전송하지 않는다. 생성 여부는 E4(목록 조회)로 확인한다.
// - 추적 중 GET 오류(500/503/timeout)는 "재시도"가 아니라 다음 폴링으로 계속 진행한다. (E6 탐침은 클라이언트가 붙임)
// - 추적 결과 요약은 raw 와 별도로 results/<runId>-e1-tracks.json 에 저장한다(분석 편의).
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient, measId, runIdFromEnv, sleep } from '../lib/client.js'

const runId = runIdFromEnv()
const POSTS = Number(process.env.POSTS ?? 50)
const POST_GAP_MS = 2_000
const POLL_GAP_MS = 1_000
const MAX_TRACK_MS = 180_000
const FINAL = new Set(['clear', 'flagged'])

const client = createClient({ runId, exp: 'e1', rps: 10 })
const names = [['민준', '김'], ['서준', '남궁'], ['라온', '황보'], ['솔', '김'], ['진', '선우'], ['지우', '최'], ['하윤', '정']]
const tracks = []

async function track(t) {
  while (true) {
    const elapsed = Date.now() - t.postRespAt
    if (elapsed > MAX_TRACK_MS) return void (t.outcome = 'unfinished-timeout')
    const r = await client.get(`/background-checks/${t.checkId}`, { meta: { employeeId: t.employeeId, phase: 'poll' } })
    if (r.skipped) return void (t.outcome = 'unfinished-budget')
    t.polls++
    if (r.status !== 200) t.pollErrors++
    if (r.status === 200 && FINAL.has(r.json.status)) {
      t.outcome = r.json.status
      t.finalObservedMs = Date.now() - t.postRespAt // 폴링 관측(해상도: 폴링 간격 + GET 지연)
      t.serverCreatedAt = r.json.createdAt
      t.serverCompletedAt = r.json.completedAt
      return
    }
    await sleep(POLL_GAP_MS)
  }
}

const running = []
for (let i = 1; i <= POSTS; i++) {
  const employeeId = measId(runId, 'e1', i)
  const [firstName, lastName] = names[i % names.length]
  const dob = `19${80 + (i % 20)}-0${1 + (i % 9)}-1${i % 10}`
  const r = await client.post('/background-checks', { employeeId, firstName, lastName, dateOfBirth: dob }, { meta: { employeeId, phase: 'post' } })
  if (r.skipped) break
  const t = { i, employeeId, postStatus: r.status, polls: 0, pollErrors: 0 }
  tracks.push(t)
  if (r.status === 201) {
    t.checkId = r.json.checkId
    t.postBodyStatus = r.json.status
    t.estimatedCompletionSeconds = r.json.estimatedCompletionSeconds
    t.postRespAt = Date.now()
    if (FINAL.has(r.json.status)) t.outcome = `${r.json.status}-immediate`
    else running.push(track(t))
  } else {
    t.outcome = `post-${r.status ?? r.rec.errorClass}`
  }
  console.log(`[e1] ${String(i).padStart(2)} POST ${r.status ?? r.rec.errorClass} ${t.postBodyStatus ?? ''} est=${t.estimatedCompletionSeconds ?? '-'}`)
  await sleep(POST_GAP_MS)
}

await Promise.all(running)
await client.drain()

const out = fileURLToPath(new URL('../results/', import.meta.url))
mkdirSync(out, { recursive: true })
writeFileSync(`${out}${runId}-e1-tracks.json`, JSON.stringify(tracks, null, 2))
const byOutcome = tracks.reduce((m, t) => ((m[t.outcome] = (m[t.outcome] ?? 0) + 1), m), {})
console.log('[e1] 결과', byOutcome, client.stats())
