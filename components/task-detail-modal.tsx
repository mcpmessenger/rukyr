'use client'

import React, { useState } from 'react'
import {
  X,
  Zap,
  MapPin,
  Globe,
  Clock,
  ShieldCheck,
  Camera,
  FileText,
  CheckCircle2,
  AlertCircle,
  Code,
  Send,
  ThumbsUp,
  ThumbsDown,
  Upload,
} from 'lucide-react'
import { V1Task, V1Assignment, formatMinorUsd } from '@/lib/v1-types'

interface TaskDetailModalProps {
  task: V1Task | null
  onClose: () => void
  onClaim: (task: V1Task) => Promise<boolean>
  activeAssignment?: V1Assignment | null
  onRefresh: () => void
}

export function TaskDetailModal({
  task,
  onClose,
  onClaim,
  activeAssignment,
  onRefresh,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'schema' | 'submit' | 'decision'>('details')
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  // Submission Form State (dynamically mapped from output_schema properties)
  const [outputValues, setOutputValues] = useState<Record<string, any>>({})
  const [artifactPhotoCaption, setArtifactPhotoCaption] = useState('Clear photo of item in natural daylight')
  const [artifactPhotoUrl, setArtifactPhotoUrl] = useState('https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800')
  const [workerNote, setWorkerNote] = useState('Inspected outside Wasteland Vintage on Haight St in indirect daylight.')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<any | null>(null)

  // Decision State (for agent review simulation)
  const [decisionType, setDecisionType] = useState<'accept' | 'reject'>('accept')
  const [decisionReason, setDecisionReason] = useState('meets_requirements')
  const [decisionFeedback, setDecisionFeedback] = useState('')
  const [isDeciding, setIsDeciding] = useState(false)
  const [decisionResult, setDecisionResult] = useState<any | null>(null)

  if (!task) return null

  // Initialize output defaults if needed
  const schemaProps = (task.output_schema?.properties as Record<string, any>) || {}
  const isClaimed = Boolean(activeAssignment && ['claimed', 'submitted', 'accepted'].includes(activeAssignment.status))
  const isSubmitted = activeAssignment?.status === 'submitted'
  const isAccepted = activeAssignment?.status === 'accepted'

  const handleClaimClick = async () => {
    setIsClaiming(true)
    setClaimMsg(null)
    const ok = await onClaim(task)
    setIsClaiming(false)
    if (ok) {
      setClaimMsg('Task successfully claimed! Escrow hold locked.')
      setActiveTab('submit')
      onRefresh()
    }
  }

  const handleFieldChange = (key: string, value: any) => {
    setOutputValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAssignment) return
    setIsSubmitting(true)
    setSubmitResult(null)

    // Build payload matching Section 9 spec
    const payload = {
      output: outputValues,
      artifacts: [
        {
          upload_id: `upl_01J_${Date.now()}`,
          type: 'photo',
          caption: artifactPhotoCaption,
          url: artifactPhotoUrl,
        },
      ],
      worker_note: workerNote,
    }

    try {
      const res = await fetch(`/v1/worker/assignments/${activeAssignment.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setIsSubmitting(false)
      if (res.ok) {
        setSubmitResult({ success: true, data })
        onRefresh()
      } else {
        setSubmitResult({ success: false, error: data.error?.message || 'Submission failed' })
      }
    } catch (err: any) {
      setIsSubmitting(false)
      setSubmitResult({ success: false, error: err.message })
    }
  }

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAssignment) return
    setIsDeciding(true)
    setDecisionResult(null)

    try {
      const res = await fetch(`/v1/assignments/${activeAssignment.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `idemp_${Date.now()}`,
        },
        body: JSON.stringify({
          decision: decisionType,
          reason_code: decisionReason,
          feedback: decisionFeedback,
        }),
      })
      const data = await res.json()
      setIsDeciding(false)
      if (res.ok) {
        setDecisionResult({ success: true, data })
        onRefresh()
      } else {
        setDecisionResult({ success: false, error: data.error?.message || 'Decision failed' })
      }
    } catch (err: any) {
      setIsDeciding(false)
      setDecisionResult({ success: false, error: err.message })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#181716] shadow-2xl">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-neutral-200 dark:bg-neutral-800 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              {task.task_type.replace('_', ' ')}
            </span>
            <span className="font-mono text-xs text-neutral-500">{task.id}</span>
          </div>

          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Header Title & Reward */}
        <div className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-neutral-950 dark:text-neutral-50">
                {task.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {task.work_mode === 'on_site' ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <MapPin className="size-3.5" />
                    {task.location?.locality}, {task.location?.region}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                    <Globe className="size-3.5" /> Remote Worldwide
                  </span>
                )}
                <span className="text-neutral-300 dark:text-neutral-700">•</span>
                <span className="text-neutral-500">Client: {task.client_reference}</span>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="font-mono text-3xl font-black text-[#cf6a42] dark:text-[#f4a261]">
                {formatMinorUsd(task.reward.amount_minor)}
              </span>
              <span className="block text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex sm:justify-end items-center gap-1 mt-0.5">
                <ShieldCheck className="size-3.5" /> Escrow Authorized
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
            {[
              { id: 'details', label: 'Instructions & Input' },
              { id: 'schema', label: 'Output Schema (JSON)' },
              { id: 'submit', label: isSubmitted ? 'Submission ✅' : 'Submit Proof 📸' },
              { id: 'decision', label: 'Agent Decision ⚖️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`border-b-2 px-4 py-2.5 transition-all ${
                  activeTab === tab.id
                    ? 'border-[#cf6a42] text-[#cf6a42] dark:border-[#f4a261] dark:text-[#f4a261]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Tab 1: Details & Instructions */}
          {activeTab === 'details' && (
            <div className="space-y-5 text-sm">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Instructions from Buyer Agent
                </h4>
                <div className="mt-2 rounded-2xl bg-neutral-50 dark:bg-neutral-900/80 p-4 font-mono text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed border border-neutral-200/80 dark:border-neutral-800/80">
                  {task.instructions.body}
                </div>
              </div>

              {/* Task Input Context */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Provided Input & Context
                </h4>
                <div className="mt-2 rounded-2xl bg-neutral-900 p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
                  <pre>{JSON.stringify(task.input, null, 2)}</pre>
                </div>
              </div>

              {/* Proof Requirements */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Proof Checklist
                </h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {task.proof_requirements.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-900/60 p-3"
                    >
                      {p.type === 'photo' ? (
                        <Camera className="size-4 text-[#cf6a42] shrink-0 mt-0.5" />
                      ) : (
                        <FileText className="size-4 text-blue-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold uppercase text-neutral-900 dark:text-neutral-100">
                          {p.type} {p.required ? '(Required)' : '(Optional)'}
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {p.instructions || `Submit at least ${p.min_count ?? 1} valid ${p.type}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Output Schema */}
          {activeTab === 'schema' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Submissions are strictly validated server-side against this JSON Schema (2020-12) before reaching the
                buyer.
              </p>
              <div className="rounded-2xl bg-neutral-950 p-4 font-mono text-xs text-amber-300 overflow-x-auto border border-neutral-800">
                <pre>{JSON.stringify(task.output_schema, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Tab 3: Submit Proof */}
          {activeTab === 'submit' && (
            <div className="space-y-4">
              {!isClaimed ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 text-center">
                  <AlertCircle className="mx-auto size-8 text-amber-500" />
                  <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    You must claim this task before submitting proof.
                  </p>
                  <button
                    onClick={handleClaimClick}
                    disabled={isClaiming}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-600 transition-all"
                  >
                    <Zap className="size-3.5 fill-white" />
                    {isClaiming ? 'Claiming...' : 'Claim Task Now'}
                  </button>
                </div>
              ) : isSubmitted ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-neutral-900 dark:text-neutral-100">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="size-5" /> Proof Submitted & Validated!
                  </div>
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    Your submission has passed schema validation and automated checks. Awaiting buyer decision or
                    instant settlement.
                  </p>
                  {activeAssignment?.submission && (
                    <div className="mt-4 rounded-xl bg-neutral-950 p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify(activeAssignment.submission, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitProof} className="space-y-4 text-xs">
                  <div className="rounded-xl bg-blue-500/10 p-3 text-blue-700 dark:text-blue-300">
                    Active Assignment: <span className="font-mono font-bold">{activeAssignment?.id}</span> • 30-minute
                    claim lock active.
                  </div>

                  {/* Dynamic Form Fields based on schema properties */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[11px]">
                      Structured Output Fields
                    </h5>

                    {Object.entries(schemaProps).map(([propName, propDef]: [string, any]) => (
                      <div key={propName} className="space-y-1">
                        <label className="font-medium text-neutral-900 dark:text-neutral-100">
                          {propName} {propDef.type && <span className="text-neutral-400 font-mono">({propDef.type})</span>}
                        </label>

                        {propDef.type === 'boolean' ? (
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={propName}
                                checked={outputValues[propName] === true}
                                onChange={() => handleFieldChange(propName, true)}
                              />
                              <span>True</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={propName}
                                checked={outputValues[propName] === false}
                                onChange={() => handleFieldChange(propName, false)}
                              />
                              <span>False</span>
                            </label>
                          </div>
                        ) : propDef.maxLength && propDef.maxLength > 200 ? (
                          <textarea
                            rows={3}
                            placeholder={`Enter ${propName}...`}
                            value={outputValues[propName] || ''}
                            onChange={(e) => handleFieldChange(propName, e.target.value)}
                            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2.5 text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <input
                            type={propDef.type === 'number' ? 'number' : 'text'}
                            placeholder={`Enter ${propName}...`}
                            value={outputValues[propName] || ''}
                            onChange={(e) =>
                              handleFieldChange(
                                propName,
                                propDef.type === 'number' ? Number(e.target.value) : e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2.5 text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Artifact / Photo upload slot */}
                  <div className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                    <h5 className="font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[11px]">
                      Required Artifacts (Evidence)
                    </h5>

                    <div>
                      <label className="font-medium text-neutral-700 dark:text-neutral-300">Photo Evidence URL</label>
                      <input
                        type="url"
                        value={artifactPhotoUrl}
                        onChange={(e) => setArtifactPhotoUrl(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-neutral-700 dark:text-neutral-300">Photo Caption</label>
                      <input
                        type="text"
                        value={artifactPhotoCaption}
                        onChange={(e) => setArtifactPhotoCaption(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-neutral-700 dark:text-neutral-300">Worker Note</label>
                      <textarea
                        rows={2}
                        value={workerNote}
                        onChange={(e) => setWorkerNote(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 text-xs"
                      />
                    </div>
                  </div>

                  {submitResult && !submitResult.success && (
                    <div className="rounded-xl bg-rose-500/10 p-3 text-rose-600 dark:text-rose-400">
                      Error: {submitResult.error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-emerald-500 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="size-3.5" />
                    {isSubmitting ? 'Validating & Submitting...' : 'Submit Work & Request Escrow Payout'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Tab 4: Agent Review Decision */}
          {activeTab === 'decision' && (
            <div className="space-y-4 text-xs">
              <p className="text-neutral-600 dark:text-neutral-400">
                Simulate how the buyer agent reviews the submitted assignment via{' '}
                <code className="font-mono text-[#cf6a42]">POST /v1/assignments/:id/decision</code>.
              </p>

              {!activeAssignment?.submission ? (
                <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 p-6 text-center text-neutral-500">
                  No submission yet to review. Submit proof in the previous tab first.
                </div>
              ) : isAccepted ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="size-4" /> Assignment Accepted & Settled
                  </div>
                  <p className="mt-1">
                    Payout of {formatMinorUsd(task.reward.amount_minor)} settled to earner. Webhook{' '}
                    <code className="font-mono">payment.settled</code> emitted.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleDecision} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionType('accept')
                        setDecisionReason('meets_requirements')
                      }}
                      className={`flex-1 rounded-xl p-3 border font-bold flex items-center justify-center gap-2 transition-all ${
                        decisionType === 'accept'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                          : 'border-neutral-300 dark:border-neutral-800 text-neutral-500'
                      }`}
                    >
                      <ThumbsUp className="size-4" /> Accept Work
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionType('reject')
                        setDecisionReason('missing_required_evidence')
                      }}
                      className={`flex-1 rounded-xl p-3 border font-bold flex items-center justify-center gap-2 transition-all ${
                        decisionType === 'reject'
                          ? 'border-rose-500 bg-rose-500/10 text-rose-600'
                          : 'border-neutral-300 dark:border-neutral-800 text-neutral-500'
                      }`}
                    >
                      <ThumbsDown className="size-4" /> Reject Work
                    </button>
                  </div>

                  <div>
                    <label className="font-medium text-neutral-700 dark:text-neutral-300">Reason Code</label>
                    <select
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 font-mono text-xs"
                    >
                      {decisionType === 'accept' ? (
                        <>
                          <option value="meets_requirements">meets_requirements</option>
                          <option value="exceptional_quality">exceptional_quality</option>
                        </>
                      ) : (
                        <>
                          <option value="missing_required_evidence">missing_required_evidence</option>
                          <option value="inaccurate_observation">inaccurate_observation</option>
                          <option value="poor_lighting">poor_lighting</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-medium text-neutral-700 dark:text-neutral-300">Feedback Note</label>
                    <input
                      type="text"
                      placeholder="Optional feedback to worker..."
                      value={decisionFeedback}
                      onChange={(e) => setDecisionFeedback(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 text-xs"
                    />
                  </div>

                  {decisionResult && (
                    <div
                      className={`rounded-xl p-3 ${
                        decisionResult.success
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {decisionResult.success ? 'Decision applied successfully!' : decisionResult.error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isDeciding}
                    className="w-full rounded-full bg-neutral-900 dark:bg-neutral-100 py-3 text-xs font-bold text-white dark:text-neutral-900 shadow-md transition-all hover:scale-101 active:scale-98"
                  >
                    {isDeciding ? 'Applying Decision...' : 'Post Buyer Decision & Finalize'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 px-6 py-4">
          <span className="text-xs text-neutral-500">
            Status:{' '}
            <strong className="font-mono uppercase text-neutral-900 dark:text-neutral-100">
              {activeAssignment?.status || task.status}
            </strong>
          </span>

          {!isClaimed && (
            <button
              onClick={handleClaimClick}
              disabled={isClaiming}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
            >
              <Zap className="size-3.5 fill-white" />
              {isClaiming ? 'Claiming...' : `Claim for ${formatMinorUsd(task.reward.amount_minor)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
