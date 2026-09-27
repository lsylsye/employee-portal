import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { Toaster } from './components/ui/sonner'
import { RequireRole, RootRedirect } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { EmployeeCreatePage } from './pages/admin/EmployeeCreatePage'
import { EmployeeDetailPage } from './pages/admin/EmployeeDetailPage'
import { EmployeeListPage } from './pages/admin/EmployeeListPage'
import { MyProfilePage } from './pages/MyProfilePage'

function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-lg font-semibold">페이지를 찾을 수 없어요</h1>
      <Link to="/" className="mt-2 inline-block text-sm text-primary hover:underline">
        처음으로 가기
      </Link>
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
            <Route path="/me" element={<MyProfilePage />} />
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
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
