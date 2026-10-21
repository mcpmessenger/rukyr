import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClaimProof } from '@/components/claim-proof'
import { SiteHeader } from '@/components/site-header'
import { StatusBadge, timeLeft } from '@/components/task-card'
import { getDemoProfile, getTask, listBidsForTask, listTasks } from '@/lib/db'
import { TASK_TYPE_LABEL, usd } from '@/lib/types'
import { ArrowLeft, Clock, ShieldCheck } from 'lucide-react'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const task = await getTask(id)
  if (!task) return { title: 'Task Not Found' }
  return {
    title: task.title,
    description: task.description || `Micro-task on Rukyr: ${task.title}. Reward: ${usd(task.price_cents)}.`,
    alternates: { canonical: `/earn/tasks/${id}` },
    openGraph: {
      title: `${task.title} - ${usd(task.price_cents)} on Rukyr`,
      description: task.description || `Micro-task on Rukyr: ${task.title}. Reward: ${usd(task.price_cents)}.`,
    },
  }
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await listTasks() // lazy sweep so stale claims reopen
  const [task, bids] = await Promise.all([getTask(id), listBidsForTask(id)])
  if (!task) notFound()
  const human = await getDemoProfile('human')
  const mine = task.claimed_by === human.id
  const stage =
    task.status === 'open'
      ? 'open'
      : task.status === 'claimed' && mine
      ? 'claimed'
      : mine && ['submitted', 'verified', 'paid'].includes(task.status)
      ? 'mine-submitted'
      : 'unavailable'

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <div className="mx-auto max-w-xl px-5 pb-24 pt-4 sm:px-6">
        <Link
          href="/earn"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to all tasks
        </Link>

        <div className="mt-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 sm:p-7 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                {TASK_TYPE_LABEL[task.task_type]}
              </span>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                {task.title}
              </h1>
            </div>
            <span className="font-mono text-xl sm:text-2xl font-bold text-[#cf6a42] dark:text-[#f4a261] shrink-0">
              {usd(task.price_cents)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-500 border-y border-neutral-200 dark:border-neutral-800 py-3">
            <StatusBadge status={task.status} />
            <span className="flex items-center gap-1 font-mono">
              <Clock className="size-3.5" /> {timeLeft(task.deadline_at)}
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-[#8bd3a8]" /> Proof: {task.proof_requirements}
            </span>
          </div>

          <div className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Task Instructions
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {task.description || 'No extra instructions provided by the agent.'}
            </p>
          </div>

          <div className="mt-8 border-t border-neutral-200 dark:border-neutral-800 pt-6">
            <ClaimProof
              taskId={task.id}
              taskPriceCents={task.price_cents}
              stage={stage}
              claimedAt={task.claimed_at}
              proofRequirements={task.proof_requirements}
              initialBids={bids}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
