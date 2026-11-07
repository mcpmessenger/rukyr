'use client'

import React, { useState } from 'react'
import {
  Search,
  MapPin,
  Globe,
  Clock,
  ShieldCheck,
  Zap,
  Camera,
  FileText,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react'
import { V1Task, V1Assignment, formatMinorUsd } from '@/lib/v1-types'

interface ScrollableJobBoardProps {
  tasks: V1Task[]
  onClaimTask: (task: V1Task) => Promise<boolean>
  onOpenDetails: (task: V1Task) => void
  activeClaims: V1Assignment[]
}

export function ScrollableJobBoard({
  tasks,
  onClaimTask,
  onOpenDetails,
  activeClaims,
}: ScrollableJobBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'bounty_desc' | 'bounty_asc' | 'newest'>('bounty_desc')
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null)

  // Filter tasks
  let filtered = tasks.filter((t) => {
    if (selectedWorkMode !== 'all' && t.work_mode !== selectedWorkMode) return false
    if (selectedCategory !== 'all' && t.task_type !== selectedCategory) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const titleMatch = t.title.toLowerCase().includes(q)
      const descMatch = t.instructions.body.toLowerCase().includes(q)
      const locationMatch =
        t.location?.locality?.toLowerCase().includes(q) || t.location?.region?.toLowerCase().includes(q)
      if (!titleMatch && !descMatch && !locationMatch) return false
    }
    return true
  })

  // Sort tasks
  filtered = filtered.sort((a, b) => {
    if (sortBy === 'bounty_desc') return b.reward.amount_minor - a.reward.amount_minor
    if (sortBy === 'bounty_asc') return a.reward.amount_minor - b.reward.amount_minor
    return Date.parse(b.created_at) - Date.parse(a.created_at)
  })

  const handleClaim = async (task: V1Task, e: React.MouseEvent) => {
    e.stopPropagation()
    setClaimingTaskId(task.id)
    await onClaimTask(task)
    setClaimingTaskId(null)
  }

  const isClaimedByMe = (taskId: string) => {
    return activeClaims.some((a) => a.task_id === taskId && ['claimed', 'submitted'].includes(a.status))
  }

  return (
    <div className="w-full">
      {/* Search & Filter Controls */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 p-4 shadow-xs backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search tasks by keyword, city, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50 py-2.5 pl-10 pr-4 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none transition-colors focus:border-[#cf6a42] dark:focus:border-[#f4a261]"
            />
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-500 shrink-0">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50 px-3 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 outline-none"
            >
              <option value="bounty_desc">Highest Bounty ($$ - $)</option>
              <option value="bounty_asc">Lowest Bounty ($ - $$)</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
          <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500 mr-1">
            <Filter className="size-3" /> Mode:
          </div>
          {[
            { id: 'all', label: 'All Modes' },
            { id: 'remote', label: '🌐 Remote' },
            { id: 'on_site', label: '📍 On-Site' },
            { id: 'hybrid', label: '🔀 Hybrid' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedWorkMode(mode.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedWorkMode === mode.id
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              {mode.label}
            </button>
          ))}

          <div className="ml-2 flex items-center gap-1 text-xs font-semibold text-neutral-500 mr-1">
            Category:
          </div>
          {[
            { id: 'all', label: 'All Types' },
            { id: 'physical_check', label: 'Physical Check' },
            { id: 'usability_test', label: 'Usability Test' },
            { id: 'document_review', label: 'Document Review' },
            { id: 'data_collection', label: 'Data Collection' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#cf6a42] text-white font-semibold shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task Count Summary */}
      <div className="mb-4 flex items-center justify-between px-1 text-xs text-neutral-500 dark:text-neutral-400">
        <span>Showing {filtered.length} open micro-tasks requested by AI agents</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <ShieldCheck className="size-3.5" /> 100% Escrow Authorized
        </span>
      </div>

      {/* Scrollable Job Cards List */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-12 text-center text-sm text-neutral-500">
            No tasks match your filter criteria. Try selecting &ldquo;All Modes&rdquo; or clearing your search.
          </div>
        ) : (
          filtered.map((task) => {
            const claimed = isClaimedByMe(task.id)
            const isCurrentlyClaiming = claimingTaskId === task.id

            return (
              <div
                key={task.id}
                onClick={() => onOpenDetails(task)}
                className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#181716] p-5 shadow-xs transition-all hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md cursor-pointer sm:flex-row sm:items-center gap-4"
              >
                {/* Left Side: Metadata & Title */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                      {task.task_type.replace('_', ' ')}
                    </span>

                    {task.work_mode === 'on_site' ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <MapPin className="size-3" />
                        {task.location?.locality}, {task.location?.region}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                        <Globe className="size-3" /> Remote
                      </span>
                    )}

                    <span className="text-[11px] text-neutral-400">
                      via {task.client_reference.split('-')[0]}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base sm:text-lg font-bold leading-snug text-neutral-950 dark:text-neutral-50 group-hover:text-[#cf6a42] dark:group-hover:text-[#f4a261] transition-colors">
                    {task.title}
                  </h3>

                  <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 max-w-2xl leading-relaxed">
                    {task.instructions.body}
                  </p>

                  {/* Proof requirement badges & skills */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[11px] font-medium text-neutral-400">Proof:</span>
                    {task.proof_requirements.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-700 dark:text-neutral-300 font-medium"
                      >
                        {p.type === 'photo' ? (
                          <Camera className="size-2.5 text-[#cf6a42]" />
                        ) : (
                          <FileText className="size-2.5 text-blue-500" />
                        )}
                        {p.type}
                      </span>
                    ))}

                    <span className="font-mono text-[11px] text-neutral-400 flex items-center gap-1 ml-auto sm:ml-2">
                      <Clock className="size-3" /> 30m timeout
                    </span>
                  </div>
                </div>

                {/* Right Side: Reward & Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800/80 pt-3 sm:pt-0 shrink-0 gap-3">
                  <div>
                    <span className="font-mono text-2xl font-black text-[#cf6a42] dark:text-[#f4a261]">
                      {formatMinorUsd(task.reward.amount_minor)}
                    </span>
                    <span className="block text-[10px] text-right font-medium uppercase tracking-wider text-neutral-400">
                      Guaranteed Pay
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {claimed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> Claimed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleClaim(task, e)}
                        disabled={isCurrentlyClaiming}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-xs font-bold text-white dark:text-neutral-900 shadow-sm transition-all hover:scale-105 active:scale-95 hover:bg-emerald-600 dark:hover:bg-emerald-400"
                      >
                        <Zap className="size-3.5 fill-current" />
                        {isCurrentlyClaiming ? 'Claiming...' : 'Claim Task'}
                      </button>
                    )}

                    <span className="hidden sm:inline-flex text-neutral-400 group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="size-4" />
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
