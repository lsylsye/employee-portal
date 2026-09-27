import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api, type CreateEmployeeResponse } from '@/api'
import { Field, InfoList, InlineError, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useSubmit } from '@/lib/useSubmit'

export function EmployeeCreatePage() {
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const { error, submitting, submit } = useSubmit()
  const [created, setCreated] = useState<CreateEmployeeResponse | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit(async () => {
      const res = await api.createEmployee({ lastName, firstName, birthDate: birthDate || null })
      setCreated(res)
      toast.success(`${res.employee.fullName}(${res.employee.employeeNo}) 계정을 만들었어요.`)
    })
  }

  function reset() {
    setCreated(null)
    setLastName('')
    setFirstName('')
    setBirthDate('')
  }

  return (
    <div className="max-w-xl">
      <Link to="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        직원 목록
      </Link>
      <PageHeader title="계정 만들기" description="사번은 자동으로 발급되고, 아이디는 사번이에요." />

      {created ? (
        <Card>
          <CardHeader>
            <CardTitle>계정을 만들었어요</CardTitle>
            <CardDescription>아래 정보를 직원에게 전달해 주세요.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InfoList
              items={[
                ['사번', created.employee.employeeNo],
                ['성명', created.employee.fullName],
                ['아이디', <span className="font-mono">{created.username}</span>],
                ['초기 비밀번호', <span className="font-mono">{created.initialPassword}</span>],
              ]}
            />
            <p className="flex items-center gap-2 text-sm text-status-warning">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              초기 비밀번호는 지금만 볼 수 있어요.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link to={`/admin/employees/${created.employee.employeeNo}`}>상세 보기</Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              한 명 더 만들기
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              {/* 성·이름을 따로 받는다. 복성(남궁, 황보, 선우)을 문자열 규칙으로 자를 수 없어서다 */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="성" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="남궁" required />
                <Field label="이름" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="서준" required />
              </div>
              <Field
                label="생년월일"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                hint="확인되지 않았으면 비워 두세요. 입력하기 전까지 신원 조회를 할 수 없어요."
              />
              {error && <InlineError>{error}</InlineError>}
              <div>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" aria-hidden />}
                  계정 만들기
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
