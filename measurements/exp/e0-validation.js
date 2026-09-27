// E0 입력 검증: 한글/외자/복성/생년월일 누락 등에 대한 API 응답을 확인한다.
// → 성명 매핑 방식(한글 그대로 보낼 수 있는가), EMP-007(생년월일 미확인) 처리, 400 형식(중단 조건)의 근거.
// 실행: RUN_ID=<id> node measurements/exp/e0-validation.js
import { createClient, measId, runIdFromEnv, sleep } from '../lib/client.js'

const runId = runIdFromEnv()
const client = createClient({ runId, exp: 'e0', rps: 2, recordBody: true })
let n = 0
const id = () => measId(runId, 'e0', ++n)

// omit: 필드를 아예 빼는 경우
const cases = [
  { name: 'hangul-basic', body: { firstName: '민준', lastName: '김', dateOfBirth: '1990-03-15' } },
  { name: 'ascii-basic', body: { firstName: 'Minjun', lastName: 'Kim', dateOfBirth: '1990-03-15' } },
  { name: 'hangul-single-char-first', body: { firstName: '솔', lastName: '김', dateOfBirth: '1992-12-30' } },
  { name: 'hangul-compound-surname', body: { firstName: '서준', lastName: '남궁', dateOfBirth: '1988-07-21' } },
  { name: 'first-empty', body: { firstName: '', lastName: '김', dateOfBirth: '1990-03-15' } },
  { name: 'first-whitespace', body: { firstName: ' ', lastName: '김', dateOfBirth: '1990-03-15' } },
  { name: 'first-long-100', body: { firstName: '가'.repeat(100), lastName: '김', dateOfBirth: '1990-03-15' } },
  { name: 'dob-missing', body: { firstName: '서연', lastName: '이' }, omitDob: true },
  { name: 'dob-null', body: { firstName: '서연', lastName: '이', dateOfBirth: null } },
  { name: 'dob-empty', body: { firstName: '서연', lastName: '이', dateOfBirth: '' } },
  { name: 'dob-invalid-date', body: { firstName: '민준', lastName: '김', dateOfBirth: '1990-13-45' } },
  { name: 'dob-no-dash', body: { firstName: '민준', lastName: '김', dateOfBirth: '19900315' } },
  { name: 'dob-future', body: { firstName: '민준', lastName: '김', dateOfBirth: '2099-01-01' } },
  { name: 'lastname-missing', body: { firstName: '민준', dateOfBirth: '1990-03-15' } },
  { name: 'employeeid-missing', body: { firstName: '민준', lastName: '김', dateOfBirth: '1990-03-15' }, omitEmployeeId: true },
]

const created = []
for (const c of cases) {
  const employeeId = c.omitEmployeeId ? undefined : id()
  const body = { ...(employeeId ? { employeeId } : {}), ...c.body }
  const r = await client.post('/background-checks', body, { meta: { case: c.name, employeeId } })
  if (r.skipped) break
  console.log(`[e0] ${c.name.padEnd(26)} POST ${r.status} ${r.json?.status ?? ''} ${r.json?.message ?? ''}`)
  if (r.status === 201) created.push({ case: c.name, checkId: r.json.checkId, sent: c.body })
}

// 생성된 것 중 이름 관련 케이스는 GET 으로 값이 그대로 돌아오는지(인코딩) 확인
await sleep(2_000)
for (const c of created.filter((x) => x.case.startsWith('hangul') || x.case.startsWith('ascii'))) {
  const r = await client.get(`/background-checks/${c.checkId}`, { meta: { case: `${c.case}:echo` } })
  if (r.skipped) break
  const echo = r.json && { firstName: r.json.firstName, lastName: r.json.lastName, dateOfBirth: r.json.dateOfBirth }
  const same = echo && echo.firstName === c.sent.firstName && echo.lastName === c.sent.lastName
  console.log(`[e0] ${(c.case + ':echo').padEnd(26)} GET ${r.status} echo=${JSON.stringify(echo)} same=${same}`)
}

for (const [name, path] of [
  ['get-nonexistent-checkid', '/background-checks/CHK-00000000-0000-0000-0000-000000000000'],
  ['get-malformed-checkid', '/background-checks/not-a-check-id'],
  ['list-missing-employeeid', '/background-checks'],
]) {
  const r = await client.get(path, { meta: { case: name } })
  if (r.skipped) break
  console.log(`[e0] ${name.padEnd(26)} GET ${r.status} ${r.json?.message ?? ''}`)
}

await client.drain()
console.log('[e0] 완료', client.stats())
