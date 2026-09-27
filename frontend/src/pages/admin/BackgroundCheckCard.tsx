import { useEffect, useState } from 'react'
import { api, type BgCheckDetail, type EmployeeDetail } from '../../api'
import { BgBadge } from '../../components/status'
import { Alert, Button, Card, InfoList, Loading } from '../../components/ui'
import { formatKst } from '../../lib/date'
import { useLoad } from '../../lib/useLoad'
import { useSubmit } from '../../lib/useSubmit'

/**
 * 화면이 우리 서버를 다시 읽는 주기. 외부 API 폴링은 백엔드가 따로 하고(Retry-After 따름),
 * 화면은 우리 DB 에 저장된 상태만 읽으므로 외부 호출이 늘지 않는다.
 */
const SCREEN_REFRESH_MS = 3000

/** 관리자 전용: 신원 조회 실행과 결과 (판단 2·3) */
export function BackgroundCheckCard({ employee }: { employee: EmployeeDetail }) {
  const { employeeNo } = employee
  const { data: checks, setData, error, loading, reload } = useLoad(() => api.listBackgroundChecks(employeeNo), employeeNo)
  const { error: runError, submitting, submit } = useSubmit()

  const hasPending = checks?.some((c) => c.status === 'pending') ?? false

  // 진행 중인 조회가 있으면 끝날 때까지 주기적으로 다시 읽는다
  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => void reload(), SCREEN_REFRESH_MS)
    return () => clearInterval(timer)
  }, [hasPending, reload])

  // 실행할 수 없는 이유. 버튼을 막고 이유를 보여 준다
  const blockedReason =
    employee.status === 'RESIGNED'
      ? '퇴사한 직원은 조회할 수 없습니다.'
      : !employee.birthDate
        ? '생년월일이 확인되지 않아 조회할 수 없습니다. 위 신원 정보에서 생년월일을 입력해 주세요.'
        : hasPending
          ? '진행 중인 조회가 끝나면 다시 실행할 수 있습니다.'
          : null

  function run() {
    if (!window.confirm(`${employee.fullName}(${employeeNo})의 신원 조회를 요청합니다. 실행 기록이 남습니다. 계속할까요?`)) return
    void submit(async () => {
      const created = await api.requestBackgroundCheck(employeeNo)
      setData([created, ...(checks ?? [])])
    })
  }

  return (
    <Card
      title="신원 조회 (Background Check)"
      actions={
        <Button onClick={run} disabled={submitting || blockedReason !== null}>
          {submitting ? '요청 중...' : '조회 실행'}
        </Button>
      }
    >
      <div className="space-y-3">
        {blockedReason && !hasPending && <Alert tone="yellow">{blockedReason}</Alert>}
        {runError && <Alert>{runError}</Alert>}

        {loading ? (
          <Loading />
        ) : error || !checks ? (
          <Alert>{error ?? '조회 내역을 불러오지 못했습니다.'}</Alert>
        ) : checks.length === 0 ? (
          <p className="text-sm text-gray-500">조회 내역이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="py-2 pr-4 font-medium">요청 시각</th>
                <th className="py-2 pr-4 font-medium">판정</th>
                <th className="py-2 pr-4 font-medium">완료 시각</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checks.map((c) => (
                <BgRow key={c.id} id={c.id} requestedAt={c.requestedAt} status={c.status} completedAt={c.completedAt} />
              ))}
            </tbody>
          </table>
        )}

        <p className="text-xs text-gray-500">
          목록에는 판정만 표시합니다. 상세 결과는 "결과 보기"를 누를 때만 불러오고 열람 기록이 남습니다. 신용등급은 수집하지
          않습니다.
        </p>
      </div>
    </Card>
  )
}

function BgRow({ id, requestedAt, status, completedAt }: Pick<BgCheckDetail, 'id' | 'requestedAt' | 'status' | 'completedAt'>) {
  const [detail, setDetail] = useState<BgCheckDetail | null>(null)
  const { error, submitting, submit } = useSubmit()
  const final = status === 'clear' || status === 'flagged'

  function toggle() {
    if (detail) return setDetail(null)
    void submit(async () => setDetail(await api.getBackgroundCheckDetail(id)))
  }

  return (
    <>
      <tr>
        <td className="py-2 pr-4">{formatKst(requestedAt)}</td>
        <td className="py-2 pr-4">
          <BgBadge status={status} />
        </td>
        <td className="py-2 pr-4">{formatKst(completedAt)}</td>
        <td className="py-2 text-right">
          {final && (
            <Button variant="secondary" onClick={toggle} disabled={submitting}>
              {detail ? '닫기' : '결과 보기'}
            </Button>
          )}
        </td>
      </tr>
      {status === 'needs_attention' && (
        <tr>
          <td colSpan={4} className="pb-3 text-xs text-yellow-800">
            외부 서비스에서 결과를 받지 못해 추적을 멈췄습니다. 잠시 후 다시 실행해 주세요.
          </td>
        </tr>
      )}
      {(detail || error) && (
        <tr>
          <td colSpan={4} className="pb-3">
            {error ? (
              <Alert>{error}</Alert>
            ) : (
              <div className="rounded-md bg-gray-50 p-3">
                <InfoList
                  items={[
                    ['범죄 기록', yesNo(detail!.criminalRecord, '있음', '없음')],
                    ['학력 검증', yesNo(detail!.educationVerified, '확인됨', '확인 안 됨')],
                    ['경력 검증', yesNo(detail!.employmentVerified, '확인됨', '확인 안 됨')],
                  ]}
                />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function yesNo(value: boolean | null, yes: string, no: string): string {
  if (value === null) return '-'
  return value ? yes : no
}
