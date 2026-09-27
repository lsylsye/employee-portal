import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { api, type EmployeeDetail } from '@/api'
import { ConfirmDialog, Field, InfoList, InlineError, Loading, PageHeader } from '@/components/common'
import { EmploymentBadge } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { todayKst } from '@/lib/date'
import { useLoad } from '@/lib/useLoad'
import { useSubmit } from '@/lib/useSubmit'
import { BackgroundCheckCard } from './BackgroundCheckCard'

export function EmployeeDetailPage() {
  const { employeeNo = '' } = useParams()
  const { data: employee, setData, error, loading } = useLoad(() => api.getEmployee(employeeNo), employeeNo)

  return (
    <>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        직원 목록
      </Link>
      {loading ? (
        <Loading />
      ) : error || !employee ? (
        <InlineError>{error ?? '직원 정보를 불러오지 못했어요.'}</InlineError>
      ) : (
        <>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                {employee.fullName}
                <EmploymentBadge status={employee.status} />
              </span>
            }
            description={`${employee.employeeNo} · 생년월일 ${employee.birthDate ?? '확인되지 않음'}`}
          />
          <div className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>인적사항</CardTitle>
                  <CardDescription>연락처는 직원이 직접 고쳐요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <InfoList
                    items={[
                      ['사번', employee.employeeNo],
                      ['아이디', employee.username],
                      ['휴대전화', employee.phone || '-'],
                      ['이메일', employee.email || '-'],
                      ['주소', employee.address || '-'],
                    ]}
                  />
                </CardContent>
              </Card>
              <IdentityCard employee={employee} onSaved={setData} />
            </div>

            <BackgroundCheckCard employee={employee} />

            <DangerZone employee={employee} onSaved={setData} />
          </div>
        </>
      )}
    </>
  )
}

/**
 * 성·이름·생년월일. 신원 조회 입력값이라 관리자만 고친다(F-b).
 * 황보라온·선우진처럼 복성 여부가 애매한 경우를 바로잡는 곳이기도 하다.
 */
function IdentityCard({ employee, onSaved }: { employee: EmployeeDetail; onSaved: (e: EmployeeDetail) => void }) {
  const [editing, setEditing] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>신원 정보</CardTitle>
        <CardDescription>신원 조회에 그대로 보내는 값이에요.</CardDescription>
        {!editing && (
          <CardAction>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              수정하기
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <IdentityForm
            employee={employee}
            onCancel={() => setEditing(false)}
            onSaved={(e) => {
              onSaved(e)
              setEditing(false)
              toast.success('신원 정보를 저장했어요.')
            }}
          />
        ) : (
          <InfoList
            items={[
              ['성 (lastName)', employee.lastName],
              ['이름 (firstName)', employee.firstName],
              ['생년월일', employee.birthDate ?? <span className="text-muted-foreground">확인되지 않음</span>],
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}

function IdentityForm({ employee, onCancel, onSaved }: { employee: EmployeeDetail; onCancel: () => void; onSaved: (e: EmployeeDetail) => void }) {
  const [lastName, setLastName] = useState(employee.lastName)
  const [firstName, setFirstName] = useState(employee.firstName)
  const [birthDate, setBirthDate] = useState(employee.birthDate ?? '')
  const { error, submitting, submit } = useSubmit()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit(async () => onSaved(await api.updateEmployeeIdentity(employee.employeeNo, { lastName, firstName, birthDate: birthDate || null })))
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="성 (lastName)" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        <Field label="이름 (firstName)" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </div>
      <Field label="생년월일" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      {error && <InlineError>{error}</InlineError>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden />}
          저장하기
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          취소하기
        </Button>
      </div>
    </form>
  )
}

/**
 * 위험 영역: 퇴사 처리 (DECISIONS 1). 입력한 날짜 00:00 KST 부터 접근을 막는다.
 * 오늘이면 즉시(기존 세션도 끊김), 미래면 예약. 레코드는 지우지 않는다.
 */
function DangerZone({ employee, onSaved }: { employee: EmployeeDetail; onSaved: (e: EmployeeDetail) => void }) {
  const [date, setDate] = useState(employee.accessBlockedFrom ?? todayKst())
  const [dateError, setDateError] = useState<string | undefined>()

  if (employee.status === 'RESIGNED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>퇴사 처리</CardTitle>
          <CardDescription>
            {employee.accessBlockedFrom}부터 접근이 막혀 있어요. 다시 입사하면 새 사번으로 등록해 주세요.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const immediate = date !== '' && date <= todayKst()
  const scheduled = employee.status === 'RESIGN_SCHEDULED'

  async function confirm() {
    const saved = await api.resignEmployee(employee.employeeNo, { accessBlockedFrom: date })
    onSaved(saved)
    toast.success(immediate ? `${employee.fullName}님의 접근을 막았어요.` : `${date}부터 접근을 막도록 예약했어요.`)
  }

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">위험 영역</CardTitle>
        <CardDescription>
          {scheduled
            ? `${employee.accessBlockedFrom}부터 접근이 막힐 예정이에요. 날짜를 바꿀 수 있어요.`
            : '접근 차단일 00:00(한국 시간)부터 로그인할 수 없어요. 오늘로 하면 로그인 중인 세션도 바로 끊겨요.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Field
            label="접근 차단일"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setDateError(undefined)
            }}
            error={dateError}
          />
        </div>
        <ConfirmDialog
          trigger={
            <Button
              variant="destructive"
              onClick={(e) => {
                if (!date) {
                  e.preventDefault()
                  setDateError('접근 차단일을 입력해 주세요.')
                }
              }}
            >
              {scheduled ? '차단일 바꾸기' : '퇴사 처리하기'}
            </Button>
          }
          destructive
          title={immediate ? '지금 바로 접근을 막을까요?' : `${date}부터 접근을 막을까요?`}
          description={
            immediate
              ? `${employee.fullName}(${employee.employeeNo})님은 바로 로그인할 수 없고, 로그인 중인 세션도 끊겨요. 기록은 지우지 않아요.`
              : `${employee.fullName}(${employee.employeeNo})님은 ${date} 00:00(한국 시간)부터 로그인할 수 없어요. 그 전까지는 지금처럼 쓸 수 있어요.`
          }
          confirmLabel={immediate ? '접근 막기' : '예약하기'}
          onConfirm={confirm}
        />
      </CardContent>
    </Card>
  )
}
