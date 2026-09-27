// 실측 원자료(raw/<runId>-*.ndjson) → MEASUREMENTS.md 에 옮길 표(마크다운).
// 원칙: MEASUREMENTS 의 모든 수치는 이 스크립트가 계산한다(손계산 금지). 모든 수치에 n 을 붙인다.
// 실행: RUN_ID=<id> node measurements/analyze.js   → stdout + results/<runId>.md
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LEGACY_TIMEOUT_MS, RAW_DIR, runIdFromEnv } from './lib/client.js'

const runId = runIdFromEnv()
const PERSISTENT_MIN_ATTEMPTS = 3 // checkId 에 GET 3회 이상 시도했는데 성공 0 → "지속 실패" 로 분류
const WARMUP = 5 // 실험별 첫 5건은 연결 수립 비용이 섞여 지연 통계에서 제외

// ---------- 로드 ----------
const recs = readdirSync(RAW_DIR)
  .filter((f) => f.startsWith(`${runId}-`) && f.endsWith('.ndjson'))
  .flatMap((f) => readFileSync(RAW_DIR + f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .map((r) => ({ ...r, timeoutMs: r.timeoutMs ?? LEGACY_TIMEOUT_MS, outcome: r.errorClass ?? String(r.httpStatus) }))
  .sort((a, b) => (a.ts < b.ts ? -1 : 1))

const endpoint = (r) =>
  r.method === 'POST' ? 'POST' : /^\/background-checks\/[^/?]+$/.test(r.path) ? 'GET 상세' : 'GET 목록'
const checkIdOf = (r) => (endpoint(r) === 'GET 상세' ? r.path.split('/').pop() : null)

// ---------- 통계 도구 ----------
function percentile(sorted, p) {
  if (!sorted.length) return null
  const rank = Math.ceil((p / 100) * sorted.length) // nearest-rank
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]
}
// Wilson score 95% 구간. (같은 checkId 반복 시도는 독립이 아니므로 구간이 실제보다 좁게 나올 수 있음)
function wilson(k, n, z = 1.96) {
  if (!n) return [null, null]
  const p = k / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]
}
const pct = (x) => (x === null ? '-' : `${(x * 100).toFixed(1)}%`)
const ci = (k, n) => {
  const [lo, hi] = wilson(k, n)
  return `${pct(n ? k / n : null)} [${pct(lo)}–${pct(hi)}]`
}
const ms = (x) => (x === null ? '-' : x >= 1000 ? `${(x / 1000).toFixed(2)}s` : `${Math.round(x)}ms`)
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

const out = []
const h = (s) => out.push(`\n## ${s}\n`)
out.push(`# 실측 분석 — runId \`${runId}\``, '', `생성: ${new Date().toISOString()} / 전체 요청 n=${recs.length}`)

// ---------- 1. 상태코드 분포 (엔드포인트별) ----------
h('1. HTTP 상태코드 분포 (엔드포인트별, E6 탐침 포함)')
for (const ep of ['GET 상세', 'GET 목록', 'POST']) {
  const rs = recs.filter((r) => endpoint(r) === ep)
  if (!rs.length) continue
  const by = {}
  for (const r of rs) by[r.outcome] = (by[r.outcome] ?? 0) + 1
  out.push(`**${ep}** (n=${rs.length})\n`)
  out.push(table(['결과', '건수', '비율 [95% CI]'], Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, ci(v, rs.length)])))
  out.push('')
}

// ---------- 2. 지연 (엔드포인트 × 측정 타임아웃 구간, 성공 요청만) ----------
h('2. 응답 지연 — 성공 응답(2xx/4xx)만, 엔드포인트·측정 타임아웃 구간별')
out.push(`- 5xx 는 빠르게 실패하는 경향이 있어 섞으면 지연이 과소평가되므로 제외하고 따로 본다. 실험별 첫 ${WARMUP}건 제외.`)
out.push('- 30s 구간의 timeout 은 "30초 이상" 으로 잘린 값이라 백분위에 넣지 않고 건수만 표시한다.\n')
const warm = new Set()
{
  const seen = {}
  for (const r of recs) {
    seen[r.exp] = (seen[r.exp] ?? 0) + 1
    if (seen[r.exp] <= WARMUP) warm.add(r)
  }
}
const latRows = []
for (const ep of ['GET 상세', 'GET 목록', 'POST'])
  for (const t of [...new Set(recs.map((r) => r.timeoutMs))].sort()) {
    const rs = recs.filter((r) => endpoint(r) === ep && r.timeoutMs === t && !warm.has(r))
    const ok = rs.filter((r) => r.httpStatus && r.httpStatus < 500).map((r) => r.latencyMs).sort((a, b) => a - b)
    const err5 = rs.filter((r) => r.httpStatus >= 500).map((r) => r.latencyMs).sort((a, b) => a - b)
    const timeouts = rs.filter((r) => r.errorClass === 'timeout').length
    if (!rs.length) continue
    latRows.push([ep, `${t / 1000}s`, ok.length, ms(percentile(ok, 50)), ms(percentile(ok, 95)), ms(percentile(ok, 99)), ms(ok.at(-1) ?? null), timeouts, `${err5.length} (p50 ${ms(percentile(err5, 50))})`])
  }
out.push(table(['엔드포인트', '측정 타임아웃', '성공 n', 'p50', 'p95', 'p99', '최댓값', 'timeout 건수', '5xx n (지연 p50)'], latRows))

// ---------- 3. checkId 별 분해: 일시적 실패 vs 지속 실패 ----------
h('3. GET 상세 — checkId 별 분해 (일시적 실패 vs 지속 실패)')
out.push(`- 지속 실패 checkId: GET ${PERSISTENT_MIN_ATTEMPTS}회 이상 시도, 성공(200/404) 0회. 404 는 "없음" 이라는 확정 응답이라 성공으로 친다.`)
out.push('- ⚠️ 같은 checkId 의 반복 시도는 서로 독립이 아닐 수 있어 Wilson 구간은 실제보다 좁게 나올 수 있다.\n')
// 우리가 POST 로 만든 checkId 만 대상 (E0 의 존재하지 않는/형식 오류 checkId 는 입력 검증 케이스라 제외)
out.push('- 대상: 이 runId 에서 POST 로 생성한 checkId 만. E0 의 존재하지 않는 checkId 조회는 제외.\n')
const createdIds = new Set(recs.filter((r) => r.method === 'POST' && r.checkId).map((r) => r.checkId))
const byCheck = {}
for (const r of recs.filter((r) => createdIds.has(checkIdOf(r)))) (byCheck[checkIdOf(r)] ??= []).push(r)
const isOk = (r) => r.httpStatus === 200 || r.httpStatus === 404
const checks = Object.entries(byCheck).map(([id, rs]) => ({ id, n: rs.length, ok: rs.filter(isOk).length, rs }))
const eligible = checks.filter((c) => c.n >= PERSISTENT_MIN_ATTEMPTS)
const persistent = eligible.filter((c) => c.ok === 0)
const transientChecks = checks.filter((c) => c.ok > 0)
const tAttempts = transientChecks.reduce((s, c) => s + c.n, 0)
const tOk = transientChecks.reduce((s, c) => s + c.ok, 0)
const allAttempts = checks.reduce((s, c) => s + c.n, 0)
const allOk = checks.reduce((s, c) => s + c.ok, 0)
// 재시도 관점: 실패 직후 "같은 checkId 의 다음 시도" 가 성공했는가 (지속 실패 checkId 제외)
let nextN = 0
let nextOk = 0
for (const c of transientChecks)
  for (let i = 0; i + 1 < c.rs.length; i++)
    if (!isOk(c.rs[i])) {
      nextN++
      if (isOk(c.rs[i + 1])) nextOk++
    }
out.push(
  table(
    ['지표', '값 [95% CI]', 'n'],
    [
      ['전체 시도 성공률 (섞인 값)', ci(allOk, allAttempts), `시도 ${allAttempts} / checkId ${checks.length}`],
      [`지속 실패 checkId 비율 (${PERSISTENT_MIN_ATTEMPTS}회+ 시도한 checkId 중)`, ci(persistent.length, eligible.length), `checkId ${eligible.length}`],
      ['일시적 실패만의 시도 성공률 (한 번이라도 성공한 checkId)', ci(tOk, tAttempts), `시도 ${tAttempts} / checkId ${transientChecks.length}`],
      ['실패 직후 다음 시도 성공률 (같은 checkId)', ci(nextOk, nextN), `실패 ${nextN}`],
    ],
  ),
)
if (persistent.length) {
  // 지속 실패 checkId 를 만든 POST 입력
  const postByCheck = Object.fromEntries(recs.filter((r) => r.method === 'POST' && r.checkId).map((r) => [r.checkId, r]))
  out.push('\n지속 실패 checkId:\n')
  out.push(
    table(
      ['checkId', '시도', '결과 순서', '생성 입력 (exp / case / employeeId)'],
      persistent.map((c) => {
        const p = postByCheck[c.id]
        return [c.id, c.n, c.rs.map((r) => r.outcome).join(','), p ? `${p.exp} / ${p.case ?? p.phase ?? '-'} / ${p.employeeId}` : '-']
      }),
    ),
  )
}
out.push('\n연속 실패 N회 확률 (독립 가정, 계산값):\n')
{
  const pFailAll = allAttempts ? 1 - allOk / allAttempts : null
  const pFailT = tAttempts ? 1 - tOk / tAttempts : null
  out.push(
    table(
      ['N', '섞인 실패율 기준', '일시적 실패율 기준'],
      [1, 2, 3, 5, 8, 10].map((N) => [N, pct(pFailAll === null ? null : pFailAll ** N), pct(pFailT === null ? null : pFailT ** N)]),
    ),
  )
  out.push(`\n(섞인 실패율 ${pct(pFailAll)}, 일시적 실패율 ${pct(pFailT)} — 지속 실패 checkId 에는 횟수를 늘려도 효과가 없다)`)
}

// ---------- 4. E6 재시도 탐침: 대기 시간별 성공률 ----------
h('4. E6 재시도 탐침 — 실패한 GET 을 대기 후 다시 보냈을 때 성공률')
{
  const probes = recs.filter((r) => r.exp === 'e6')
  const byDelay = {}
  for (const r of probes) {
    const k = r.probeDelaySec
    ;(byDelay[k] ??= { n: 0, ok: 0 }).n++
    if (isOk(r)) byDelay[k].ok++
  }
  out.push(table(['대기(초)', '성공률 [95% CI]', 'n'], Object.entries(byDelay).sort((a, b) => a[0] - b[0]).map(([d, v]) => [d, ci(v.ok, v.n), v.n])))
}

// ---------- 4b. 실패 후 다음 시도까지의 간격별 성공률 (자연 발생 데이터) ----------
h('4b. 실패 → 같은 checkId 다음 시도: 간격별 성공률 (전 실험 자연 발생분)')
out.push('- E6 은 대기 단계별 n 이 작아, 모든 실험에서 "실패 후 같은 checkId 를 다시 조회한 경우" 를 간격(실패 응답 수신 → 다음 요청 시작)별로 나눈다.\n')
{
  const gapRows = []
  const buckets = [[0, 2], [2, 10], [10, 30], [30, 120], [120, Infinity]]
  const acc = buckets.map(() => ({ n: 0, ok: 0 }))
  for (const c of Object.values(byCheck)) {
    const rs = [...c].sort((a, b) => (a.ts < b.ts ? -1 : 1))
    for (let i = 0; i + 1 < rs.length; i++) {
      if (isOk(rs[i])) continue
      const gap = (new Date(rs[i + 1].ts) - (new Date(rs[i].ts).getTime() + (rs[i].latencyMs ?? 0))) / 1000
      const bi = buckets.findIndex(([lo, hi]) => gap >= lo && gap < hi)
      if (bi < 0) continue
      acc[bi].n++
      if (isOk(rs[i + 1])) acc[bi].ok++
    }
  }
  buckets.forEach(([lo, hi], i) => gapRows.push([`${lo}–${hi === Infinity ? '' : hi}s`, ci(acc[i].ok, acc[i].n), acc[i].n]))
  out.push(table(['실패 후 간격', '다음 시도 성공률 [95% CI]', 'n'], gapRows))
  out.push(`\n(비교: 전체 시도 성공률 ${ci(allOk, allAttempts)}, n=${allAttempts})`)
}

// ---------- 5. Retry-After ----------
h('5. 503 의 Retry-After — 헤더 vs 본문')
{
  const r503 = recs.filter((r) => r.httpStatus === 503)
  const hdr = r503.filter((r) => r.retryAfterHeader !== null && r.retryAfterHeader !== undefined)
  const body = r503.filter((r) => r.retryAfterBody !== undefined && r.retryAfterBody !== null)
  const vals = [...new Set(r503.map((r) => `${r.retryAfterHeader ?? '-'}/${r.retryAfterBody ?? '-'}`))]
  out.push(table(['지표', '값', 'n'], [['헤더 Retry-After 있음', ci(hdr.length, r503.length), r503.length], ['본문 retryAfter 있음', ci(body.length, r503.length), r503.length], ['관측된 값(헤더/본문)', vals.join(', '), r503.length]]))
}

// ---------- 6. POST 즉시 완료 / estimatedCompletionSeconds ----------
h('6. POST 응답 상태 (201 중 즉시 완료 비율)')
{
  const p201 = recs.filter((r) => r.method === 'POST' && r.httpStatus === 201)
  const by = {}
  for (const r of p201) by[r.bodyStatus] = (by[r.bodyStatus] ?? 0) + 1
  out.push(table(['POST 응답 status', '건수', '비율 [95% CI]'], Object.entries(by).map(([k, v]) => [k, v, ci(v, p201.length)])))
  const est = p201.filter((r) => r.estimatedCompletionSeconds !== undefined)
  out.push(`\nestimatedCompletionSeconds 가 있는 201: ${est.length}/${p201.length}, 값: ${[...new Set(est.map((r) => r.estimatedCompletionSeconds))].join(', ') || '-'}`)
}

// ---------- 6b. 성공 지연의 모양 + 시간 예산 시뮬레이션 ----------
h('6b. GET 상세 — 성공 지연의 모양과 서버 상한 (60s 구간)')
const g60 = recs.filter((r) => endpoint(r) === 'GET 상세' && r.timeoutMs === 60_000)
{
  const ok = g60.filter(isOk).map((r) => r.latencyMs).sort((a, b) => a - b)
  const any = g60.filter((r) => r.latencyMs !== undefined).map((r) => r.latencyMs).sort((a, b) => a - b)
  out.push(`- 60s 구간 GET 상세 n=${g60.length}. 응답 최댓값(상태 무관) ${ms(any.at(-1) ?? null)}, 30.5초 초과 응답 ${any.filter((x) => x > 30_500).length}건, timeout ${g60.filter((r) => r.errorClass === 'timeout').length}건`)
  out.push(`- 전체 응답(상태 무관) 지연: n=${any.length}, p50 ${ms(percentile(any, 50))}, p95 ${ms(percentile(any, 95))}, p99 ${ms(percentile(any, 99))}, 최댓값 ${ms(any.at(-1) ?? null)}`)
  out.push(`- 30초 넘게 걸린 응답의 상태: ${JSON.stringify(g60.filter((r) => r.latencyMs > 30_000).reduce((m, r) => ((m[r.outcome] = (m[r.outcome] ?? 0) + 1), m), {}))}\n`)
  out.push(table(['성공 응답 지연 ≤', ...[0.5, 1, 2, 3, 5, 10, 20, 30].map((t) => `${t}s`)], [
    ['누적 비율 (성공 n=' + ok.length + ')', ...[0.5, 1, 2, 3, 5, 10, 20, 30].map((t) => pct(ok.filter((x) => x <= t * 1000).length / ok.length))],
    ['시도당 T초 안에 성공할 확률 (전체 n=' + g60.length + ')', ...[0.5, 1, 2, 3, 5, 10, 20, 30].map((t) => pct(ok.filter((x) => x <= t * 1000).length / g60.length))],
  ]))
}

h('6c. 동기 조회 시간 예산 시뮬레이션 (60s 구간 원자료 재표집)')
out.push('- 근거: §3 "실패 직후 다음 시도 성공률" 이 전체 성공률과 같고 §4 대기 시간별 성공률 차이가 없어, 시도를 독립으로 보고 원자료에서 무작위로 뽑아 재현한다.')
out.push('- 한 시도: 무작위 원자료 1건. 지연 ≤ 시도 타임아웃 이고 성공이면 성공. 아니면 min(지연, 타임아웃) 만큼 시간을 쓰고 다음 시도. 예산을 넘으면 포기. 20,000회 반복, 시드 고정.\n')
{
  let seed = 42
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const pool = g60.map((r) => ({ lat: r.errorClass === 'timeout' ? r.timeoutMs : r.latencyMs, ok: isOk(r) }))
  const sim = (T, B, trials = 20_000, maxTries = Infinity) => {
    let succ = 0
    const waits = []
    let tries = 0
    for (let k = 0; k < trials; k++) {
      let t = 0
      let n = 0
      for (;;) {
        const a = pool[Math.floor(rand() * pool.length)]
        const cap = Math.min(T, B - t)
        n++
        if (a.ok && a.lat <= cap) { t += a.lat; succ++; waits.push(t); break }
        t += Math.min(a.lat, cap)
        if (t >= B - 1 || n >= maxTries) { waits.push(t); break }
      }
      tries += n
    }
    waits.sort((a, b) => a - b)
    return { p: succ / trials, p95: percentile(waits, 95), tries: tries / trials }
  }
  const rows = []
  for (const B of [5_000, 10_000, 15_000, 30_000])
    for (const T of [2_000, 3_000, 5_000, 30_500]) {
      if (T > B && T !== 30_500) continue
      const r = sim(T, B)
      rows.push([`${B / 1000}s`, T === 30_500 ? '30.5s(상한 대기)' : `${T / 1000}s`, pct(r.p), ms(r.p95), r.tries.toFixed(1)])
    }
  out.push(table(['전체 예산', '시도당 타임아웃', '예산 안 성공 확률', '사용자 대기 p95', '평균 시도 수'], rows))
  out.push('\n시도 횟수 상한을 함께 둘 때 (예산 10s, 시도당 2s):\n')
  out.push(table(['최대 시도', '성공 확률', '대기 p95', '평균 시도 수'], [3, 4, 5, 6, 8, Infinity].map((m) => {
    const r = sim(2_000, 10_000, 20_000, m)
    return [m === Infinity ? '제한 없음' : m, pct(r.p), ms(r.p95), r.tries.toFixed(1)]
  })))
}

// ---------- 7. E1 pending → 최종 소요 시간 ----------
h('7. pending → 최종 상태 소요 시간 (E1)')
{
  let tracks = []
  try {
    tracks = JSON.parse(readFileSync(fileURLToPath(new URL(`./results/${runId}-e1-tracks.json`, import.meta.url)), 'utf8'))
  } catch {}
  const pend = tracks.filter((t) => t.postBodyStatus === 'pending')
  const srv = pend.filter((t) => t.serverCompletedAt).map((t) => new Date(t.serverCompletedAt) - new Date(t.serverCreatedAt)).sort((a, b) => a - b)
  const obs = pend.filter((t) => t.finalObservedMs).map((t) => t.finalObservedMs).sort((a, b) => a - b)
  const immediate = tracks.filter((t) => String(t.outcome).endsWith('-immediate')).length
  const created = tracks.filter((t) => t.postStatus === 201).length
  out.push(`- POST 201 중 즉시 최종: ${ci(immediate, created)} (n=${created}), pending 중 미완료: ${pend.filter((t) => String(t.outcome).startsWith('unfinished')).length}/${pend.length}\n`)
  out.push(
    table(
      ['기준', 'n', '최소', 'p50', 'p90', 'p95', '최댓값'],
      [
        ['서버 completedAt − createdAt', srv.length, ms(srv[0] ?? null), ms(percentile(srv, 50)), ms(percentile(srv, 90)), ms(percentile(srv, 95)), ms(srv.at(-1) ?? null)],
        ['폴링 관측 (POST 응답 → 최종 GET 수신, 1초 간격)', obs.length, ms(obs[0] ?? null), ms(percentile(obs, 50)), ms(percentile(obs, 90)), ms(percentile(obs, 95)), ms(obs.at(-1) ?? null)],
      ],
    ),
  )
  const polls = pend.reduce((s, t) => s + t.polls, 0)
  const pollErr = pend.reduce((s, t) => s + t.pollErrors, 0)
  out.push(`\n폴링 GET 실패: ${ci(pollErr, polls)} (n=${polls})`)
}

// ---------- 7b. 폴링 간격 시뮬레이션 (E1 완료 시간 × GET 원자료) ----------
h('7b. 폴링 간격별 결과 확인 지연과 호출 수 (시뮬레이션)')
out.push('- 완료 시각: E1 pending 건의 서버 기준 소요 시간(completedAt − createdAt)에서 무작위 추출. 폴링 결과: 60s 구간 GET 상세 원자료에서 무작위 추출(시도당 타임아웃 31s).')
out.push('- 첫 폴링 25초 뒤, 이후 고정 간격. 폴링 응답이 성공이고 그 시점이 완료 이후면 확인. 최대 5분. 20,000회, 시드 고정.')
out.push('- ⚠️ 완료 시간 표본이 n=18 로 작다. 분포의 꼬리(최댓값 부근)는 불확실하다.\n')
{
  let tracks = []
  try {
    tracks = JSON.parse(readFileSync(fileURLToPath(new URL(`./results/${runId}-e1-tracks.json`, import.meta.url)), 'utf8'))
  } catch {}
  const comp = tracks.filter((t) => t.postBodyStatus === 'pending' && t.serverCompletedAt).map((t) => new Date(t.serverCompletedAt) - new Date(t.serverCreatedAt))
  const pool = g60.map((r) => ({ lat: Math.min(r.errorClass === 'timeout' ? r.timeoutMs : r.latencyMs, 31_000), ok: r.httpStatus === 200 }))
  let seed = 7
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const rows = []
  if (comp.length && pool.length)
    for (const I of [5_000, 10_000, 20_000, 30_000]) {
      const delays = []
      let calls = 0
      let giveUp = 0
      const N = 20_000
      for (let k = 0; k < N; k++) {
        const done = comp[Math.floor(rand() * comp.length)]
        let t = 25_000
        let seen = null
        while (t <= 300_000) {
          const a = pool[Math.floor(rand() * pool.length)]
          calls++
          const respAt = t + a.lat
          if (a.ok && t >= done) { seen = respAt; break }
          t = Math.max(t + I, respAt) // 응답을 받은 뒤 다음 폴링 (간격보다 빨리 보내지 않음)
        }
        if (seen === null) giveUp++
        else delays.push(seen - done)
      }
      delays.sort((a, b) => a - b)
      rows.push([`${I / 1000}s`, ms(percentile(delays, 50)), ms(percentile(delays, 95)), (calls / N).toFixed(1), pct(giveUp / N)])
    }
  out.push(table(['폴링 간격', '완료→확인 지연 p50', '완료→확인 지연 p95', '건당 평균 GET 수', '5분 안에 확인 못 함'], rows))
}

// ---------- 8. E3 같은 employeeId POST 반복 ----------
h('8. 같은 employeeId 로 POST 반복 (E3)')
{
  const p3 = recs.filter((r) => r.exp === 'e3' && r.method === 'POST')
  const rows = []
  for (const g of ['a', 'b', 'c']) {
    const ps = p3.filter((r) => r.group === g)
    if (!ps.length) continue
    const ok = ps.filter((r) => r.httpStatus === 201)
    const label = { a: '같은 내용 순차 반복', b: '같은 id, 다른 이름·생년월일', c: '같은 내용 동시' }[g]
    rows.push([`${g}: ${label}`, ps.length, ok.length, new Set(ok.map((r) => r.checkId)).size, ok.map((r) => r.bodyStatus).join(',')])
  }
  out.push(table(['그룹', 'POST n', '201', '서로 다른 checkId', 'POST 응답 status 순서'], rows))
  const lists = recs.filter((r) => r.exp === 'e3' && r.phase === 'list')
  out.push(`\n목록 확인: ${lists.filter((r) => r.httpStatus === 200).map((r) => `${r.group} totalCount=${r.totalCount}`).join(', ') || '없음'} (목록 GET n=${lists.length}, 200 ${lists.filter((r) => r.httpStatus === 200).length})`)
}

// ---------- 9. E5 동시성 단계별 ----------
h('9. 동시 요청 수에 따른 변화 (E5)')
{
  const e5 = recs.filter((r) => r.exp === 'e5')
  const rows = []
  for (const kind of ['GET', 'POST'])
    for (const c of [...new Set(e5.filter((r) => r.kind === kind).map((r) => r.concurrency))].sort((a, b) => a - b)) {
      const rs = e5.filter((r) => r.kind === kind && r.concurrency === c)
      const ok = rs.filter((r) => r.httpStatus && r.httpStatus < 500).map((r) => r.latencyMs).sort((a, b) => a - b)
      const n5 = rs.filter((r) => r.httpStatus >= 500).length
      const n503 = rs.filter((r) => r.httpStatus === 503).length
      rows.push([kind, c, rs.length, ci(ok.length, rs.length), ci(n503, rs.length), n5, ms(percentile(ok, 50)), ms(percentile(ok, 95)), ms(ok.at(-1) ?? null), rs.filter((r) => r.errorClass === 'timeout').length])
    }
  out.push(table(['요청', '동시', 'n', '성공률 [95% CI]', '503 비율 [95% CI]', '5xx n', '성공 p50', '성공 p95', '성공 최댓값', 'timeout'], rows))
}

// ---------- 10. E7 시간대별 ----------
h('10. 시간 경과에 따른 변화 (E7, 30분 구간)')
{
  const e7 = recs.filter((r) => r.exp === 'e7' && r.method === 'GET')
  if (e7.length) {
    const t0 = new Date(e7[0].ts)
    const buckets = {}
    for (const r of e7) (buckets[Math.floor((new Date(r.ts) - t0) / 1_800_000)] ??= []).push(r)
    out.push(
      table(
        ['구간(분)', 'n', '성공률 [95% CI]', '성공 p50', '성공 p95', 'timeout(30s 구간)'],
        Object.entries(buckets).map(([b, rs]) => {
          const ok = rs.filter((r) => r.httpStatus === 200).map((r) => r.latencyMs).sort((a, x) => a - x)
          return [`${b * 30}–${b * 30 + 30}`, rs.length, ci(ok.length, rs.length), ms(percentile(ok, 50)), ms(percentile(ok, 95)), rs.filter((r) => r.errorClass === 'timeout').length]
        }),
      ),
    )
  }
}

const text = out.join('\n')
console.log(text)
const dir = fileURLToPath(new URL('./results/', import.meta.url))
mkdirSync(dir, { recursive: true })
writeFileSync(`${dir}${runId}.md`, text + '\n')
