import { FileQuestion } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { StatusPage } from './components/common'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/sonner'
import { RequireRole, RootRedirect } from './components/Layout'
import { PasswordChangePage } from './pages/PasswordChangePage'
import { LoginPage } from './pages/LoginPage'
import { EmployeeCreatePage } from './pages/admin/EmployeeCreatePage'
import { EmployeeDetailPage } from './pages/admin/EmployeeDetailPage'
import { EmployeeListPage } from './pages/admin/EmployeeListPage'
import { MyProfilePage } from './pages/MyProfilePage'

/** 404: 없는 주소. 로그인 여부와 관계없이 보이므로 앱 셸 밖에 둔다 */
function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <StatusPage
        icon={FileQuestion}
        code="404"
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 페이지예요. 주소를 다시 확인해 주세요."
        action={
          <Button asChild>
            <Link to="/">처음으로 가기</Link>
          </Button>
        }
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireRole role="EMPLOYEE" />}>
            <Route path="/me/password" element={<PasswordChangePage />} />
            <Route path="/me" element={<MyProfilePage />} />
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin/password" element={<PasswordChangePage />} />
            <Route path="/admin" element={<EmployeeListPage />} />
            <Route path="/admin/employees/new" element={<EmployeeCreatePage />} />
            <Route path="/admin/employees/:employeeNo" element={<EmployeeDetailPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="light" position="top-right" />
    </AuthProvider>
  )
}

export default App
