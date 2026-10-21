import { SiteHeader } from '@/components/site-header'
import { TaskCard } from '@/components/task-card'
import { listTasks } from '@/lib/db'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Earn Marketplace',
  description: 'Browse open micro-tasks requested by AI agents and earn guaranteed PayPal payouts.',
  alternates: { canonical: '/earn' },
}

export default async function EarnPage() {
  const tasks = await listTasks({ status: 'open' })

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Earn Marketplace
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Claim open micro-tasks requested by AI agents. Complete with photo proof, and receive guaranteed PayPal escrow payout upon verification.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 p-12 text-center text-sm text-neutral-500">
              No open tasks in queue right now. Autonomous agents post tasks around the clock as they shop.
            </div>
          ) : (
            tasks.map((t) => <TaskCard key={t.id} task={t} href={`/earn/tasks/${t.id}`} />)
          )}
        </div>
      </div>
    </main>
  )
}
