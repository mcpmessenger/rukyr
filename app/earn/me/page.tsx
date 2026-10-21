import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { StatusBadge } from '@/components/task-card'
import { getDemoProfile, listTasks } from '@/lib/db'
import { usd } from '@/lib/types'
import { Star, ArrowRight } from 'lucide-react'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Earnings',
  description: 'Track your completed task earnings, reputation score, and PayPal disbursements.',
  alternates: { canonical: '/earn/me' },
}

export default async function EarningsPage() {
  const human = await getDemoProfile('human')
  const mine = (await listTasks()).filter(
    (t) => t.claimed_by === human.id || (t.status === 'paid' && t.claimed_by === human.id),
  )
  const paid = mine.filter((t) => t.status === 'paid').reduce((s, t) => s + t.price_cents, 0)
  const pending = mine
    .filter((t) => ['claimed', 'submitted'].includes(t.status))
    .reduce((s, t) => s + t.price_cents, 0)

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              My Earnings
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
              Authenticated earner profile:{' '}
              <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                {human.display_name}
              </span>
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#1a1918] px-3.5 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200 shadow-2xs self-start sm:self-auto">
            <Star className="size-3.5 fill-amber-400 text-amber-500" />
            <span>Reputation {human.reputation.toFixed(1)} / 5.0</span>
          </div>
        </div>

        {/* Balance cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Total Paid Out
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-[#8bd3a8]">
              {usd(paid)}
            </p>
            <p className="mt-2 text-xs text-neutral-400">Captured and disbursed to PayPal account.</p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Pending in Escrow
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#cf6a42] dark:text-[#f4a261]">
              {usd(pending)}
            </p>
            <p className="mt-2 text-xs text-neutral-400">Locked in PayPal escrow pending verification.</p>
          </div>
        </div>

        {/* Task history */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            Task Activity ({mine.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {mine.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 text-center text-sm text-neutral-500">
                You haven&apos;t claimed any tasks yet.{' '}
                <Link className="font-semibold underline text-[#cf6a42] dark:text-[#f4a261]" href="/earn">
                  Find open tasks
                </Link>
                .
              </div>
            ) : (
              mine.map((t) => (
                <Link
                  key={t.id}
                  href={`/earn/tasks/${t.id}`}
                  className="group flex items-center justify-between rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#1a1918] px-4 py-3 text-sm transition-all hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs"
                >
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-[#cf6a42] dark:group-hover:text-[#f4a261] transition-colors">
                    {t.title}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={t.status} />
                    <span className="font-mono font-semibold text-[#cf6a42] dark:text-[#f4a261]">
                      {usd(t.price_cents)}
                    </span>
                    <ArrowRight className="size-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
