// E3 같은 employeeId 로 POST 반복: 멱등한가, 중복이 생성되는가, 결과가 매번 같은가 → POST 재시도 허용 여부.
// (a) 같은 내용 10회(2초 간격) (b) 같은 employeeId, 다른 이름·생년월일 3회 (c) 같은 내용 동시 5회
// 끝나면 최종 상태가 되도록 100초 기다린 뒤, 목록 GET(200 받을 때까지 최대 5회)으로 건수·checkId·상태를 비교한다.
// 실행: RUN_ID=<id> node measurements/exp/e3-duplicate-post.js
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient, measId, runIdFromEnv, sleep } from '../lib/client.js'

const runId = runIdFromEnv()
const client = createClient({ runId, exp: 'e3', rps: 10, probeOnError: false })
const base = { firstName: '민준', lastName: '김', dateOfBirth: '1990-03-15' }
const groups = {
  a: { employeeId: measId(runId, 'e3', 1), posts: [] },
  b: { employeeId: measId(runId, 'e3', 2), posts: [] },
  c: { employeeId: measId(runId, 'e3', 3), posts: [] },
}
const post = async (g, body, meta) => {
  const r = await client.post('/background-checks', { employeeId: groups[g].employeeId, ...body }, { meta: { group: g, employeeId: groups[g].employeeId, ...meta } })
  if (!r.skipped) groups[g].posts.push({ status: r.status ?? r.rec.errorClass, checkId: r.json?.checkId, bodyStatus: r.json?.status, ...meta })
  return r
}

for (let k = 1; k <= 10; k++) {
  const r = await post('a', base, { k })
  console.log(`[e3] a#${k} ${r.status} ${r.json?.checkId ?? ''} ${r.json?.status ?? ''}`)
  await sleep(2_000)
}
const variants = [base, { firstName: '서준', lastName: '남궁', dateOfBirth: '1988-07-21' }, { firstName: '민준', lastName: '김', dateOfBirth: '1994-11-02' }]
for (const [k, v] of variants.entries()) {
  const r = await post('b', v, { k: k + 1, variant: `${v.lastName}${v.firstName}/${v.dateOfBirth}` })
  console.log(`[e3] b#${k + 1} ${r.status} ${r.json?.checkId ?? ''} ${r.json?.status ?? ''}`)
  await sleep(2_000)
}
const conc = await Promise.all(Array.from({ length: 5 }, (_, k) => post('c', base, { k: k + 1, concurrent: true })))
conc.forEach((r, k) => console.log(`[e3] c#${k + 1} ${r.status} ${r.json?.checkId ?? ''} ${r.json?.status ?? ''}`))

console.log('[e3] 최종 상태 대기 100초')
await sleep(100_000)
for (const [g, v] of Object.entries(groups)) {
  for (let a = 1; a <= 5; a++) {
    const r = await client.get(`/background-checks?employeeId=${v.employeeId}`, { meta: { group: g, attempt: a, phase: 'list' } })
    if (r.skipped) break
    if (r.status === 200) {
      v.list = { totalCount: r.json.totalCount, checks: r.json.checks }
      break
    }
    await sleep(2_000)
  }
  const created = v.posts.filter((p) => p.status === 201)
  const distinct = new Set(created.map((p) => p.checkId)).size
  v.summary = {
    posts: v.posts.length,
    created201: created.length,
    distinctCheckIds: distinct,
    listTotal: v.list?.totalCount ?? null,
    listStatuses: v.list?.checks?.reduce((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {}) ?? null,
  }
  console.log(`[e3] ${g}`, JSON.stringify(v.summary))
}

const out = fileURLToPath(new URL('../results/', import.meta.url))
mkdirSync(out, { recursive: true })
writeFileSync(`${out}${runId}-e3-duplicates.json`, JSON.stringify(groups, null, 2))
console.log('[e3] 완료', client.stats())
