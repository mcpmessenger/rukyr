'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  RotateCcw,
  X,
  Star,
  Zap,
  Info,
  MapPin,
  Globe,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Camera,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { V1Task, V1Assignment, formatMinorUsd } from '@/lib/v1-types'

interface DatingCardDeckProps {
  tasks: V1Task[]
  onClaimTask: (task: V1Task) => Promise<boolean>
  onOpenDetails: (task: V1Task) => void
  activeClaims: V1Assignment[]
}

export function DatingCardDeck({
  tasks,
  onClaimTask,
  onOpenDetails,
  activeClaims,
}: DatingCardDeckProps) {
  const [deck, setDeck] = useState<V1Task[]>(tasks)
  const [history, setHistory] = useState<V1Task[]>([])
  const [savedTasks, setSavedTasks] = useState<string[]>([])
  const [matchedTask, setMatchedTask] = useState<V1Task | null>(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [expandedInfo, setExpandedInfo] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)

  // Drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDeck(tasks)
  }, [tasks])

  const currentTask = deck[0]
  const nextTask = deck[1]
  const thirdTask = deck[2]

  const handleSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      if (!currentTask) return

      const swiped = currentTask
      setSwipeDirection(direction)

      if (direction === 'right') {
        setIsClaiming(true)
        const success = await onClaimTask(swiped)
        setIsClaiming(false)
        if (success) {
          setMatchedTask(swiped)
          setShowMatchModal(true)
        }
      }

      setTimeout(() => {
        setHistory((prev) => [swiped, ...prev])
        setDeck((prev) => prev.slice(1))
        setDragOffset({ x: 0, y: 0 })
        setSwipeDirection(null)
        setExpandedInfo(false)
      }, 250)
    },
    [currentTask, onClaimTask]
  )

  const handleRewind = () => {
    if (history.length === 0) return
    const prev = history[0]
    setHistory((h) => h.slice(1))
    setDeck((d) => [prev, ...d])
    setDragOffset({ x: 0, y: 0 })
    setSwipeDirection(null)
  }

  const handleStar = () => {
    if (!currentTask) return
    if (!savedTasks.includes(currentTask.id)) {
      setSavedTasks((prev) => [...prev, currentTask.id])
    }
    // Also advance card
    handleSwipe('left')
  }

  // Pointer event handlers for gesture drag
  const onPointerDown = (e: React.PointerEvent) => {
    // Only drag with primary mouse button or touch
    if (e.button !== 0) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setDragOffset({ x: dx, y: dy })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)

    const threshold = 100
    if (dragOffset.x > threshold) {
      handleSwipe('right')
    } else if (dragOffset.x < -threshold) {
      handleSwipe('left')
    } else {
      // Snap back
      setDragOffset({ x: 0, y: 0 })
    }
  }

  // Compute rotation & stamp opacity
  const rotation = dragOffset.x * 0.08
  const rightStampOpacity = Math.min(1, Math.max(0, dragOffset.x / 80))
  const leftStampOpacity = Math.min(1, Math.max(0, -dragOffset.x / 80))

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center justify-start px-3 py-2 sm:px-4">
      {/* Deck Subtitle */}
      <div className="mb-3 flex w-full items-center justify-between px-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          {deck.length} tasks ready to claim
        </span>
        <span className="font-mono text-[11px]">Swipe Right = Claim • Left = Pass</span>
      </div>

      {/* Card Stack Area */}
      <div className="relative h-[550px] w-full select-none touch-none sm:h-[580px]">
        {deck.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-8 text-center shadow-lg backdrop-blur-md">
            <div className="flex size-16 items-center justify-center rounded-full bg-[#f4a261]/20 text-[#cf6a42] dark:text-[#f4a261]">
              <Sparkles className="size-8" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-neutral-900 dark:text-neutral-100">
              You&apos;ve cleared the queue!
            </h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Autonomous AI shopping agents are posting new physical checks & digital verifications continuously.
            </p>
            {history.length > 0 && (
              <button
                onClick={() => {
                  setDeck(history)
                  setHistory([])
                }}
                className="mt-6 flex items-center gap-2 rounded-full bg-neutral-900 dark:bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-neutral-900 shadow-md transition-transform hover:scale-105 active:scale-95"
              >
                <RotateCcw className="size-4" /> Reset Deck & Review Gigs
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Third Card in Stack */}
            {thirdTask && (
              <div
                className="pointer-events-none absolute inset-x-4 bottom-0 top-6 rounded-3xl border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-900/60 shadow-xs"
                style={{
                  transform: 'scale(0.92) translateY(16px)',
                  opacity: 0.5,
                }}
              />
            )}

            {/* Second Card in Stack */}
            {nextTask && (
              <div
                className="pointer-events-none absolute inset-x-2 bottom-0 top-3 rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 shadow-sm"
                style={{
                  transform: `scale(${0.96 + Math.min(Math.abs(dragOffset.x) / 2500, 0.04)}) translateY(${
                    8 - Math.min(Math.abs(dragOffset.x) / 30, 8)
                  }px)`,
                  transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                }}
              />
            )}

            {/* Top Interactive Card */}
            {currentTask && (
              <div
                ref={cardRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="absolute inset-0 flex cursor-grab flex-col justify-between overflow-hidden rounded-3xl border border-neutral-200/90 dark:border-neutral-800/90 bg-white dark:bg-[#181716] shadow-xl active:cursor-grabbing"
                style={{
                  transform: `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.4}px, 0) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.18)',
                }}
              >
                {/* Stamp: CLAIM (When dragged right) */}
                <div
                  className="pointer-events-none absolute left-6 top-8 z-30 -rotate-12 rounded-xl border-4 border-emerald-500 bg-emerald-500/10 px-4 py-2 font-black uppercase tracking-wider text-emerald-500 shadow-lg backdrop-blur-xs"
                  style={{
                    opacity: swipeDirection === 'right' ? 1 : rightStampOpacity,
                    transform: `rotate(-12deg) scale(${0.8 + rightStampOpacity * 0.3})`,
                  }}
                >
                  CLAIM {formatMinorUsd(currentTask.reward.amount_minor)}
                </div>

                {/* Stamp: PASS (When dragged left) */}
                <div
                  className="pointer-events-none absolute right-6 top-8 z-30 rotate-12 rounded-xl border-4 border-rose-500 bg-rose-500/10 px-4 py-2 font-black uppercase tracking-wider text-rose-500 shadow-lg backdrop-blur-xs"
                  style={{
                    opacity: swipeDirection === 'left' ? 1 : leftStampOpacity,
                    transform: `rotate(12deg) scale(${0.8 + leftStampOpacity * 0.3})`,
                  }}
                >
                  PASS
                </div>

                {/* Card Header & Category Gradient */}
                <div className="relative flex flex-col justify-between p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-800/80 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      {currentTask.task_type.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-3.5" /> Escrow Authorized
                    </span>
                  </div>

                  {/* Giant Reward Display */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="font-mono text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50">
                        {formatMinorUsd(currentTask.reward.amount_minor)}
                      </span>
                      <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">payout</span>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-full bg-[#f4a261]/15 px-3 py-1 font-mono text-xs font-semibold text-[#cf6a42] dark:text-[#f4a261]">
                      <Clock className="size-3.5" /> 30m claim limit
                    </div>
                  </div>
                </div>

                {/* Main Card Content */}
                <div className="flex-1 overflow-y-auto px-5 py-2 scrollbar-none">
                  <h2 className="text-xl font-bold leading-snug tracking-tight text-neutral-900 dark:text-neutral-100">
                    {currentTask.title}
                  </h2>

                  {/* Work Mode & Location Badge */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {currentTask.work_mode === 'on_site' ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-400">
                        <MapPin className="size-3" />
                        {currentTask.location?.locality || 'Local On-Site'}, {currentTask.location?.region}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2.5 py-1 font-medium text-blue-700 dark:text-blue-400">
                        <Globe className="size-3" /> Remote — Anywhere
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-neutral-600 dark:text-neutral-400">
                      Client: {currentTask.client_reference.split('-')[0]}
                    </span>
                  </div>

                  {/* Instructions Preview */}
                  <div className="mt-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 p-3.5 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed border border-neutral-200/60 dark:border-neutral-800/60">
                    <p className={expandedInfo ? '' : 'line-clamp-3'}>
                      {currentTask.instructions.body}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedInfo(!expandedInfo)
                      }}
                      className="mt-2 inline-flex items-center gap-1 font-medium text-[#cf6a42] dark:text-[#f4a261] hover:underline"
                    >
                      {expandedInfo ? (
                        <>
                          Less <ChevronUp className="size-3" />
                        </>
                      ) : (
                        <>
                          More details <ChevronDown className="size-3" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Required Proof Chips */}
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      Proof Needed to Release Escrow
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {currentTask.proof_requirements.map((p, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-800 dark:text-neutral-200"
                        >
                          {p.type === 'photo' ? (
                            <Camera className="size-3 text-[#cf6a42] dark:text-[#f4a261]" />
                          ) : (
                            <FileText className="size-3 text-blue-500" />
                          )}
                          {p.type} {p.min_count ? `(${p.min_count}${p.max_count ? `-${p.max_count}` : ''})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Card Bar */}
                <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50 px-5 py-3">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Instant dispatch</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenDetails(currentTask)
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
                  >
                    <Info className="size-3.5" /> Full Spec
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dating App Floating Action Controls */}
      <div className="mt-4 flex w-full items-center justify-center gap-3 sm:gap-4">
        {/* Rewind Button */}
        <button
          type="button"
          onClick={handleRewind}
          disabled={history.length === 0}
          className="flex size-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-amber-500 shadow-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Rewind last task"
          title="Rewind"
        >
          <RotateCcw className="size-4" />
        </button>

        {/* Pass / Swipe Left Button */}
        <button
          type="button"
          onClick={() => handleSwipe('left')}
          disabled={!currentTask}
          className="flex size-14 items-center justify-center rounded-full border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-neutral-900 text-rose-500 shadow-md transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Pass task"
          title="Pass (Swipe Left)"
        >
          <X className="size-6 stroke-[2.5]" />
        </button>

        {/* Super-Star / Bookmark Button */}
        <button
          type="button"
          onClick={handleStar}
          disabled={!currentTask}
          className="flex size-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-blue-500 shadow-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Star task"
          title="Save for Later"
        >
          <Star className="size-4 fill-blue-500/20" />
        </button>

        {/* Claim / Swipe Right Button */}
        <button
          type="button"
          onClick={() => handleSwipe('right')}
          disabled={!currentTask || isClaiming}
          className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Claim task"
          title="Claim (Swipe Right)"
        >
          <Zap className="size-6 fill-white" />
        </button>

        {/* Info / Inspect Button */}
        <button
          type="button"
          onClick={() => currentTask && onOpenDetails(currentTask)}
          disabled={!currentTask}
          className="flex size-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-purple-500 shadow-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="View task details"
          title="Inspect Details"
        >
          <Info className="size-4" />
        </button>
      </div>

      {/* Match Confirmation Modal */}
      {showMatchModal && matchedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <Zap className="size-8 fill-emerald-500" />
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> IT&apos;S A MATCH!
            </div>

            <h3 className="mt-2 text-2xl font-black tracking-tight text-neutral-950 dark:text-neutral-50">
              Task Claimed!
            </h3>

            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              You matched with &ldquo;{matchedTask.title}&rdquo;.{' '}
              <strong className="text-emerald-500">{formatMinorUsd(matchedTask.reward.amount_minor)}</strong> has been
              locked in escrow for you.
            </p>

            <div className="mt-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 p-3 text-left font-mono text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Timeout</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">30:00 minutes</span>
              </div>
              <div className="mt-1 flex justify-between text-neutral-500">
                <span>Task ID</span>
                <span className="truncate max-w-[150px]">{matchedTask.id}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMatchModal(false)
                  onOpenDetails(matchedTask)
                }}
                className="w-full rounded-full bg-emerald-500 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-600 active:scale-98 transition-all"
              >
                Submit Proof Now
              </button>
              <button
                type="button"
                onClick={() => setShowMatchModal(false)}
                className="w-full rounded-full border border-neutral-300 dark:border-neutral-700 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Keep Swiping (Claimed to Queue)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
