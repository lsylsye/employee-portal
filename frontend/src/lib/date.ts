// 시간 표시는 KST (N15). 브라우저 시간대와 관계없이 Asia/Seoul 로 고정한다.
const KST = 'Asia/Seoul'

/** 오늘 날짜(KST) 'YYYY-MM-DD'. 퇴사 차단일 기본값에 쓴다 */
export function todayKst(): string {
  // en-CA 로케일이 YYYY-MM-DD 형식을 준다
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(new Date())
}

/** UTC ISO 시각 → 'YYYY-MM-DD HH:mm' (KST) */
export function formatKst(iso: string | null): string {
  if (!iso) return '-'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
