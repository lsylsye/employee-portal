import type { BgStatus, EmploymentStatus } from '../api'
import { Badge } from './ui'

export function EmploymentBadge({ status }: { status: EmploymentStatus }) {
  switch (status) {
    case 'ACTIVE':
      return <Badge tone="green">재직</Badge>
    case 'RESIGN_SCHEDULED':
      return <Badge tone="yellow">퇴사 예정</Badge>
    case 'RESIGNED':
      return <Badge tone="gray">퇴사</Badge>
  }
}

export function BgBadge({ status }: { status: BgStatus | null }) {
  switch (status) {
    case null:
      return <span className="text-xs text-gray-400">없음</span>
    case 'pending':
      return <Badge tone="blue">진행 중</Badge>
    case 'clear':
      return <Badge tone="green">이상 없음</Badge>
    case 'flagged':
      return <Badge tone="red">검토 필요</Badge>
    case 'needs_attention':
      return <Badge tone="yellow">확인 필요</Badge>
  }
}
