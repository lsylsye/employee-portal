import { type FormEvent, useState } from 'react'
import { api, type ContactFields, type MyProfile } from '../api'
import { Alert, Button, Card, Field, InfoList, Loading } from '../components/ui'
import { formatKst } from '../lib/date'
import { errorMessage, useLoad } from '../lib/useLoad'

export function MyProfilePage() {
  const { data: profile, setData, error, loading } = useLoad(() => api.getMyProfile())

  if (loading) return <Loading />
  if (error || !profile) return <Alert>{error ?? '정보를 불러오지 못했습니다.'}</Alert>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">내 정보</h1>

      {/* 성명·생년월일은 BG 조회 입력값이라 본인이 고치지 않는다(F-b) */}
      <Card title="기본 정보">
        <InfoList
          items={[
            ['사번', profile.employeeNo],
            ['성명', profile.fullName],
            ['생년월일', profile.birthDate ?? '확인되지 않음'],
          ]}
        />
        <p className="mt-3 text-xs text-gray-500">성명과 생년월일을 바꿔야 하면 인사 담당자에게 요청해 주세요.</p>
      </Card>

      <ContactForm profile={profile} onSaved={setData} />

      {/* 판단 (3) b안: 조회 일자와 진행 상태만 보여 준다 */}
      <Card title="신원 조회(Background Check) 내역">
        {profile.backgroundChecks.length === 0 ? (
          <p className="text-sm text-gray-500">조회 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {profile.backgroundChecks.map((c) => (
              <li key={c.requestedAt} className="flex justify-between py-2">
                <span>{formatKst(c.requestedAt)}</span>
                <span className="text-gray-600">{c.state === 'IN_PROGRESS' ? '진행 중' : '완료'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-500">조회 결과 내용은 인사 담당자에게 별도로 요청할 수 있습니다.</p>
      </Card>
    </div>
  )
}

function ContactForm({ profile, onSaved }: { profile: MyProfile; onSaved: (p: MyProfile) => void }) {
  const [form, setForm] = useState<ContactFields>({ phone: profile.phone, email: profile.email, address: profile.address })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof ContactFields) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value })
    setSaved(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      onSaved(await api.updateMyProfile(form))
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="연락처">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="휴대전화" value={form.phone} onChange={set('phone')} />
          <Field label="이메일" type="email" value={form.email} onChange={set('email')} />
        </div>
        <Field label="주소" value={form.address} onChange={set('address')} />
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="green">저장했습니다.</Alert>}
        <Button type="submit" disabled={submitting}>
          {submitting ? '저장 중...' : '저장'}
        </Button>
      </form>
    </Card>
  )
}
