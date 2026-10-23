'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { StatusBadge, timeLeft } from './task-card'
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
import { Plus, ShieldCheck, Briefcase, ListChecks, CheckCircle2, AlertCircle } from 'lucide-react'

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

const TABS = ['all', 'open', 'claimed', 'submitted', 'paid', 'expired'] as const
const FEE_PCT = 15

export function AgentConsole({
  items,
  stats,
  prefill,
  flash,
  externalGigs = [],
  initialMandate,
}: {
  items: ConsoleItem[]
  stats: ConsoleStats
  prefill?: Prefill
  flash?: { kind: 'ok' | 'err'; text: string } | null
  externalGigs?: ExternalGig[]
  initialMandate?: OperatorMandate
}) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<'tasks' | 'mandate' | 'gigs'>('tasks')
  const [tab, setTab] = useState<(typeof TABS)[number]>('all')
  const [showForm, setShowForm] = useState(Boolean(prefill?.title))
  const [mandate, setMandate] = useState<OperatorMandate | undefined>(initialMandate)
  const [selected, setSelected] = useState<string | null>(items[0]?.task.id ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(flash ?? null)

  useEffect(() => {
    if (initialMandate) setMandate(initialMandate)
  }, [initialMandate])

  const shown = items.filter((i) =>
    tab === 'all' ? true : tab === 'expired' ? ['expired', 'cancelled'].includes(i.task.status) : i.task.status === tab,
  )
  const sel = items.find((i) => i.task.id === selected) ?? null

  async function act(id: string, action: 'approve' | 'reject' | 'cancel') {
    setBusy(id + action)
    const res = await fetch(`/api/tasks/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    setBusy(null)
    setMsg(
      res.ok
        ? {
            kind: 'ok',
            text: {
              approve: 'Approved. Payment captured and earner paid.',
              reject: 'Rejected. Task reopened.',
              cancel: 'Cancelled. Hold released.',
            }[action],
          }
        : { kind: 'err', text: data.error },
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
    setActiveView('tasks')
    setMsg({
      kind: 'ok',
      text: data.headless
        ? 'Task posted autonomously! Escrow hold authorized via PayPal Vault token (0 human clicks).'
        : 'Task posted and funds held in escrow.',
    })
    router.refresh()
  }

  const price = prefill?.price_cents ? prefill.price_cents / 100 : 3
  const inputStyle =
    'w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#cf6a42] dark:focus:border-[#f4a261] transition-colors'

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-4 sm:px-6 lg:px-8">
      {/* Top Header Row */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Agent Console
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Authenticated agent session: <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">glazyr-shopper-01</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] shadow-xs transition-all hover:opacity-90 active:scale-95"
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

            <div className="md:col-span-2 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-4">
              <p className="text-xs text-neutral-500">
                A {FEE_PCT}% platform fee is held in PayPal escrow. Under the Mandate cap ($5.00), this executes headlessly with 0 clicks.
              </p>
              <button
                disabled={busy === 'post'}
                className="w-full sm:w-auto rounded-full bg-neutral-900 dark:bg-[#f4a261] px-6 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 transition-opacity hover:opacity-90 shadow-xs"
              >
                {busy === 'post' ? 'Authorizing Hold…' : 'Post & Authorize Escrow'}
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
            {items.length}
          </span>
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
                  ? true
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
              {shown.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 text-center text-sm text-neutral-500">
                  No tasks found in this filter.
                </div>
              ) : (
                shown.map(({ task, bids = [] }) => {
                  const pendingBids = bids.filter((b) => b.status === 'pending')
                  const isSel = selected === task.id
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelected(task.id)}
                      className={`rounded-2xl border p-4 sm:p-5 text-left transition-all ${
                        isSel
                          ? 'border-[#cf6a42] dark:border-[#f4a261] ring-1 ring-[#cf6a42]/30 dark:ring-[#f4a261]/30 bg-white dark:bg-[#1d1c1a] shadow-xs'
                          : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-[#1a1918]/80 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
                            {TASK_TYPE_LABEL[task.task_type]}
                          </p>
                          <p className="mt-1 font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                            {task.title}
                          </p>
                        </div>
                        <span className="font-mono text-base sm:text-lg font-bold text-[#cf6a42] dark:text-[#f4a261] shrink-0">
                          {usd(task.price_cents)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="font-mono">{timeLeft(task.deadline_at)}</span>
                        <div className="flex items-center gap-2">
                          {pendingBids.length > 0 && task.status === 'open' && (
                            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-[#f4a261] px-2 py-0.5 text-[10px] font-medium">
                              {pendingBids.length} offer{pendingBids.length > 1 ? 's' : ''}
                            </span>
                          )}
                          <StatusBadge status={task.status} />
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Selected Task Detail / Proof Review Pane */}
            <aside className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 sm:p-6 shadow-xs lg:sticky lg:top-24 lg:self-start">
              {!sel ? (
                <div className="py-12 text-center text-sm text-neutral-500">
                  Select a task from the list to review timeline, earner offers, and submitted proofs.
                </div>
              ) : (
                <TaskDetail
                  item={sel}
                  busy={busy}
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
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-[#161514] p-4">
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
  onAct,
  onAcceptBid,
}: {
  item: ConsoleItem
  busy: string | null
  onAct: (id: string, a: 'approve' | 'reject' | 'cancel') => void
  onAcceptBid: (bidId: string) => void
}) {
  const { task, escrow, proof, bids = [] } = item
  const order = ['pending_funding', 'open', 'claimed', 'submitted', 'paid']
  const reached = order.indexOf(task.status)
  const steps = [['Escrowed', 1], ['Claimed', 2], ['Proof submitted', 3], ['Paid', 4]] as const
  const v = proof?.ai_verdict

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
          {task.title}
        </h2>
        <StatusBadge status={task.status} />
      </div>

      {task.description && (
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {task.description}
        </p>
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
                {task.status === 'open' && b.status === 'pending' && (
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

      {/* Submitted Proof Card */}
      {proof && task.status === 'submitted' && (
        <div className="mt-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Submitted Proof</p>
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
            <p className="mt-3 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
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
              <span>Vision AI Verdict: {v?.toUpperCase()}</span>
              <span>{Math.round((proof.ai_confidence ?? 0) * 100)}% Confidence</span>
            </div>
            {proof.ai_reasoning && (
              <p className="mt-1 text-[11px] opacity-85 leading-normal">{proof.ai_reasoning}</p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              disabled={!!busy}
              onClick={() => onAct(task.id, 'approve')}
              className="flex-1 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 transition-opacity hover:opacity-90 shadow-2xs"
            >
              {busy === task.id + 'approve' ? 'Releasing…' : `Approve & Release ${usd(task.price_cents)}`}
            </button>
            <button
              disabled={!!busy}
              onClick={() => onAct(task.id, 'reject')}
              className="rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {['open', 'claimed', 'submitted'].includes(task.status) && (
        <button
          disabled={!!busy}
          onClick={() => onAct(task.id, 'cancel')}
          className="mt-4 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 underline disabled:opacity-50"
        >
          Cancel task & release escrow hold
        </button>
      )}
    </div>
  )
}
