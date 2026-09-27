// BG API 실측용 클라이언트.
// - 요청 1건 = raw/<runId>-<exp>.ndjson 1줄
// - 재시도 없음 (원본 거동을 기록해야 재시도 정책의 근거가 되므로)
// - 호출 상한: 실험별 상한 + runId 전체 상한 (다른 프로세스(E7)의 원자료 줄 수까지 합산)
// - GET 이 500/503 이면 E6 재시도 탐침을 붙인다. POST 는 탐침하지 않는다(재전송 = 중복 생성 위험).
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadApiKey } from './env.js'

export const BASE_URL = 'https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com'
export const RAW_DIR = fileURLToPath(new URL('../raw/', import.meta.url))
export const GLOBAL_CAP = 5000
export const EXP_CAPS = { e0: 30, e1: 1500, e2: 1100, e3: 40, e4: 60, e5: 1100, e6: 200, e7: 750 }

const REQUEST_TIMEOUT_MS = 30_000 // 측정용으로 넉넉하게. 긴 꼬리 지연까지 관측하기 위함.
const PROBE_DELAYS_SEC = [0, 1, 5] // + Retry-After(없으면 30초)
const OTHERS_REFRESH_MS = 2_000

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function runIdFromEnv() {
  return process.env.RUN_ID || new Date().toISOString().slice(0, 10).replaceAll('-', '')
}

function countLines(file) {
  const text = readFileSync(file, 'utf8')
  let n = 0
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

export function createClient({ runId, exp, rps = 10, probeOnError = true, recordBody = false }) {
  const apiKey = loadApiKey()
  mkdirSync(RAW_DIR, { recursive: true })

  const counts = {} // 이 프로세스에서 보낸 실험별 호출 수
  let othersCount = 0 // 다른 파일(다른 실험/프로세스)의 호출 수
  let othersCheckedAt = 0
  let inFlight = 0
  let lastStart = 0
  let seq = 0
  const probes = []
  const minGapMs = rps ? 1000 / rps : 0

  function fileOf(e) {
    return `${RAW_DIR}${runId}-${e}.ndjson`
  }

  function refreshOthers() {
    if (Date.now() - othersCheckedAt < OTHERS_REFRESH_MS) return
    othersCheckedAt = Date.now()
    const mine = new Set(Object.keys(counts).map(fileOf))
    othersCount = existsSync(RAW_DIR)
      ? readdirSync(RAW_DIR)
          .filter((f) => f.startsWith(`${runId}-`) && f.endsWith('.ndjson'))
          .map((f) => RAW_DIR + f)
          .filter((f) => !mine.has(f))
          .reduce((sum, f) => sum + countLines(f), 0)
      : 0
  }

  // 이미 같은 실험 파일이 있으면(재실행) 그 줄 수부터 센다.
  function ownCount(e) {
    if (counts[e] === undefined) counts[e] = existsSync(fileOf(e)) ? countLines(fileOf(e)) : 0
    return counts[e]
  }

  function hasBudget(e) {
    refreshOthers()
    const mineTotal = Object.keys(counts).reduce((s, k) => s + counts[k], 0)
    return ownCount(e) < EXP_CAPS[e] && othersCount + mineTotal + inFlight < GLOBAL_CAP
  }

  async function throttle() {
    if (!minGapMs) return
    const wait = lastStart + minGapMs - Date.now()
    lastStart = Math.max(Date.now(), lastStart + minGapMs)
    if (wait > 0) await sleep(wait)
  }

  async function request(method, path, { body, meta = {}, e = exp } = {}) {
    if (!hasBudget(e)) return { skipped: true, reason: 'budget' }
    await throttle()
    ownCount(e)
    counts[e]++
    inFlight++

    const rec = { ts: new Date().toISOString(), runId, exp: e, seq: ++seq, method, path, ...meta }
    const t0 = performance.now()
    let res, json
    try {
      res = await fetch(BASE_URL + path, {
        method,
        headers: { 'X-Candidate-Key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const text = await res.text()
      rec.latencyMs = Math.round((performance.now() - t0) * 10) / 10
      rec.httpStatus = res.status
      rec.retryAfterHeader = res.headers.get('retry-after')
      try {
        json = JSON.parse(text)
      } catch {
        rec.errorClass = 'parse'
        rec.rawText = text.slice(0, 200)
      }
    } catch (err) {
      rec.latencyMs = Math.round((performance.now() - t0) * 10) / 10
      rec.errorClass = err.name === 'TimeoutError' ? 'timeout' : 'network'
      rec.errorMessage = String(err.message).slice(0, 200)
    } finally {
      inFlight--
    }

    if (json) {
      rec.checkId = json.checkId ?? rec.checkId
      rec.bodyStatus = json.status
      rec.estimatedCompletionSeconds = json.estimatedCompletionSeconds
      rec.createdAt = json.createdAt
      rec.completedAt = json.completedAt
      rec.retryAfterBody = json.retryAfter
      if (res.status >= 400) rec.errorMessage = json.message
      if (json.totalCount !== undefined) rec.totalCount = json.totalCount
      if (recordBody) rec.body = json
    }
    appendFileSync(fileOf(e), JSON.stringify(rec) + '\n')

    if (method === 'GET' && probeOnError && e !== 'e6' && (rec.httpStatus === 500 || rec.httpStatus === 503)) {
      probes.push(probe(path, rec))
    }
    return { rec, json, status: rec.httpStatus }
  }

  // E6: 실패한 GET 과 같은 요청을 +0, +1, +5, +Retry-After 초에 다시 보낸다 (기준 시점 = 실패 응답 수신).
  async function probe(path, failed) {
    const retryAfter = Number(failed.retryAfterHeader ?? failed.retryAfterBody ?? 30)
    const delays = [...PROBE_DELAYS_SEC, retryAfter]
    const base = Date.now()
    for (const d of delays) {
      const wait = base + d * 1000 - Date.now()
      if (wait > 0) await sleep(wait)
      const r = await request('GET', path, {
        e: 'e6',
        meta: { probeOf: `${failed.exp}#${failed.seq}`, probeOfStatus: failed.httpStatus, probeDelaySec: d },
      })
      if (r.skipped) return
    }
  }

  return {
    runId,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    hasBudget: () => hasBudget(exp),
    drain: () => Promise.all(probes),
    stats: () => ({ ...counts }),
  }
}

// 실측 전용 employeeId. 시드 사번(EMP-*)은 쓰지 않는다.
export function measId(runId, exp, n) {
  return `MEAS-${runId}-${exp.toUpperCase()}-${String(n).padStart(3, '0')}`
}
