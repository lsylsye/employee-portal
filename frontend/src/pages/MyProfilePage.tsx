import { Loader2, Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { api, type ContactFields, type MyProfile } from '@/api'
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

        {/* 판단 (3) b안: 조회 일자와 진행 상태만 보여 준다 */}
        <Card>
          <CardHeader>
            <CardTitle>신원 조회 내역</CardTitle>
            <CardDescription>조회 결과 내용은 인사 담당자에게 따로 요청할 수 있어요.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.backgroundChecks.length === 0 ? (
              <EmptyState title="신원 조회 내역이 없어요" />
            ) : (
              <ul className="divide-y text-sm">
                {profile.backgroundChecks.map((c) => (
                  <li key={c.requestedAt} className="flex justify-between py-2">
                    <span>{formatKst(c.requestedAt)}</span>
                    <span className="text-muted-foreground">{c.state === 'IN_PROGRESS' ? '진행 중' : '완료'}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/** 연락처: 읽기 모드 ↔ 편집 모드 */
function ContactCard({ profile, onSaved }: { profile: MyProfile; onSaved: (p: MyProfile) => void }) {
  const [editing, setEditing] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>연락처</CardTitle>
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
          <InfoList
            items={[
              ['휴대전화', profile.phone || '-'],
              ['이메일', profile.email || '-'],
              ['주소', profile.address || '-'],
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ContactForm({ profile, onCancel, onSaved }: { profile: MyProfile; onCancel: () => void; onSaved: (p: MyProfile) => void }) {
  const [form, setForm] = useState<ContactFields>({ phone: profile.phone, email: profile.email, address: profile.address })
  const { error, submitting, submit } = useSubmit()

  const set = (key: keyof ContactFields) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit(async () => onSaved(await api.updateMyProfile(form)))
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="휴대전화" value={form.phone} onChange={set('phone')} />
        <Field label="이메일" type="email" value={form.email} onChange={set('email')} />
      </div>
      <Field label="주소" value={form.address} onChange={set('address')} />
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
