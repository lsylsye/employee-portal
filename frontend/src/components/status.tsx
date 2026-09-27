import { Ban, CircleCheck, CircleHelp, CircleMinus, CircleX, Clock, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { BgStatus, EmploymentStatus } from '@/api'
import { Badge } from '@/components/ui/badge'

// 상태 배지 규칙 (README 디자인 섹션 표와 같게 유지한다)
// - 색만으로 구분하지 않는다: 항상 글자 + 아이콘 (색각 이상 사용자 고려)
// - 주황은 검토 필요(FLAGGED)와 퇴사 예정에만. 빨강은 시스템 오류(결과 미확인·요청 실패)에만. 사람에 대한 판정(FLAGGED)은 주황으로 둬서 화면이 인사 판단을 앞서가지 않게 한다

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

// 옅은 배경 + 진한 글자(4.5:1) + 아이콘(3:1). 클래스 이름을 문자열 그대로 둬야 Tailwind 가 찾는다
const toneClass: Record<Tone, { badge: string; icon: string }> = {
  success: { badge: 'bg-status-success-bg text-status-success-fg', icon: 'text-status-success-icon' },
  info: { badge: 'bg-status-info-bg text-status-info-fg', icon: 'text-status-info-icon' },
  warning: { badge: 'bg-status-warning-bg text-status-warning-fg', icon: 'text-status-warning-icon' },
  danger: { badge: 'bg-status-danger-bg text-status-danger-fg', icon: 'text-status-danger-icon' },
  neutral: { badge: 'bg-status-neutral-bg text-status-neutral-fg', icon: 'text-status-neutral-icon' },
}

function StatusBadge({ tone, icon: Icon, spin = false, children }: { tone: Tone; icon: LucideIcon; spin?: boolean; children: string }) {
  return (
    <Badge variant="outline" className={`border-transparent ${toneClass[tone].badge}`}>
      <Icon data-icon="inline-start" aria-hidden className={`${toneClass[tone].icon} ${spin ? 'animate-spin' : ''}`} />
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
    case 'BLOCK_SCHEDULED':
      return (
        <StatusBadge tone="warning" icon={Clock}>
          퇴사 예정
        </StatusBadge>
      )
    case 'BLOCKED':
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
    case 'PENDING':
      return (
        <StatusBadge tone="info" icon={Loader2} spin>
          조회 중
        </StatusBadge>
      )
    case 'CLEAR':
      return (
        <StatusBadge tone="success" icon={CircleCheck}>
          이상 없음
        </StatusBadge>
      )
    case 'FLAGGED':
      return (
        <StatusBadge tone="warning" icon={TriangleAlert}>
          검토 필요
        </StatusBadge>
      )
    case 'UNRESOLVED':
      return (
        <StatusBadge tone="danger" icon={CircleHelp}>
          결과 미확인
        </StatusBadge>
      )
    case 'FAILED':
      return (
        <StatusBadge tone="danger" icon={CircleX}>
          요청 실패
        </StatusBadge>
      )
  }
}
