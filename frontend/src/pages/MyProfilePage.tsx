import { Loader2, Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { api, type ContactFields, type MyProfile, type UpdateMyProfileRequest } from '@/api'
import { EmptyState, Field, InfoList, InlineError, Loading, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKst } from '@/lib/date'
import { useLoad } from '@/lib/useLoad'
import { useSubmit } from '@/lib/useSubmit'

export function MyProfilePage() {
  const { data: profile, setData, error, loading } = useLoad(() => api.getMyProfile())

  if (loading) return <Loading />
  if (error || !profile) return <InlineError>{error ?? '정보를 불러오지 못했어요.'}</InlineError>

  return (
    <>
      <PageHeader title="내 정보" description={`${profile.fullName} · ${profile.employeeNo}`} />
      <div className="grid gap-6">
        {/* 성명·생년월일은 BG 조회 입력값이라 본인이 고치지 않는다(F-b) */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>성명과 생년월일을 바꿔야 하면 인사 담당자에게 요청해 주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                ['사번', profile.employeeNo],
                ['성명', profile.fullName],
                ['생년월일', profile.birthDate ?? '확인되지 않았어요'],
              ]}
            />
          </CardContent>
        </Card>

        <ContactCard profile={profile} onSaved={setData} />

        <MyBackgroundChecks />
      </div>
    </>
  )
}

/** 판단 (3) b안: 조회 일자와 진행 상태만 보여 준다 */
function MyBackgroundChecks() {
  const { data: checks, error, loading } = useLoad(() => api.listMyBackgroundChecks())

  return (
    <Card>
      <CardHeader>
        <CardTitle>신원 조회 내역</CardTitle>
        <CardDescription>조회 결과 내용은 인사 담당자에게 따로 요청할 수 있어요.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loading />
        ) : error || !checks ? (
          <InlineError>{error ?? '조회 내역을 불러오지 못했어요.'}</InlineError>
        ) : checks.length === 0 ? (
          <EmptyState title="신원 조회 내역이 없어요" />
        ) : (
          <ul className="divide-y text-sm">
            {checks.map((c) => (
              <li key={c.requestedAt} className="flex justify-between py-2">
                <span>{formatKst(c.requestedAt)}</span>
                <span className="text-muted-foreground">{c.state === 'IN_PROGRESS' ? '진행 중' : '완료'}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

const CONTACT_LABELS: [keyof ContactFields, string][] = [
  ['phone', '연락처'],
  ['email', '이메일'],
  ['address', '주소'],
  ['emergencyContact', '비상연락처'],
]

/** 연락처: 읽기 모드 ↔ 편집 모드. 즉시 반영, 승인·이력 없음 (판단 4) */
function ContactCard({ profile, onSaved }: { profile: MyProfile; onSaved: (p: MyProfile) => void }) {
  const [editing, setEditing] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>연락처</CardTitle>
        <CardDescription>저장하면 바로 반영돼요.</CardDescription>
        {!editing && (
          <CardAction>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              수정하기
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <ContactForm
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={(p) => {
              onSaved(p)
              setEditing(false)
              toast.success('연락처를 저장했어요.')
            }}
          />
        ) : (
          <InfoList items={CONTACT_LABELS.map(([key, label]) => [label, profile[key] || '-'])} />
        )}
      </CardContent>
    </Card>
  )
}

function ContactForm({ profile, onCancel, onSaved }: { profile: MyProfile; onCancel: () => void; onSaved: (p: MyProfile) => void }) {
  // 입력창은 빈 문자열로 다룬다(서버 null → '')
  const [form, setForm] = useState<Record<keyof ContactFields, string>>({
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    address: profile.address ?? '',
    emergencyContact: profile.emergencyContact ?? '',
  })
  const { error, submitting, submit } = useSubmit()

  const set = (key: keyof ContactFields) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // 빈칸은 빈 문자열로 보내야 지워진다(null 은 "바꾸지 않음")
    const req: UpdateMyProfileRequest = {
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      emergencyContact: form.emergencyContact.trim(),
    }
    void submit(async () => onSaved(await api.updateMyProfile(req)))
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="연락처" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="이메일" type="email" value={form.email} onChange={set('email')} />
      </div>
      <Field label="주소" value={form.address} onChange={set('address')} />
      <Field label="비상연락처" value={form.emergencyContact} onChange={set('emergencyContact')} hint="이름과 관계, 전화번호를 함께 적어 주세요." />
      {error && <InlineError>{error}</InlineError>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden />}
          저장하기
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          취소하기
        </Button>
      </div>
    </form>
  )
}
