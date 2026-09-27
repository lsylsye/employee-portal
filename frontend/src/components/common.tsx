import { CircleAlert, Inbox, Loader2 } from 'lucide-react'
import { type ComponentProps, type MouseEvent, type ReactElement, type ReactNode, useId, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 화면 공통 요소. shadcn/ui(components/ui)를 조합만 하고, 간격은 8pt 배수(2, 4, 6, 8)만 쓴다.

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

/** 라벨 + 입력 + 도움말. 오류는 입력 아래에 인라인으로 */
export function Field({ label, hint, error, ...props }: ComponentProps<typeof Input> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <InlineError>{error}</InlineError>}
    </div>
  )
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

export function Loading() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      불러오고 있어요
    </p>
  )
}

/** 읽기 모드의 항목 목록 */
export function InfoList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * 확인 다이얼로그. 확인 동작이 끝날 때까지 열어 두고, 실패하면 다이얼로그 안에 오류를 보여 준다.
 * trigger 는 버튼 하나여야 한다(asChild).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger: ReactElement
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  /** 실패하면 오류 메시지를 담아 throw 한다 */
  onConfirm: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(e: MouseEvent) {
    // 기본 동작(바로 닫기)을 막고, 요청이 끝난 뒤에 닫는다
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리하지 못했어요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <InlineError>{error}</InlineError>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소하기</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={pending}
            className={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
