import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type EmployeeDetail } from '../../api'
import { EmploymentBadge } from '../../components/status'
import { BackgroundCheckCard } from './BackgroundCheckCard'
import { Alert, Button, Card, Field, InfoList, Loading } from '../../components/ui'
import { todayKst } from '../../lib/date'
import { useLoad } from '../../lib/useLoad'
import { useSubmit } from '../../lib/useSubmit'

export function EmployeeDetailPage() {
  const { employeeNo = '' } = useParams()
  const { data: employee, setData, error, loading } = useLoad(() => api.getEmployee(employeeNo), employeeNo)

  if (loading) return <Loading />
  if (error || !employee) return <Alert>{error ?? '직원 정보를 불러오지 못했습니다.'}</Alert>

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin" className="text-sm text-blue-600 hover:underline">
          ← 직원 목록
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-xl font-semibold text-gray-900">
          {employee.fullName}
          <span className="font-mono text-base font-normal text-gray-500">{employee.employeeNo}</span>
          <EmploymentBadge status={employee.status} />
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="인적사항">
          <InfoList
            items={[
              ['사번', employee.employeeNo],
              ['아이디', employee.username],
              ['성명', employee.fullName],
              ['생년월일', employee.birthDate ?? '확인되지 않음'],
              ['휴대전화', employee.phone || '-'],
              ['이메일', employee.email || '-'],
              ['주소', employee.address || '-'],
            ]}
          />
        </Card>
        {/* key: 저장 후 서버 값으로 폼을 다시 채운다 */}
        <IdentityForm key={`${employee.lastName}/${employee.firstName}/${employee.birthDate}`} employee={employee} onSaved={setData} />
      </div>

      <BackgroundCheckCard employee={employee} />

      <ResignationCard employee={employee} onSaved={setData} />
    </div>
  )
}

/**
 * 성·이름·생년월일 정정. 신원 조회 입력값이라 관리자만 고친다(F-b).
 * 황보라온·선우진처럼 복성 여부가 애매한 경우를 바로잡는 곳이기도 하다.
 */
function IdentityForm({ employee, onSaved }: { employee: EmployeeDetail; onSaved: (e: EmployeeDetail) => void }) {
  const [lastName, setLastName] = useState(employee.lastName)
  const [firstName, setFirstName] = useState(employee.firstName)
  const [birthDate, setBirthDate] = useState(employee.birthDate ?? '')
  const { error, submitting, submit } = useSubmit()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit(async () => onSaved(await api.updateEmployeeIdentity(employee.employeeNo, { lastName, firstName, birthDate: birthDate || null })))
  }

  return (
    <Card title="신원 정보 (신원 조회 입력값)">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="성 (lastName)" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          <Field label="이름 (firstName)" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <Field label="생년월일" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <p className="text-xs text-gray-500">
          외부 신원 조회에는 lastName=<b>{lastName || '?'}</b>, firstName=<b>{firstName || '?'}</b>로 보냅니다.
        </p>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="secondary" disabled={submitting}>
          {submitting ? '저장 중...' : '신원 정보 저장'}
        </Button>
      </form>
    </Card>
  )
}

/**
 * 퇴사 처리 (DECISIONS 1). 입력한 날짜 00:00 KST 부터 접근을 막는다.
 * 오늘이면 즉시, 미래면 예약. 레코드는 지우지 않는다.
 */
function ResignationCard({ employee, onSaved }: { employee: EmployeeDetail; onSaved: (e: EmployeeDetail) => void }) {
  const [date, setDate] = useState(employee.accessBlockedFrom ?? todayKst())
  const { error, submitting, submit } = useSubmit()

  if (employee.status === 'RESIGNED') {
    return (
      <Card title="퇴사 처리">
        <p className="text-sm text-gray-700">
          {employee.accessBlockedFrom}부터 접근이 차단되었습니다. 재입사하면 새 사번으로 등록합니다.
        </p>
      </Card>
    )
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const immediate = date <= todayKst()
    const message = immediate
      ? `${employee.fullName}(${employee.employeeNo})의 접근을 지금 바로 차단합니다. 로그인되어 있는 세션도 끊깁니다. 계속할까요?`
      : `${employee.fullName}(${employee.employeeNo})의 접근을 ${date} 00:00(KST)부터 차단합니다. 계속할까요?`
    if (!window.confirm(message)) return
    void submit(async () => onSaved(await api.resignEmployee(employee.employeeNo, { accessBlockedFrom: date })))
  }

  return (
    <Card title="퇴사 처리">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Field
            label="접근 차단일"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint="이 날 00:00(KST)부터 로그인할 수 없습니다."
            required
          />
        </div>
        <Button type="submit" variant="danger" disabled={submitting} className="mb-5">
          {employee.status === 'RESIGN_SCHEDULED' ? '차단일 변경' : '퇴사 처리'}
        </Button>
      </form>
      {employee.status === 'RESIGN_SCHEDULED' && (
        <p className="mt-2 text-sm text-yellow-800">{employee.accessBlockedFrom}부터 차단 예정입니다.</p>
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  )
}
