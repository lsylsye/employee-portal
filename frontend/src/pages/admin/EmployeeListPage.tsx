import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api'
import { BgBadge, EmploymentBadge } from '../../components/status'
import { Alert, Card, Loading } from '../../components/ui'
import { useLoad } from '../../lib/useLoad'

export function EmployeeListPage() {
  const { data: employees, error, loading } = useLoad(() => api.listEmployees())
  const [query, setQuery] = useState('')

  if (loading) return <Loading />
  if (error || !employees) return <Alert>{error ?? '목록을 불러오지 못했습니다.'}</Alert>

  const q = query.trim()
  const rows = q ? employees.filter((e) => e.fullName.includes(q) || e.employeeNo.includes(q.toUpperCase())) : employees

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">직원 목록</h1>
        <Link to="/admin/employees/new" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          계정 생성
        </Link>
      </div>

      <Card>
        <input
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-72"
          placeholder="성명 또는 사번 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* 동명이인(EMP-001, 002)을 구분하도록 사번·생년월일을 항상 함께 보여 준다(F-i) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="py-2 pr-4 font-medium">사번</th>
                <th className="py-2 pr-4 font-medium">성명</th>
                <th className="py-2 pr-4 font-medium">생년월일</th>
                <th className="py-2 pr-4 font-medium">상태</th>
                <th className="py-2 pr-4 font-medium">접근 차단일</th>
                <th className="py-2 font-medium">최근 신원 조회</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((e) => (
                <tr key={e.employeeNo} className="hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <Link to={`/admin/employees/${e.employeeNo}`} className="font-mono text-blue-600 hover:underline">
                      {e.employeeNo}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{e.fullName}</td>
                  <td className="py-2 pr-4">{e.birthDate ?? <span className="text-yellow-700">확인되지 않음</span>}</td>
                  <td className="py-2 pr-4">
                    <EmploymentBadge status={e.status} />
                  </td>
                  <td className="py-2 pr-4">{e.accessBlockedFrom ?? '-'}</td>
                  <td className="py-2">
                    <BgBadge status={e.latestBgStatus} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">총 {employees.length}명</p>
      </Card>
    </div>
  )
}
