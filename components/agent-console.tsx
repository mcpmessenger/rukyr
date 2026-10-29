'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { StatusBadge, formatScheduledTime, timeLeft } from './task-card'
import {
  TASK_TYPE_LABEL,
  usd,
  type Escrow,
  type Proof,
  type Task,
  type TaskType,
  type Bid,
  type OperatorMandate,
} from '@/lib/types'
import type { ExternalGig } from '@/lib/subcontract'
import {
  Plus,
  ShieldCheck,
  Briefcase,
  ListChecks,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

export interface ConsoleItem {
  task: Task
  escrow: Escrow | null
  proof: Proof | null
  bids?: Bid[]
}
export interface ConsoleStats {
  escrowed_cents: number
  released_cents: number
  open: number
}
export interface Prefill {
  title?: string
  description?: string
  task_type?: TaskType
  price_cents?: number
  proof_requirements?: string
}

const TABS = ['all', 'open', 'scheduled', 'claimed', 'submitted', 'paid', 'expired'] as const
const FEE_PCT = 15

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getSchedulePreset(kind: 'tomorrow_7am' | 'tomorrow_8am' | 'monday_8am'): string {
  const d = new Date()
  d.setSeconds(0, 0)
  if (kind === 'tomorrow_7am') {
    d.setDate(d.getDate() + 1)
    d.setHours(7, 0, 0, 0)
  } else if (kind === 'tomorrow_8am') {
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
  } else if (kind === 'monday_8am') {
    const day = d.getDay()
    const daysUntilMonday = (8 - day) % 7 || 7
    d.setDate(d.getDate() + daysUntilMonday)
    d.setHours(8, 0, 0, 0)
  }
  return toDatetimeLocalValue(d)
}

// Put submitted first so tasks waiting on approval always float to the top of All
const STATUS_SORT_ORDER: Record<string, number> = {
  submitted: 0,
  open: 1,
  scheduled: 2,
  claimed: 3,
  pending_funding: 4,
  verified: 5,
  paid: 6,
  expired: 7,
  cancelled: 8,
}

export function AgentConsole({
  items,
  stats,
  prefill,
  flash,
  externalGigs = [],
  initialMandate,
  initialTaskId,
  fetchError = null,
  currentAgentId,
}: {
  items: ConsoleItem[]
  stats: ConsoleStats
  prefill?: Prefill
  flash?: { kind: 'ok' | 'err'; text: string } | null
  externalGigs?: ExternalGig[]
  initialMandate?: OperatorMandate
  initialTaskId?: string
  fetchError?: string | null
  currentAgentId?: string
}) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<'tasks' | 'mandate' | 'gigs'>('tasks')
  const [tab, setTab] = useState<(typeof TABS)[number]>(() => {
    if (initialTaskId) {
      const target = items.find((i) => i.task.id === initialTaskId)
      if (target && ['expired', 'cancelled'].includes(target.task.status)) {
        return 'expired'
      }
    }
    return 'all'
  })
  const [showForm, setShowForm] = useState(Boolean(prefill?.title))
  const [executeAtLocal, setExecuteAtLocal] = useState('')
  const [mandate, setMandate] = useState<OperatorMandate | undefined>(initialMandate)
  const [selected, setSelected] = useState<string | null>(() => {
    if (initialTaskId && items.some((i) => i.task.id === initialTaskId)) {
      return initialTaskId
    }
    const waiting = items.find((i) => i.task.status === 'submitted')
    if (waiting) return waiting.task.id
    return (
      items.find((i) => !['expired', 'cancelled'].includes(i.task.status))?.task.id ??
      items[0]?.task.id ??
      null
    )
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(flash ?? null)

  // Mark this browser as an active operator session so /earn/tasks/[id] can default to the Owner Bar
  useEffect(() => {
    try {
      window.localStorage.setItem('rukyr_operator_session', '1')
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    if (initialMandate) setMandate(initialMandate)
  }, [initialMandate])

  // Deep-link support: when ?task=<id> is provided, select it and scroll into view
  useEffect(() => {
    if (!initialTaskId) return
    const target = items.find((i) => i.task.id === initialTaskId)
    if (!target) return
    setActiveView('tasks')
    if (['expired', 'cancelled'].includes(target.task.status)) {
      setTab('expired')
    }
    setSelected(initialTaskId)
    const timer = setTimeout(() => {
      const cardEl =
        target.task.status === 'submitted'
          ? document.getElementById('proof-review-card') ||
            document.getElementById(`task-card-${initialTaskId}`)
          : document.getElementById(`task-card-${initialTaskId}`)
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => clearTimeout(timer)
  }, [initialTaskId, items])

  // Automatically trigger activation when a scheduled task's execute_at arrives
  useEffect(() => {
    const scheduled = items.filter((i) => i.task.status === 'scheduled' && i.task.execute_at)
    if (!scheduled.length) return
    const timer = setInterval(async () => {
      const now = Date.now()
      const hasDue = scheduled.some((i) => i.task.execute_at && Date.parse(i.task.execute_at) <= now)
      if (hasDue) {
        await fetch('/api/tasks/activate').catch(() => null)
        router.refresh()
      }
    }, 10_000)
    return () => clearInterval(timer)
  }, [items, router])

  const submittedItems = items.filter((i) => i.task.status === 'submitted')
  const activeItems = items.filter((i) => !['expired', 'cancelled'].includes(i.task.status))
  const shown = items
    .filter((i) =>
      tab === 'all'
        ? !['expired', 'cancelled'].includes(i.task.status)
        : tab === 'expired'
        ? ['expired', 'cancelled'].includes(i.task.status)
        : i.task.status === tab,
    )
    .sort((a, b) => {
      if (tab === 'all') {
        const wa = STATUS_SORT_ORDER[a.task.status] ?? 9
        const wb = STATUS_SORT_ORDER[b.task.status] ?? 9
        if (wa !== wb) return wa - wb
      }
      if (a.task.status === 'scheduled' && b.task.status === 'scheduled') {
        return (a.task.execute_at ?? '').localeCompare(b.task.execute_at ?? '')
      }
      return b.task.created_at.localeCompare(a.task.created_at)
    })
  const sel = items.find((i) => i.task.id === selected) ?? null

  function focusTaskForReview(taskId: string) {
    setActiveView('tasks')
    setTab('all')
    setSelected(taskId)
    setTimeout(() => {
      const el =
        document.getElementById('proof-review-card') ||
        document.getElementById('task-detail-pane')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  async function act(id: string, action: 'approve' | 'reject' | 'cancel') {
    setBusy(id + action)
    const res = await fetch(`/api/tasks/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, agent_id: currentAgentId }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    setMsg(
      res.ok
        ? {
            kind: 'ok',
            text: {
              approve: 'Approved! PayPal escrow hold captured and earner paid.',
              reject: 'Proof rejected. Task returned to open queue.',
              cancel: 'Task cancelled. PayPal escrow hold voided and weekly mandate pool refunded.',
            }[action],
          }
        : { kind: 'err', text: data.error || `Failed to ${action} task` },
    )
    router.refresh()
  }

  async function acceptBid(taskId: string, bidId: string) {
    setBusy('bid' + bidId)
    const res = await fetch(`/api/tasks/${taskId}/bids/${bidId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error || 'Failed to accept bid' })
      return
    }
    setMsg({
      kind: 'ok',
      text: `Offer accepted! Task assigned to earner at ${usd(data.bid?.bid_cents || 0)}.`,
    })
    router.refresh()
  }

  async function ingestGig(gigId: string) {
    setBusy('gig' + gigId)
    const res = await fetch(`/api/subcontract/jobs/${gigId}/ingest`, {
      method: 'POST',
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error || 'Failed to subcontract gig' })
      return
    }
    setActiveView('tasks')
    setMsg({
      kind: 'ok',
      text: `Subcontracted! Created ${data.result?.created_tasks?.length || 0} micro-tasks with PayPal escrow holds. Agent keeps $${data.result?.agent_margin?.toFixed(2)} net profit.`,
    })
    router.refresh()
  }

  async function toggleVault(action: 'authorize' | 'revoke') {
    setBusy('vault')
    const res = await fetch('/api/vault/mandate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error || 'Failed to update vault mandate' })
      return
    }
    if (data.approveUrl) {
      window.location.href = data.approveUrl
      return
    }
    setMandate(data.mandate)
    setMsg({
      kind: 'ok',
      text:
        action === 'authorize'
          ? 'Mandate authorized via PayPal Vault! Headless 0-click escrow holds are now active.'
          : 'Operator mandate revoked. Autonomous agent spending is now frozen.',
    })
    router.refresh()
  }

  async function post(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const rawExec = String(f.get('execute_at') || '').trim()
    let executeAtIso: string | null = null
    if (rawExec) {
      const parsed = new Date(rawExec)
      if (Number.isNaN(parsed.getTime())) {
        setMsg({ kind: 'err', text: 'Invalid schedule date/time' })
        return
      }
      executeAtIso = parsed.toISOString()
    }
    setBusy('post')
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: f.get('title'),
        description: f.get('description'),
        task_type: f.get('task_type'),
        price_cents: Math.round(Number(f.get('price')) * 100),
        proof_requirements: f.get('proof'),
        deadline_minutes: Number(f.get('deadline')),
        execute_at: executeAtIso,
      }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) return setMsg({ kind: 'err', text: data.error ?? 'Could not post task' })
    if (data.approveUrl) {
      window.location.href = data.approveUrl
      return
    }
    setShowForm(false)
    setExecuteAtLocal('')
    setActiveView('tasks')
    const isScheduled = data.task?.status === 'scheduled' && data.task?.execute_at
    setMsg({
      kind: 'ok',
      text: isScheduled
        ? `Task scheduled for ${formatScheduledTime(data.task.execute_at)}! Escrow hold reserved via PayPal Vault (0 clicks); claim window starts at activation.`
        : data.headless
        ? 'Task posted autonomously! Escrow hold authorized via PayPal Vault token (0 human clicks).'
        : 'Task posted and funds held in escrow.',
    })
    if (data.task?.id) setSelected(data.task.id)
    router.refresh()
  }

  const price = prefill?.price_cents ? prefill.price_cents / 100 : 3
  const inputStyle =
    'w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#cf6a42] dark:focus:border-[#f4a261] transition-colors'

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-4 sm:px-6 lg:px-8">
      {/* P0 #1: Full-width Action Needed Banner when any task has status === 'submitted' */}
      {submittedItems.length > 0 && (
        <div
          role="region"
          aria-label="Action needed: proof waiting for review"
          className="mb-6 rounded-2xl border-2 border-amber-400 dark:border-[#f4a261] bg-amber-50/95 dark:bg-[#2b2116] p-4 sm:p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3">
            {submittedItems.map(({ task, proof }) => (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex size-2.5 shrink-0 rounded-full bg-amber-500 animate-ping" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-200/90 dark:bg-amber-900/70 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-950 dark:text-[#f4a261]">
                        Action Needed • Proof Waiting
                      </span>
                      {proof?.ai_verdict && (
                        <span className="font-mono text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                          AI Verdict: {proof.ai_verdict.toUpperCase()} (
                          {Math.round((proof.ai_confidence ?? 0) * 100)}%)
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm sm:text-base font-bold text-neutral-950 dark:text-neutral-50">
                      Proof submitted on &ldquo;{task.title}&rdquo; &mdash; review and release{' '}
                      <span className="font-mono text-[#cf6a42] dark:text-[#f4a261]">
                        {usd(task.price_cents)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => focusTaskForReview(task.id)}
                    className="rounded-full border border-amber-400 dark:border-amber-700 bg-white dark:bg-[#1a1918] px-4 py-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:bg-amber-100/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Review Proof
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => act(task.id, 'approve')}
                    className="rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs cursor-pointer"
                  >
                    {busy === task.id + 'approve'
                      ? 'Releasing…'
                      : `Approve & Release ${usd(task.price_cents)}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Header Row */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Agent Console
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Authenticated agent session:{' '}
            <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">
              glazyr-shopper-01
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] shadow-xs transition-all hover:opacity-90 active:scale-95 cursor-pointer"
          >
            <Plus className="size-4" />
            {showForm ? 'Close Form' : 'Post Task'}
          </button>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Escrowed
          </p>
          <p className="mt-1 font-mono text-lg sm:text-2xl font-bold text-[#cf6a42] dark:text-[#f4a261]">
            {usd(stats.escrowed_cents)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Released
          </p>
          <p className="mt-1 font-mono text-lg sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {usd(stats.released_cents)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Open Tasks
          </p>
          <p className="mt-1 font-mono text-lg sm:text-2xl font-bold text-emerald-600 dark:text-[#8bd3a8]">
            {stats.open}
          </p>
        </div>
      </div>

      {/* Flash Messages */}
      {msg && (
        <div
          role="status"
          className={`mb-6 flex items-start gap-2.5 rounded-2xl border p-4 text-xs sm:text-sm ${
            msg.kind === 'ok'
              ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-[#1d2b22] text-emerald-900 dark:text-[#8bd3a8]'
              : 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-[#331d1d] text-red-900 dark:text-[#f08f8f]'
          }`}
        >
          {msg.kind === 'ok' ? (
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Post Task Collapsible Drawer / Form */}
      {showForm && (
        <form
          onSubmit={post}
          className="mb-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#1a1918] p-5 sm:p-6 shadow-md transition-all animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Create New Micro-Task
            </h2>
            <span className="font-mono text-xs text-neutral-500">
              Headless Escrow via Vault
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2 block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Task Title
              <input
                name="title"
                required
                minLength={3}
                maxLength={140}
                defaultValue={prefill?.title}
                placeholder="e.g. Inspect collar tag stitching on vintage band tee under daylight"
                className={inputStyle + ' mt-1.5'}
              />
            </label>

            <label className="md:col-span-2 block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Instructions for Human Earner
              <textarea
                name="description"
                rows={3}
                maxLength={1000}
                defaultValue={prefill?.description}
                placeholder="Specific guidance for photography, angles, light conditions, or physical checks..."
                className={inputStyle + ' mt-1.5'}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Task Type
              <select
                name="task_type"
                defaultValue={prefill?.task_type ?? 'verification'}
                className={inputStyle + ' mt-1.5'}
              >
                {Object.entries(TASK_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Proof Requirement
              <select
                name="proof"
                defaultValue={prefill?.proof_requirements ?? 'photo'}
                className={inputStyle + ' mt-1.5'}
              >
                <option value="photo">Photo (AI Vision Verified)</option>
                <option value="text">Written Report / Notes</option>
                <option value="code">Code / Receipt Number</option>
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Price to Human (USD)
              <input
                name="price"
                type="number"
                step="0.25"
                min="0.5"
                max="10"
                defaultValue={price}
                className={inputStyle + ' mt-1.5 font-mono'}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
              Claim Expiration Window
              <select name="deadline" defaultValue="240" className={inputStyle + ' mt-1.5'}>
                <option value="30">30 minutes</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours (recommended)</option>
                <option value="1440">24 hours</option>
              </select>
            </label>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                Execute at (Optional — Schedule for Business Hours)
                <input
                  name="execute_at"
                  type="datetime-local"
                  value={executeAtLocal}
                  onChange={(e) => setExecuteAtLocal(e.target.value)}
                  placeholder="Now"
                  className={inputStyle + ' mt-1.5 font-mono'}
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-neutral-500 mr-1">Quick set:</span>
                <button
                  type="button"
                  onClick={() => setExecuteAtLocal('')}
                  className={`rounded-full px-2.5 py-0.5 font-mono transition-colors ${
                    !executeAtLocal
                      ? 'bg-neutral-900 text-white dark:bg-[#f4a261] dark:text-[#171412] font-semibold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  Now (Immediate)
                </button>
                <button
                  type="button"
                  onClick={() => setExecuteAtLocal(getSchedulePreset('tomorrow_7am'))}
                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 font-mono text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Tomorrow 7:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setExecuteAtLocal(getSchedulePreset('tomorrow_8am'))}
                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 font-mono text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Tomorrow 8:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setExecuteAtLocal(getSchedulePreset('monday_8am'))}
                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 font-mono text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Monday 8:00 AM
                </button>
              </div>
            </div>

            <div className="md:col-span-2 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-4">
              <p className="text-xs text-neutral-500">
                A {FEE_PCT}% platform fee is held in PayPal escrow at post time. Scheduled tasks open at the chosen time and start their claim window on activation.
              </p>
              <button
                disabled={busy === 'post'}
                className="w-full sm:w-auto rounded-full bg-neutral-900 dark:bg-[#f4a261] px-6 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 transition-opacity hover:opacity-90 shadow-xs"
              >
                {busy === 'post'
                  ? 'Authorizing Hold…'
                  : executeAtLocal
                  ? 'Schedule & Reserve Escrow'
                  : 'Post & Authorize Escrow'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Scandinavian Segmented View Navigation */}
      <div className="mb-6 flex border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar gap-1">
        <button
          type="button"
          onClick={() => setActiveView('tasks')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'tasks'
              ? 'border-[#cf6a42] dark:border-[#f4a261] text-neutral-950 dark:text-neutral-50 font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <ListChecks className="size-4" />
          <span>Tasks & Verification</span>
          <span className="rounded-full bg-neutral-200/80 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-mono">
            {activeItems.length}
          </span>
          {submittedItems.length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-mono font-bold text-white animate-pulse">
              {submittedItems.length} waiting
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('mandate')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'mandate'
              ? 'border-[#cf6a42] dark:border-[#f4a261] text-neutral-950 dark:text-neutral-50 font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="size-4" />
          <span>Operator Mandate & Vault v3</span>
          {mandate && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${
                mandate.vault_status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-[#8bd3a8]'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-[#f4a261]'
              }`}
            >
              {mandate.vault_status === 'active' ? 'Active' : 'Consent'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('gigs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'gigs'
              ? 'border-[#cf6a42] dark:border-[#f4a261] text-neutral-950 dark:text-neutral-50 font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Briefcase className="size-4" />
          <span>Gig Bridge (Upwork)</span>
          <span className="rounded-full bg-neutral-200/80 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-mono">
            {externalGigs.length}
          </span>
        </button>
      </div>

      {/* VIEW 1: TASKS & VERIFICATION */}
      {activeView === 'tasks' && (
        <div>
          {/* Status Filter Chips */}
          <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
            {TABS.map((t) => {
              const count = items.filter((i) =>
                t === 'all'
                  ? !['expired', 'cancelled'].includes(i.task.status)
                  : t === 'expired'
                  ? ['expired', 'cancelled'].includes(i.task.status)
                  : i.task.status === t,
              ).length
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1 text-xs capitalize transition-all ${
                    tab === t
                      ? 'bg-neutral-900 dark:bg-[#f4a261] text-white dark:text-[#171412] font-medium shadow-2xs'
                      : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {t === 'expired' ? 'cancelled/expired' : t} ({count})
                </button>
              )
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            {/* Task Cards List */}
            <div className="flex flex-col gap-3">
              {fetchError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-300 dark:border-red-900/70 bg-red-50/80 dark:bg-[#2a1717] p-8 text-center"
                >
                  <AlertCircle className="mx-auto size-6 text-red-600 dark:text-[#f08f8f]" />
                  <p className="mt-2 text-sm font-semibold text-red-900 dark:text-[#f08f8f]">
                    Couldn&apos;t load tasks &mdash; retry
                  </p>
                  <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80 font-mono">
                    {fetchError}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    Retry loading tasks
                  </button>
                </div>
              ) : shown.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 text-center text-sm text-neutral-500">
                  No tasks found in this filter.
                </div>
              ) : (
                shown.map(({ task, bids = [] }) => {
                  const pendingBids = bids.filter((b) => b.status === 'pending')
                  const isSel = selected === task.id
                  const isMine = !currentAgentId || task.agent_id === currentAgentId
                  const canCancel = isMine && ['scheduled', 'open', 'claimed', 'submitted'].includes(task.status)

                  return (
                    <div
                      key={task.id}
                      id={`task-card-${task.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(task.id)
                        }
                      }}
                      className={`rounded-2xl border p-4 sm:p-5 text-left transition-all cursor-pointer ${
                        task.status === 'submitted'
                          ? 'border-amber-400 dark:border-[#f4a261] ring-1 ring-amber-400/40 dark:ring-[#f4a261]/40 bg-amber-50/30 dark:bg-[#221d17]'
                          : isSel
                          ? 'border-[#cf6a42] dark:border-[#f4a261] ring-1 ring-[#cf6a42]/30 dark:ring-[#f4a261]/30 bg-white dark:bg-[#1d1c1a] shadow-xs'
                          : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-[#1a1918]/80 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
                              {TASK_TYPE_LABEL[task.task_type]}
                            </p>
                            {!isMine && (
                              <span className="rounded bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600 dark:text-neutral-400">
                                External Agent
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                            {task.title}
                          </p>
                        </div>
                        <span className="font-mono text-base sm:text-lg font-bold text-[#cf6a42] dark:text-[#f4a261] shrink-0">
                          {usd(task.price_cents)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="font-mono">
                          {task.status === 'scheduled'
                            ? `${Math.round((task.deadline_minutes ?? 240) / 60)}h claim window on open`
                            : timeLeft(task.deadline_at)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {task.status === 'submitted' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 dark:bg-amber-500/25 border border-amber-500/50 text-amber-900 dark:text-[#f4a261] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide animate-pulse">
                              ● PROOF WAITING
                            </span>
                          )}
                          {pendingBids.length > 0 && task.status === 'open' && (
                            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-[#f4a261] px-2 py-0.5 text-[10px] font-medium">
                              {pendingBids.length} offer{pendingBids.length > 1 ? 's' : ''}
                            </span>
                          )}
                          <StatusBadge status={task.status} executeAt={task.execute_at} />
                        </div>
                      </div>

                      {/* Card-level Action Row: Direct Approve & Release for submitted tasks + Secondary Cancel button */}
                      {(task.status === 'submitted' || canCancel) && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/80 dark:border-neutral-800/80 pt-3"
                        >
                          {task.status === 'submitted' && isMine ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={!!busy}
                                onClick={() => act(task.id, 'approve')}
                                className="rounded-full bg-neutral-900 dark:bg-[#f4a261] px-3.5 py-1.5 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-2xs cursor-pointer"
                              >
                                {busy === task.id + 'approve'
                                  ? 'Releasing…'
                                  : `Approve & Release ${usd(task.price_cents)}`}
                              </button>
                              <button
                                type="button"
                                disabled={!!busy}
                                onClick={() => act(task.id, 'reject')}
                                className="rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span />
                          )}

                          {canCancel && (
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => act(task.id, 'cancel')}
                              className="rounded-full border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 px-3 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:border-red-300 hover:text-red-600 dark:hover:border-red-800 dark:hover:text-red-400 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {busy === task.id + 'cancel' ? 'Cancelling…' : 'Cancel task'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Selected Task Detail / Proof Review Pane */}
            <aside
              id="task-detail-pane"
              className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 sm:p-6 shadow-xs lg:sticky lg:top-24 lg:self-start"
            >
              {!sel ? (
                <div className="py-12 text-center text-sm text-neutral-500">
                  Select a task from the list to review timeline, earner offers, and submitted proofs.
                </div>
              ) : (
                <TaskDetail
                  item={sel}
                  busy={busy}
                  isMine={!currentAgentId || sel.task.agent_id === currentAgentId}
                  onAct={act}
                  onAcceptBid={(bidId) => acceptBid(sel.task.id, bidId)}
                />
              )}
            </aside>
          </div>
        </div>
      )}

      {/* VIEW 2: OPERATOR MANDATE & PAYPAL VAULT */}
      {activeView === 'mandate' && mandate && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span
                  className={`size-2.5 rounded-full ${
                    mandate.vault_status === 'active'
                      ? 'bg-emerald-500 animate-pulse'
                      : mandate.vault_status === 'pending_approval'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-neutral-400'
                  }`}
                />
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  PayPal Vault v3 • Unscheduled MIT
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    mandate.vault_status === 'active'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-[#8bd3a8]'
                      : mandate.vault_status === 'pending_approval'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-[#f4a261]'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {mandate.vault_status === 'active'
                    ? 'Vault Active (0 Clicks)'
                    : mandate.vault_status === 'pending_approval'
                    ? 'Awaiting Operator Approval'
                    : 'Manual Consent Required'}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Autonomous Budget Mandate
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-xl">
                Allows autonomous agents to place PayPal authorization holds headlessly without human-in-the-loop click friction, strictly within weekly and per-task boundaries.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {mandate.vault_status === 'active' ? (
                <button
                  type="button"
                  disabled={busy === 'vault'}
                  onClick={() => toggleVault('revoke')}
                  className="rounded-full border border-red-300 dark:border-red-900/60 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                >
                  {busy === 'vault' ? 'Freezing…' : 'Revoke Vault Token'}
                </button>
              ) : mandate.vault_status === 'pending_approval' ? (
                <button
                  type="button"
                  disabled={busy === 'vault'}
                  onClick={() => toggleVault('authorize')}
                  className="rounded-full bg-[#cf6a42] dark:bg-[#f4a261] px-5 py-2 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs"
                >
                  {busy === 'vault' ? 'Redirecting…' : 'Resume PayPal Consent'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === 'vault'}
                  onClick={() => toggleVault('authorize')}
                  className="rounded-full bg-neutral-900 dark:bg-[#f4a261] px-5 py-2 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs"
                >
                  {busy === 'vault' ? 'Authorizing…' : 'Authorize One-Time Mandate'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div
              title="Spend counts against the weekly pool of the week a task is posted in (when escrow is reserved). Cancelling a task voids the hold and refunds the pool."
              className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161514] p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Weekly Spend Pool
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {usd(mandate.spent_this_week_cents)}{' '}
                <span className="text-sm font-normal text-neutral-400">/ {usd(mandate.weekly_cap_cents)}</span>
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-[#cf6a42] dark:bg-[#f4a261] rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (mandate.spent_this_week_cents / mandate.weekly_cap_cents) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-neutral-500 leading-normal">
                Charged when posted (including scheduled tasks); refunded if cancelled.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161514] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Per-Task Cap
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {usd(mandate.per_task_cap_cents)}{' '}
                <span className="text-xs font-normal text-neutral-400">max per micro-task</span>
              </p>
              <p className="mt-2 text-xs text-neutral-500 leading-normal">
                Tasks $\le$ {usd(mandate.per_task_cap_cents)} authorize headlessly (0 human clicks).
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161514] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Autonomy Mode
              </p>
              <p className="mt-1 font-mono text-xs font-semibold">
                {mandate.vault_status === 'active' ? (
                  <span className="text-emerald-700 dark:text-[#8bd3a8]">● Headless MIT Active (0 Clicks)</span>
                ) : mandate.vault_status === 'pending_approval' ? (
                  <span className="text-amber-700 dark:text-[#f4a261]">◌ Pending Operator Consent</span>
                ) : (
                  <span className="text-neutral-500">○ Redirect Required</span>
                )}
              </p>
              <p className="mt-2 text-xs font-mono text-neutral-400 truncate">
                Token: {mandate.vault_id ? `${mandate.vault_id.slice(0, 18)}…` : 'None'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: GIG BRIDGE & SUBCONTRACTOR */}
      {activeView === 'gigs' && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-6 sm:p-8 shadow-xs">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-5">
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-amber-900 dark:text-[#f4a261]">
              Autonomous Gig Arbitrage
            </span>
            <h2 className="mt-2 text-xl font-bold text-neutral-900 dark:text-neutral-100">
              External Client Contract Bridge
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
              Autonomous agents discover high-value client contracts (e.g. from Upwork or B2B procurement), decompose them into real-world micro-tasks with PayPal escrow, and capture the remaining analytical margin.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {externalGigs.map((g) => {
              const totalPayout = g.subtasks.reduce((sum, s) => sum + s.suggested_price_dollars, 0)
              const margin = g.client_budget_usd - totalPayout
              return (
                <div
                  key={g.id}
                  className="flex flex-col justify-between rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-5 transition-all hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono uppercase font-semibold text-neutral-500">
                        {g.source.toUpperCase()} • {g.posted_time}
                      </span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-[#8bd3a8]">
                        ${g.client_budget_usd.toFixed(2)} Client Budget
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                      {g.title}
                    </h3>
                    <p className="mt-2 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                      {g.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {g.subtasks.map((st, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-neutral-200/70 dark:bg-neutral-800 px-2.5 py-1 text-[10px] font-mono text-neutral-700 dark:text-neutral-300"
                        >
                          {st.title.slice(0, 32)}… (${st.suggested_price_dollars})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-neutral-200 dark:border-neutral-800/80 pt-3 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-neutral-500">Earner Cost: </span>
                      <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                        ${totalPayout.toFixed(2)}
                      </span>
                      <span className="ml-2 font-mono font-semibold text-emerald-700 dark:text-[#8bd3a8]">
                        (+${margin.toFixed(2)} Margin)
                      </span>
                    </div>
                    <button
                      disabled={busy === 'gig' + g.id}
                      onClick={() => ingestGig(g.id)}
                      className="rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-1.5 text-xs font-semibold text-white dark:text-[#171412] disabled:opacity-50 hover:opacity-90 shadow-2xs"
                    >
                      {busy === 'gig' + g.id ? 'Subcontracting…' : 'Subcontract via Rukyr'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskDetail({
  item,
  busy,
  isMine,
  onAct,
  onAcceptBid,
}: {
  item: ConsoleItem
  busy: string | null
  isMine: boolean
  onAct: (id: string, a: 'approve' | 'reject' | 'cancel') => void
  onAcceptBid: (bidId: string) => void
}) {
  const { task, escrow, proof, bids = [] } = item
  const order = ['pending_funding', 'scheduled', 'open', 'claimed', 'submitted', 'paid']
  const reached = order.indexOf(task.status)
  const steps = [['Escrowed', 1], ['Open', 2], ['Claimed', 3], ['Proof submitted', 4], ['Paid', 5]] as const
  const v = proof?.ai_verdict

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {task.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
            <span className="font-mono">{ isMine ? 'Posted by you (glazyr-shopper-01)' : `Agent: ${task.agent_id.slice(0, 8)}…` }</span>
            <span>&middot;</span>
            <Link
              href={`/earn/tasks/${task.id}`}
              className="inline-flex items-center gap-1 underline hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              View task page <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
        <StatusBadge status={task.status} executeAt={task.execute_at} />
      </div>

      {task.description && (
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {task.description}
        </p>
      )}

      {task.status === 'scheduled' && task.execute_at && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/70 dark:bg-[#272033]/70 p-3 text-xs text-purple-900 dark:text-[#c8a8f0]">
          <CalendarClock className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Scheduled to go live {formatScheduledTime(task.execute_at)}
            </p>
            <p className="mt-0.5 text-[11px] opacity-85">
              PayPal escrow is already held. Hidden from /earn until activation, when the full{' '}
              {Math.round((task.deadline_minutes ?? 240) / 60)}-hour claim window begins.
            </p>
          </div>
        </div>
      )}

      {task.status_reason && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-[#331d1d] p-3 text-xs text-red-900 dark:text-[#f08f8f]">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{task.status_reason}</span>
        </div>
      )}

      {/* Progress Timeline */}
      <ol className="mt-4 flex flex-wrap gap-3 sm:gap-4 text-xs font-mono border-y border-neutral-200 dark:border-neutral-800 py-3">
        {steps.map(([label, idx]) => (
          <li
            key={label}
            className={`flex items-center gap-1 ${
              reached >= idx
                ? 'text-emerald-700 dark:text-[#8bd3a8] font-semibold'
                : 'text-neutral-400 dark:text-neutral-600'
            }`}
          >
            <span>{reached >= idx ? '●' : '○'}</span> {label}
          </li>
        ))}
      </ol>

      {escrow && (
        <div className="mt-3 font-mono text-[11px] text-neutral-500 space-y-0.5">
          <p>
            PayPal Escrow: <strong className="text-neutral-700 dark:text-neutral-300">{usd(escrow.amount_cents)}</strong> (Fee {usd(escrow.platform_fee_cents)})
          </p>
          <p className="truncate">Order Ref: {escrow.paypal_order_id}</p>
        </div>
      )}

      {/* Bids & Reverse Auction Section */}
      {bids.length > 0 && (
        <div className="mt-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
            Earner Offers & Bids ({bids.length})
          </p>
          <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {bids.map((b) => (
              <div key={b.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#cf6a42] dark:text-[#f4a261]">
                      {usd(b.bid_cents)}
                    </span>
                    <span className="text-neutral-500">ETA: {b.eta_minutes}m</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase font-semibold ${
                        b.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-[#1d2b22] dark:text-[#8bd3a8]'
                          : b.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-[#331d1d] dark:text-[#f08f8f]'
                          : 'bg-amber-100 text-amber-800 dark:bg-[#2c2a20] dark:text-[#e6d37a]'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  {b.pitch && <p className="mt-1 text-neutral-600 dark:text-neutral-400">{b.pitch}</p>}
                </div>
                {task.status === 'open' && b.status === 'pending' && isMine && (
                  <button
                    disabled={!!busy}
                    onClick={() => onAcceptBid(b.id)}
                    className="shrink-0 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-3 py-1 text-xs font-semibold text-white dark:text-[#171412] disabled:opacity-50 hover:opacity-90 shadow-2xs"
                  >
                    {busy === 'bid' + b.id ? 'Accepting…' : 'Accept Offer'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P0: Submitted Proof & Decision Card — always renders when status === 'submitted' even if proof is null */}
      {(task.status === 'submitted' || proof) && (
        <div
          id="proof-review-card"
          className="mt-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-4"
        >
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
            Submitted Proof
          </p>

          {proof ? (
            <>
              {proof.proof_image_url && (
                <div className="relative mt-2.5 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-black/5">
                  <Image
                    src={proof.proof_image_url}
                    alt="Proof submitted by earner"
                    width={600}
                    height={400}
                    unoptimized
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}
              {proof.proof_text && (
                <p className="mt-3 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 whitespace-pre-wrap">
                  {proof.proof_text}
                </p>
              )}

              {/* AI Pre-Screening Verdict Badge */}
              <div
                className={`mt-3 rounded-xl p-3 text-xs ${
                  v === 'pass'
                    ? 'bg-emerald-50 dark:bg-[#1d2b22] text-emerald-900 dark:text-[#8bd3a8] border border-emerald-200 dark:border-emerald-800/60'
                    : v === 'fail'
                    ? 'bg-red-50 dark:bg-[#331d1d] text-red-900 dark:text-[#f08f8f] border border-red-200 dark:border-red-800/60'
                    : 'bg-amber-50 dark:bg-[#33281c] text-amber-900 dark:text-[#f4a261] border border-amber-200 dark:border-amber-800/60'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>Vision AI Verdict: {(v || 'unsure').toUpperCase()}</span>
                  <span>{Math.round((proof.ai_confidence ?? 0) * 100)}% Confidence</span>
                </div>
                {proof.ai_reasoning && (
                  <p className="mt-1 text-[11px] opacity-85 leading-normal">{proof.ai_reasoning}</p>
                )}
              </div>
            </>
          ) : (
            <div className="mt-2.5 rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-[#33281c] p-3 text-xs text-amber-900 dark:text-[#f4a261]">
              Proof data unavailable &mdash;{' '}
              <Link href={`/earn/tasks/${task.id}`} className="font-semibold underline">
                check the task page
              </Link>{' '}
              or use the controls below to approve or reject directly.
            </div>
          )}

          {task.status === 'submitted' && isMine && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => onAct(task.id, 'approve')}
                className="flex-1 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 transition-opacity hover:opacity-90 shadow-2xs cursor-pointer"
              >
                {busy === task.id + 'approve' ? 'Releasing…' : `Approve & Release ${usd(task.price_cents)}`}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => onAct(task.id, 'reject')}
                className="rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* P1: Real secondary button for Cancel task */}
      {isMine && ['scheduled', 'open', 'claimed', 'submitted'].includes(task.status) && (
        <div className="mt-5 border-t border-neutral-200 dark:border-neutral-800 pt-4">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => onAct(task.id, 'cancel')}
            className="w-full sm:w-auto rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {busy === task.id + 'cancel'
              ? 'Cancelling & releasing hold…'
              : 'Cancel task, release escrow hold & refund weekly pool'}
          </button>
        </div>
      )}
    </div>
  )
}
