import { ChevronDown, ChevronUp, Info, ShieldCheck } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, type BgCheckDetail, type BgCheckSummary, type EmployeeDetail } from '@/api'
import { ConfirmDialog, EmptyState, InfoList, InlineError, Loading } from '@/components/common'
import { BgBadge } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKst } from '@/lib/date'
import { useLoad } from '@/lib/useLoad'
import { useSubmit } from '@/lib/useSubmit'

/**
 * 화면이 우리 서버를 다시 읽는 주기. 외부 API 폴링은 백엔드가 따로 하고(Retry-After 따름),
 * 화면은 우리 DB 에 저장된 상태만 읽으므로 외부 호출이 늘지 않는다.
 */
const SCREEN_REFRESH_MS = 3000

/** 관리자 전용: 신원 조회 실행과 결과 (판단 2·3) */
export function BackgroundCheckCard({ employee }: { employee: EmployeeDetail }) {
  const { employeeNo } = employee
  const { data: checks, error, loading, reload } = useLoad(() => api.listBackgroundChecks(employeeNo), employeeNo)

  const hasPending = checks?.some((c) => c.status === 'pending') ?? false

  // 진행 중인 조회가 있으면 끝날 때까지 주기적으로 다시 읽는다
  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => void reload(), SCREEN_REFRESH_MS)
    return () => clearInterval(timer)
  }, [hasPending, reload])

  useNotifyWhenSettled(checks)

  // 실행할 수 없는 이유. 버튼을 막고 이유를 보여 준다
  const blockedReason =
    employee.status === 'BLOCKED'
      ? '퇴사한 직원은 신원 조회를 할 수 없어요.'
      : !employee.birthDate
        ? '생년월일이 확인되지 않아 신원 조회를 할 수 없어요. 신원 정보에서 생년월일을 먼저 입력해 주세요.'
        : hasPending
          ? '진행 중인 조회가 끝나면 다시 할 수 있어요.'
          : null

  async function run() {
    await api.requestBackgroundCheck(employeeNo)
    await reload()
    toast.info('신원 조회를 요청했어요. 결과가 나오면 알려 드릴게요.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>신원 조회</CardTitle>
        <CardDescription>목록에는 판정만 보여요. 상세 결과는 열 때마다 열람 기록이 남아요.</CardDescription>
        <CardAction>
          <ConfirmDialog
            trigger={
              <Button disabled={blockedReason !== null}>
                <ShieldCheck aria-hidden />
                조회 요청하기
              </Button>
            }
            title="신원 조회를 요청할까요?"
            description={`${employee.fullName}(${employeeNo})님의 성명과 생년월일을 외부 조회 서비스로 보내요. 요청 기록이 남아요.`}
            confirmLabel="요청하기"
            onConfirm={run}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {blockedReason && !hasPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden />
            {blockedReason}
          </p>
        )}

        {loading ? (
          <Loading />
        ) : error || !checks ? (
          <InlineError>{error ?? '조회 내역을 불러오지 못했어요.'}</InlineError>
        ) : checks.length === 0 ? (
          <EmptyState title="신원 조회 내역이 없어요" description="조회를 요청하면 여기에 결과가 쌓여요." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>요청 시각</TableHead>
                <TableHead>판정</TableHead>
                <TableHead>완료 시각</TableHead>
                <TableHead className="text-right">상세</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((c) => (
                <BgRow key={c.id} check={c} />
              ))}
            </TableBody>
          </Table>
        )}

        <p className="text-xs text-muted-foreground">신용등급은 수집하지 않아요.</p>
      </CardContent>
    </Card>
  )
}

/** 진행 중이던 조회가 끝나면 토스트로 알린다 */
function useNotifyWhenSettled(checks: BgCheckSummary[] | null) {
  const pendingIds = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!checks) return
    for (const c of checks) {
      if (c.status === 'pending') pendingIds.current.add(c.id)
      else if (pendingIds.current.delete(c.id)) {
        if (c.status === 'needs_attention') toast.error('신원 조회 결과를 받지 못했어요. 잠시 후 다시 요청해 주세요.')
        else toast.success('신원 조회 결과가 나왔어요.')
      }
    }
  }, [checks])
}

function BgRow({ check }: { check: BgCheckSummary }) {
  const [detail, setDetail] = useState<BgCheckDetail | null>(null)
  const { error, submitting, submit } = useSubmit()
  const final = check.status === 'clear' || check.status === 'flagged'
  const open = detail !== null || error !== null

  function toggle() {
    if (detail) return setDetail(null)
    void submit(async () => setDetail(await api.getBackgroundCheckDetail(check.id)))
  }

  return (
    <Fragment>
      <TableRow>
        <TableCell>{formatKst(check.requestedAt)}</TableCell>
        <TableCell>
          <BgBadge status={check.status} />
        </TableCell>
        <TableCell className="text-muted-foreground">{formatKst(check.completedAt)}</TableCell>
        <TableCell className="text-right">
          {final && (
            <Button variant="ghost" size="sm" onClick={toggle} disabled={submitting} aria-expanded={detail !== null}>
              {detail ? '접기' : '결과 보기'}
              {detail ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {check.status === 'needs_attention' && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="whitespace-normal">
            <InlineError>외부 서비스에서 결과를 받지 못해 추적을 멈췄어요. 잠시 후 다시 요청해 주세요.</InlineError>
          </TableCell>
        </TableRow>
      )}
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="whitespace-normal">
            {error ? (
              <InlineError>{error}</InlineError>
            ) : (
              <div className="rounded-md bg-muted/60 p-4">
                <InfoList
                  items={[
                    ['범죄 기록', yesNo(detail!.criminalRecord, '있음', '없음')],
                    ['학력 검증', yesNo(detail!.educationVerified, '확인됨', '확인 안 됨')],
                    ['경력 검증', yesNo(detail!.employmentVerified, '확인됨', '확인 안 됨')],
                  ]}
                />
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

function yesNo(value: boolean | null, yes: string, no: string): string {
  if (value === null) return '-'
  return value ? yes : no
}
