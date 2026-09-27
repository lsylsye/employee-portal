import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'

type Health = { status: string; time: string }

// 배포 연결 확인용 첫 화면. 실제 화면은 feat/* 브랜치에서 채운다.
function Home() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Health>
      })
      .then(setHealth)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section>
      <h1>사내 직원 관리 시스템</h1>
      <p>
        API 상태:{' '}
        {error ? `연결 실패 (${error})` : health ? `${health.status} · ${health.time}` : '확인 중...'}
      </p>
    </section>
  )
}

function Placeholder({ title }: { title: string }) {
  return <h1>{title} (준비 중)</h1>
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">홈</Link> · <Link to="/login">로그인</Link> · <Link to="/me">내 정보</Link> ·{' '}
        <Link to="/admin">관리자</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Placeholder title="로그인" />} />
          <Route path="/me" element={<Placeholder title="내 정보" />} />
          <Route path="/admin/*" element={<Placeholder title="관리자" />} />
          <Route path="*" element={<Placeholder title="페이지를 찾을 수 없음" />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
