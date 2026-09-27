import { Ban, CircleCheck, CircleMinus, CircleX, Clock, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { BgStatus, EmploymentStatus } from '@/api'
import { Badge } from '@/components/ui/badge'

// 상태 배지 규칙 (README 디자인 섹션 표와 같게 유지한다)
// - 색만으로 구분하지 않는다: 항상 글자 + 아이콘 (색각 이상 사용자 고려)
// - 빨강은 시스템 오류에만. 사람에 대한 판정(flagged)은 주황으로 둬서 화면이 인사 판단을 앞서가지 않게 한다

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

const toneClass: Record<Tone, string> = {
  success: 'bg-status-success/10 text-status-success',
  info: 'bg-status-info/10 text-status-info',
  warning: 'bg-status-warning/10 text-status-warning',
  danger: 'bg-status-danger/10 text-status-danger',
  neutral: 'bg-status-neutral/10 text-status-neutral',
}

function StatusBadge({ tone, icon: Icon, spin = false, children }: { tone: Tone; icon: LucideIcon; spin?: boolean; children: string }) {
  return (
    <Badge variant="outline" className={`border-transparent ${toneClass[tone]}`}>
      <Icon data-icon="inline-start" aria-hidden className={spin ? 'animate-spin' : undefined} />
      {children}
    </Badge>
  )
}

export function EmploymentBadge({ status }: { status: EmploymentStatus }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <StatusBadge tone="success" icon={CircleCheck}>
          재직
        </StatusBadge>
      )
    case 'RESIGN_SCHEDULED':
      return (
        <StatusBadge tone="warning" icon={Clock}>
          퇴사 예정
        </StatusBadge>
      )
    case 'RESIGNED':
      return (
        <StatusBadge tone="neutral" icon={Ban}>
          퇴사
        </StatusBadge>
      )
  }
}

export function BgBadge({ status }: { status: BgStatus | null }) {
  switch (status) {
    case null:
      return (
        <StatusBadge tone="neutral" icon={CircleMinus}>
          조회 안 함
        </StatusBadge>
      )
    case 'pending':
      return (
        <StatusBadge tone="info" icon={Loader2} spin>
          조회 중
        </StatusBadge>
      )
    case 'clear':
      return (
        <StatusBadge tone="success" icon={CircleCheck}>
          이상 없음
        </StatusBadge>
      )
    case 'flagged':
      return (
        <StatusBadge tone="warning" icon={TriangleAlert}>
          검토 필요
        </StatusBadge>
      )
    case 'needs_attention':
      return (
        <StatusBadge tone="danger" icon={CircleX}>
          추적 실패
        </StatusBadge>
      )
  }
}
