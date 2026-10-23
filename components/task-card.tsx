import Link from 'next/link'
import { ChevronRight, Clock3 } from 'lucide-react'
import { TASK_TYPE_LABEL, usd, type Task } from '@/lib/types'

export function timeLeft(deadline: string | null): string {
  if (!deadline) return 'No deadline'
  const ms = Date.parse(deadline) - Date.now()
  if (ms <= 0) return 'Expired'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m left`
  const h = Math.floor(m / 60)
  return h < 48 ? `${h}h left` : `${Math.floor(h / 24)}d left`
}

export function formatScheduledTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_STYLE: Record<string, string> = {
  pending_funding: 'bg-amber-100/80 text-amber-900 dark:bg-[#2c2a20] dark:text-[#e6d37a]',
  scheduled: 'bg-purple-100/80 text-purple-900 dark:bg-[#272033] dark:text-[#c8a8f0]',
  open: 'bg-emerald-100/80 text-emerald-800 dark:bg-[#1d2b22] dark:text-[#8bd3a8]',
  claimed: 'bg-blue-100/80 text-blue-800 dark:bg-[#1f2736] dark:text-[#8fb4f0]',
  submitted: 'bg-orange-100/80 text-orange-900 dark:bg-[#33281c] dark:text-[#f4a261]',
  verified: 'bg-emerald-100/80 text-emerald-800 dark:bg-[#1d2b22] dark:text-[#8bd3a8]',
  paid: 'bg-emerald-100/80 text-emerald-800 dark:bg-[#1d2b22] dark:text-[#8bd3a8]',
  cancelled: 'bg-neutral-200/70 text-neutral-600 dark:bg-[#2a2a2a] dark:text-[#888]',
  expired: 'bg-neutral-200/70 text-neutral-600 dark:bg-[#2a2a2a] dark:text-[#888]',
}

export function StatusBadge({ status, executeAt }: { status: string; executeAt?: string | null }) {
  const label =
    status === 'scheduled' && executeAt
      ? `Scheduled — opens ${formatScheduledTime(executeAt)}`
      : status.replace('_', ' ')
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
        STATUS_STYLE[status] ?? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
      }`}
    >
      {label}
    </span>
  )
}

export function TaskCard({
  task,
  href,
  showStatus,
}: {
  task: Task
  href: string
  showStatus?: boolean
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 shadow-xs transition-all hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold tracking-[.14em] uppercase text-neutral-500 dark:text-neutral-400">
            {TASK_TYPE_LABEL[task.task_type]}
          </span>
          <h3 className="mt-1.5 font-medium leading-snug text-neutral-900 dark:text-neutral-100 group-hover:text-[#cf6a42] dark:group-hover:text-[#f4a261] transition-colors">
            {task.title}
          </h3>
        </div>
        <span className="font-mono text-lg font-semibold text-[#cf6a42] dark:text-[#f4a261] shrink-0">
          {usd(task.price_cents)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5 font-mono">
          <Clock3 aria-hidden="true" className="size-3.5 opacity-70" /> {timeLeft(task.deadline_at)}
        </span>
        <div className="flex items-center gap-2.5">
          {showStatus && <StatusBadge status={task.status} />}
          <span className="flex items-center gap-0.5 font-medium text-neutral-700 dark:text-neutral-300 group-hover:translate-x-0.5 transition-transform">
            View <ChevronRight aria-hidden="true" className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
