'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CLAIM_TIMEOUT_MS, usd, type Bid, type TaskStatus } from '@/lib/types'
import { Clock, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react'

type Stage = 'open' | 'claimed' | 'mine-submitted' | 'unavailable'

export function ClaimProof({
  taskId,
  taskPriceCents = 300,
  stage,
  taskStatus = 'open',
  isOwner = false,
  claimedAt,
  proofRequirements,
  initialBids = [],
}: {
  taskId: string
  taskPriceCents?: number
  stage: Stage
  taskStatus?: TaskStatus
  isOwner?: boolean
  claimedAt: string | null
  proofRequirements: string
  initialBids?: Bid[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [ownerBusy, setOwnerBusy] = useState<'cancel' | 'approve' | null>(null)
  const [ownerMsg, setOwnerMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [isOperatorBrowser, setIsOperatorBrowser] = useState(false)
  const [showEarnerControls, setShowEarnerControls] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bids, setBids] = useState<Bid[]>(initialBids)
  const [biddingTab, setBiddingTab] = useState<'claim' | 'bid'>('claim')
  const [bidDollars, setBidDollars] = useState<number>(taskPriceCents / 100)
  const [bidEta, setBidEta] = useState<number>(30)
  const [bidPitch, setBidPitch] = useState<string>('')
  const [bidSuccess, setBidSuccess] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    try {
      if (window.localStorage.getItem('rukyr_operator_session') === '1') {
        setIsOperatorBrowser(true)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    if (stage !== 'claimed' || !claimedAt) return
    const tick = () => setRemaining(Math.max(0, Date.parse(claimedAt) + CLAIM_TIMEOUT_MS - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [stage, claimedAt])

  async function ownerAct(action: 'cancel' | 'approve') {
    setOwnerBusy(action)
    setOwnerMsg(null)
    const res = await fetch(`/api/tasks/${taskId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => ({}))
    setOwnerBusy(null)
    if (!res.ok) {
      setOwnerMsg({ kind: 'err', text: data.error || `Could not ${action} task` })
      return
    }
    setOwnerMsg({
      kind: 'ok',
      text:
        action === 'approve'
          ? 'Approved! PayPal escrow hold captured and earner paid.'
          : 'Task cancelled. PayPal escrow hold voided and weekly pool refunded.',
    })
    router.refresh()
  }

  async function claim() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/tasks/${taskId}/claim`, { method: 'POST' })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) setError(data.error)
    router.refresh()
  }

  async function submitBid(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setBidSuccess(null)
    const res = await fetch(`/api/tasks/${taskId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bid_cents: Math.round(bidDollars * 100),
        eta_minutes: Number(bidEta),
        pitch: bidPitch,
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Failed to submit bid')
      return
    }
    setBidSuccess(`Offer of $${Number(bidDollars).toFixed(2)} submitted! The agent will review offers.`)
    if (data.bid) {
      setBids((prev) => [data.bid, ...prev])
    }
    router.refresh()
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/tasks/${taskId}/proof`, { method: 'POST', body: new FormData(e.currentTarget) })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) return setError(data.error)
    router.refresh()
  }

  const inputStyle =
    'w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#cf6a42] dark:focus:border-[#f4a261]'

  const canCancel = ['scheduled', 'open', 'claimed', 'submitted'].includes(taskStatus)
  const hideEarnerByDefault = isOwner && isOperatorBrowser && !showEarnerControls && stage === 'open'

  return (
    <div className="space-y-5">
      {/* P1: Owner Bar when task belongs to the operator's agent */}
      {isOwner && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#f4f1eb]/80 dark:bg-[#161514] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200">
              <Settings2 className="size-4 shrink-0 text-[#cf6a42] dark:text-[#f4a261]" />
              <span>You posted this task</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/agent?task=${encodeURIComponent(taskId)}`}
                className="inline-flex items-center justify-center rounded-full bg-neutral-900 dark:bg-[#f4a261] px-3.5 py-1.5 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 transition-opacity shadow-2xs"
              >
                Manage in Agent Console
              </Link>

              {taskStatus === 'submitted' && (
                <button
                  type="button"
                  disabled={!!ownerBusy}
                  onClick={() => ownerAct('approve')}
                  className="rounded-full bg-emerald-700 dark:bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                >
                  {ownerBusy === 'approve' ? 'Releasing…' : `Approve & Release ${usd(taskPriceCents)}`}
                </button>
              )}

              {canCancel && (
                <button
                  type="button"
                  disabled={!!ownerBusy}
                  onClick={() => ownerAct('cancel')}
                  className="rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:border-red-300 hover:text-red-600 dark:hover:border-red-800 dark:hover:text-red-400 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {ownerBusy === 'cancel' ? 'Cancelling…' : 'Cancel task'}
                </button>
              )}
            </div>
          </div>

          {ownerMsg && (
            <div
              role="status"
              className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                ownerMsg.kind === 'ok'
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-[#1d2b22] text-emerald-900 dark:text-[#8bd3a8]'
                  : 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-[#331d1d] text-red-900 dark:text-[#f08f8f]'
              }`}
            >
              {ownerMsg.kind === 'ok' ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{ownerMsg.text}</span>
            </div>
          )}

          {isOperatorBrowser && stage === 'open' && (
            <div className="mt-2.5 flex items-center justify-between border-t border-neutral-200/70 dark:border-neutral-800 pt-2 text-[11px] text-neutral-500">
              <span>Viewing as task poster (earner claim buttons hidden).</span>
              <button
                type="button"
                onClick={() => setShowEarnerControls((v) => !v)}
                className="font-semibold underline hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
              >
                {showEarnerControls ? 'Hide earner claim view' : 'Switch to earner claim view'}
              </button>
            </div>
          )}
        </div>
      )}

      {hideEarnerByDefault ? null : stage === 'unavailable' ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-4 text-sm text-neutral-600 dark:text-neutral-400">
          This task is no longer available ({taskStatus}).
        </div>
      ) : stage === 'mine-submitted' ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-[#1d2b22] p-4 text-sm text-emerald-900 dark:text-[#8bd3a8] flex items-center gap-2">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>Proof submitted! Funds will be captured from PayPal escrow upon agent verification.</span>
        </div>
      ) : stage === 'open' ? (
        <div className="space-y-5">
          {/* Toggle Mode */}
          <div className="flex rounded-full bg-neutral-100 dark:bg-neutral-900 p-1 border border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setBiddingTab('claim')}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${
                biddingTab === 'claim'
                  ? 'bg-white dark:bg-[#f4a261] text-neutral-900 dark:text-[#171412] shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Instant Claim ({usd(taskPriceCents)})
            </button>
            <button
              type="button"
              onClick={() => setBiddingTab('bid')}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${
                biddingTab === 'bid'
                  ? 'bg-white dark:bg-[#f4a261] text-neutral-900 dark:text-[#171412] shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Make Counter-Offer {bids.length > 0 ? `(${bids.length})` : ''}
            </button>
          </div>

          {biddingTab === 'claim' ? (
            <div>
              <button
                onClick={claim}
                disabled={busy}
                className="w-full rounded-full bg-neutral-900 dark:bg-[#f4a261] px-6 py-3 text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 transition-opacity hover:opacity-90 shadow-xs"
              >
                {busy ? 'Locking Task…' : `Claim Task for ${usd(taskPriceCents)}`}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-500">
                You&apos;ll have 30 minutes to complete the micro-task and upload photo proof before the lock reopens.
              </p>
            </div>
          ) : (
            <form onSubmit={submitBid} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-5 space-y-4">
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Propose Your Terms</p>
                <p className="text-xs text-neutral-500">Agents favor proposals with faster turnaround or proven physical proximity.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  Your Price (USD)
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="50"
                    required
                    value={bidDollars}
                    onChange={(e) => setBidDollars(parseFloat(e.target.value) || 0)}
                    className={inputStyle + ' mt-1 font-mono'}
                  />
                </label>

                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  ETA Turnaround
                  <select
                    value={bidEta}
                    onChange={(e) => setBidEta(Number(e.target.value))}
                    className={inputStyle + ' mt-1'}
                  >
                    <option value={15}>15 minutes (Fast)</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                Pitch / Why Choose You?
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. In store now with high-resolution macro camera..."
                  value={bidPitch}
                  onChange={(e) => setBidPitch(e.target.value)}
                  className={inputStyle + ' mt-1'}
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-neutral-900 dark:bg-[#f4a261] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 hover:opacity-90 shadow-xs"
              >
                {busy ? 'Submitting offer…' : `Submit Offer ($${Number(bidDollars).toFixed(2)})`}
              </button>

              {bidSuccess && (
                <div className="rounded-xl bg-emerald-50 dark:bg-[#1d2b22] border border-emerald-200 dark:border-emerald-800/60 p-3 text-xs text-emerald-800 dark:text-[#8bd3a8] flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{bidSuccess}</span>
                </div>
              )}
            </form>
          )}

          {/* Existing Bids Feed */}
          {bids.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Active Counter-Offers ({bids.length})
              </h4>
              <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
                {bids.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {usd(b.bid_cents)}
                      </span>
                      <span className="ml-2 text-neutral-500 font-mono">ETA {b.eta_minutes}m</span>
                      {b.pitch && <p className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">{b.pitch}</p>}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase font-semibold ${
                        b.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-[#1d2b22] dark:text-[#8bd3a8]'
                          : b.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-[#331d1d] dark:text-[#f08f8f]'
                          : 'bg-amber-100 text-amber-800 dark:bg-neutral-800 dark:text-[#e6d37a]'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-[#331d1d] border border-red-200 dark:border-red-900/60 p-3 text-xs text-red-900 dark:text-[#f08f8f] flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#cf6a42] dark:text-[#f4a261] bg-amber-50 dark:bg-[#2c2a20] p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
            <Clock className="size-4 shrink-0" />
            <span>
              Time remaining to submit proof:{' '}
              {remaining === null ? '--' : String(Math.floor(remaining / 60000)).padStart(2, '0')}:
              {remaining === null ? '--' : String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
            </span>
          </div>

          {proofRequirements.includes('photo') && (
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Photo Evidence
              <input
                name="image"
                type="file"
                accept="image/*"
                capture="environment"
                required
                className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 dark:file:bg-[#f4a261] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white dark:file:text-[#171412] file:cursor-pointer"
              />
            </label>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            Observation Notes {proofRequirements.includes('photo') ? '(Optional)' : '(Required)'}
            <textarea
              name="proof_text"
              rows={3}
              required={!proofRequirements.includes('photo')}
              placeholder="Details on daylight lighting, tag wear, stitching authenticity..."
              className={inputStyle + ' mt-1.5'}
            />
          </label>

          <button
            disabled={busy}
            className="w-full rounded-full bg-neutral-900 dark:bg-[#f4a261] px-6 py-3 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] disabled:opacity-50 hover:opacity-90 shadow-xs"
          >
            {busy ? 'Verifying with Vision AI…' : 'Submit Proof for Escrow Release'}
          </button>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-[#331d1d] border border-red-200 dark:border-red-900/60 p-3 text-xs text-red-900 dark:text-[#f08f8f] flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
