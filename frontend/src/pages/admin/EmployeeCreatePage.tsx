import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { api, type CreateEmployeeResponse } from '../../api'
import { Alert, Button, Card, Field, InfoList } from '../../components/ui'
import { useSubmit } from '../../lib/useSubmit'

export function EmployeeCreatePage() {
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const { error, submitting, submit } = useSubmit()
  const [created, setCreated] = useState<CreateEmployeeResponse | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit(async () => setCreated(await api.createEmployee({ lastName, firstName, birthDate: birthDate || null })))
  }

  function reset() {
    setCreated(null)
    setLastName('')
    setFirstName('')
    setBirthDate('')
  }

  if (created) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">계정 생성 완료</h1>
        <Card>
          <InfoList
            items={[
              ['사번', created.employee.employeeNo],
              ['성명', created.employee.fullName],
              ['아이디', <span className="font-mono">{created.username}</span>],
              ['초기 비밀번호', <span className="font-mono">{created.initialPassword}</span>],
            ]}
          />
          <div className="mt-4">
            <Alert tone="yellow">초기 비밀번호는 지금만 볼 수 있습니다. 직원에게 전달한 뒤 이 화면을 닫아 주세요.</Alert>
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              to={`/admin/employees/${created.employee.employeeNo}`}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              상세 보기
            </Link>
            <Button variant="secondary" onClick={reset}>
              한 명 더 만들기
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">직원 계정 생성</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* 성·이름을 따로 받는다. 복성(남궁, 황보, 선우)을 문자열 규칙으로 자를 수 없어서다 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="성" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="예: 남궁" required />
            <Field label="이름" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="예: 서준" required />
          </div>
          <Field
            label="생년월일"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            hint="확인되지 않았으면 비워 두세요. 입력하기 전까지 신원 조회를 실행할 수 없습니다."
          />
          <p className="text-xs text-gray-500">사번은 자동으로 발급되고, 아이디는 사번입니다.</p>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={submitting}>
            {submitting ? '생성 중...' : '생성'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
