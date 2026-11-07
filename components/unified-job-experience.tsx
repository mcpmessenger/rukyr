'use client'

import React, { useState, useEffect } from 'react'
import {
  Flame,
  LayoutList,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  Laptop,
  Zap,
} from 'lucide-react'
import { V1Task, V1Assignment, formatMinorUsd } from '@/lib/v1-types'
import { DatingCardDeck } from './dating-card-deck'
import { ScrollableJobBoard } from './scrollable-job-board'
import { TaskDetailModal } from './task-detail-modal'
import { ApiSandbox } from './api-sandbox'

interface UnifiedJobExperienceProps {
  initialTasks: V1Task[]
}

export function UnifiedJobExperience({ initialTasks }: UnifiedJobExperienceProps) {
  const [tasks, setTasks] = useState<V1Task[]>(initialTasks)
  const [activeTab, setActiveTab] = useState<'browse' | 'my_claims' | 'api_sandbox'>('browse')
  const [viewMode, setViewMode] = useState<'auto' | 'dating_deck' | 'job_board'>('auto')
  const [isMobile, setIsMobile] = useState(false)
  const [selectedTask, setSelectedTask] = useState<V1Task | null>(null)
  const [activeClaims, setActiveClaims] = useState<V1Assignment[]>([])
  const [claimNotification, setClaimNotification] = useState<string | null>(null)

  // Detect mobile viewport on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-select mode: on mobile, Dating Deck; on desktop, Scrollable Job Board
  const effectiveMode =
    viewMode === 'auto' ? (isMobile ? 'dating_deck' : 'job_board') : viewMode

  // Fetch latest tasks from v0.1 API
  const refreshTasks = async () => {
    try {
      const res = await fetch('/v1/tasks')
      const data = await res.json()
      if (data.data) {
        setTasks(data.data)
      }
    } catch {
      // ignore
    }
  }

  // Claim a task handler (used by both dating deck right swipe and job board claim button)
  const handleClaimTask = async (task: V1Task): Promise<boolean> => {
    const assignment = task.assignments?.[0]
    if (!assignment) return false

    try {
      const res = await fetch(`/v1/worker/assignments/${assignment.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: 'wrk_01J_earner_live' }),
      })

      const data = await res.json()
      if (res.ok && data.assignment) {
        setActiveClaims((prev) => [data.assignment, ...prev.filter((a) => a.id !== data.assignment.id)])
        setClaimNotification(`Claimed "${task.title}" for ${formatMinorUsd(task.reward.amount_minor)}!`)
        setTimeout(() => setClaimNotification(null), 4000)
        refreshTasks()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const handleOpenDetails = (task: V1Task) => {
    setSelectedTask(task)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Top Banner & Mode Switcher */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 pb-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800/60 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
              activeTab === 'browse'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Sparkles className="size-3.5 text-[#cf6a42] dark:text-[#f4a261]" />
            Browse Gigs ({tasks.length})
          </button>

          <button
            onClick={() => setActiveTab('my_claims')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
              activeTab === 'my_claims'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Active Claims ({activeClaims.length})
          </button>

          <button
            onClick={() => setActiveTab('api_sandbox')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
              activeTab === 'api_sandbox'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Terminal className="size-3.5 text-blue-500" />
            API v0.1 Sandbox
          </button>
        </div>

        {/* View Mode Toggle: Dating App Swipe Deck vs Scrollable Job Board */}
        {activeTab === 'browse' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-neutral-500 hidden sm:inline">View Mode:</span>
            <div className="inline-flex rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/60 p-1 text-xs">
              <button
                onClick={() => setViewMode('job_board')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  effectiveMode === 'job_board'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Scrollable Job Board"
              >
                <LayoutList className="size-3.5" />
                <span className="hidden xs:inline">Job Board</span>
              </button>

              <button
                onClick={() => setViewMode('dating_deck')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  effectiveMode === 'dating_deck'
                    ? 'bg-[#cf6a42] text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Dating App Swipe Deck (Left/Right)"
              >
                <Flame className="size-3.5" />
                <span>Dating Deck 🔥</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Claim Notification Toast */}
      {claimNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom-5 duration-200">
          <Zap className="size-4 fill-white" />
          {claimNotification}
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'browse' && (
        <div>
          {effectiveMode === 'dating_deck' ? (
            <div className="flex flex-col items-center">
              <div className="mb-2 text-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <Flame className="size-3" /> Dating App Swipe Mode
                </span>
                <p className="mt-1 text-xs text-neutral-500">
                  Swipe <strong className="text-emerald-500">RIGHT</strong> to Claim &bull; Swipe{' '}
                  <strong className="text-rose-500">LEFT</strong> to Pass
                </p>
              </div>

              <DatingCardDeck
                tasks={tasks}
                onClaimTask={handleClaimTask}
                onOpenDetails={handleOpenDetails}
                activeClaims={activeClaims}
              />
            </div>
          ) : (
            <ScrollableJobBoard
              tasks={tasks}
              onClaimTask={handleClaimTask}
              onOpenDetails={handleOpenDetails}
              activeClaims={activeClaims}
            />
          )}
        </div>
      )}

      {/* Active Claims Tab */}
      {activeTab === 'my_claims' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Your Active Matches & Claimed Tasks
            </h3>
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
              {activeClaims.length} Active
            </span>
          </div>

          {activeClaims.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 p-12 text-center text-neutral-500">
              <Sparkles className="mx-auto size-8 text-neutral-400 mb-2" />
              <p className="text-sm font-semibold">You have no active claims.</p>
              <p className="text-xs text-neutral-400 mt-1">
                Swipe right on any card in the Dating Deck or click &ldquo;Claim&rdquo; on the Job Board.
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="mt-4 rounded-full bg-neutral-900 dark:bg-neutral-100 px-5 py-2 text-xs font-bold text-white dark:text-neutral-900"
              >
                Start Browsing
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeClaims.map((asn) => {
                const parentTask = tasks.find((t) => t.id === asn.task_id)

                return (
                  <div
                    key={asn.id}
                    className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-white dark:bg-[#181716] p-5 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-emerald-600 font-bold uppercase">{asn.status}</span>
                        <span className="font-mono text-neutral-400">{asn.id}</span>
                      </div>
                      <h4 className="mt-2 font-bold text-neutral-950 dark:text-neutral-50">
                        {parentTask?.title || 'Claimed Assignment'}
                      </h4>
                      <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                        {parentTask?.instructions.body}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-3">
                      <span className="font-mono text-lg font-bold text-[#cf6a42]">
                        {parentTask ? formatMinorUsd(parentTask.reward.amount_minor) : '$15.00'}
                      </span>
                      <button
                        onClick={() => {
                          if (parentTask) {
                            setSelectedTask(parentTask)
                          }
                        }}
                        className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-600"
                      >
                        {asn.status === 'submitted' ? 'View Submission' : 'Submit Proof'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* API Sandbox Tab */}
      {activeTab === 'api_sandbox' && <ApiSandbox />}

      {/* Modal Sheet for Task Details & Live Submission */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onClaim={handleClaimTask}
          activeAssignment={
            activeClaims.find((a) => a.task_id === selectedTask.id) || selectedTask.assignments?.[0]
          }
          onRefresh={refreshTasks}
        />
      )}
    </div>
  )
}
