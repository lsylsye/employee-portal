import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '@/api'
import { EmptyState, InlineError, Loading, PageHeader } from '@/components/common'
import { BgBadge, EmploymentBadge } from '@/components/status'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLoad } from '@/lib/useLoad'

export function EmployeeListPage() {
  const navigate = useNavigate()
  const { data: employees, error, loading } = useLoad(() => api.listEmployees())
  const [query, setQuery] = useState('')

  const q = query.trim()
  const rows = employees && q ? employees.filter((e) => e.fullName.includes(q) || e.employeeNo.includes(q.toUpperCase())) : employees

  return (
    <>
      <PageHeader
        title="직원 목록"
        description={employees ? `전체 ${employees.length}명` : undefined}
        actions={
          <Button asChild>
            <Link to="/admin/employees/new">
              <Plus aria-hidden />
              계정 만들기
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="grid gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-8" placeholder="성명이나 사번으로 찾기" aria-label="직원 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {loading ? (
            <Loading />
          ) : error || !rows ? (
            <InlineError>{error ?? '목록을 불러오지 못했어요.'}</InlineError>
          ) : rows.length === 0 ? (
            <EmptyState title={q ? `'${q}'에 맞는 직원이 없어요` : '등록된 직원이 없어요'} description={q ? '성명이나 사번을 다시 확인해 주세요.' : undefined} />
          ) : (
            // 동명이인(EMP-001, 002)을 구분하도록 사번·생년월일을 항상 함께 보여 준다(F-i)
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사번</TableHead>
                  <TableHead>성명</TableHead>
                  <TableHead>생년월일</TableHead>
                  <TableHead>재직 상태</TableHead>
                  <TableHead>접근 차단일</TableHead>
                  <TableHead>최근 신원 조회</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.employeeNo} className="cursor-pointer" onClick={() => navigate(`/admin/employees/${e.employeeNo}`)}>
                    <TableCell>
                      {/* 키보드 사용자는 링크로 이동한다. 행 클릭은 마우스 편의 */}
                      <Link to={`/admin/employees/${e.employeeNo}`} className="font-mono text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
                        {e.employeeNo}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{e.fullName}</TableCell>
                    <TableCell>{e.birthDate ?? <span className="text-muted-foreground">확인되지 않음</span>}</TableCell>
                    <TableCell>
                      <EmploymentBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.accessBlockedOn ?? '-'}</TableCell>
                    {/* 판정만(판단 3). 조회가 없거나 보관 기간이 지났으면 null → "조회 안 함" */}
                    <TableCell>
                      <BgBadge status={e.latestCheckStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
