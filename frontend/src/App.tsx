import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { RequireRole, RootRedirect } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { MyProfilePage } from './pages/MyProfilePage'

function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-lg font-semibold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <Link to="/" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
        처음으로
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
            <Route path="/admin" element={<p className="text-sm text-gray-500">관리자 화면 (준비 중)</p>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
