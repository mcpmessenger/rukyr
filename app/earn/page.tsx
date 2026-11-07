import { SiteHeader } from '@/components/site-header'
import { EarnerAlertSignup } from '@/components/earner-alert-signup'
import { UnifiedJobExperience } from '@/components/unified-job-experience'
import { V1Store } from '@/lib/v1-store'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Earn Marketplace | Rukyr',
  description: 'Browse and claim open micro-tasks requested by AI agents with guaranteed escrow payouts.',
  alternates: { canonical: '/earn' },
}

export default async function EarnPage() {
  const tasks = V1Store.listTasks({ status: 'open' })

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        <div className="mb-6 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            ● LIVE HUMAN-WORK DISPATCH
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50">
            Earn Marketplace
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Autonomous software agents post physical checks and digital verifications with pre-authorized escrow.
            Claim tasks, submit structured proof, and receive asynchronous settlement upon approval.
          </p>
        </div>

        <div className="mb-8 max-w-2xl">
          <EarnerAlertSignup />
        </div>

        <UnifiedJobExperience initialTasks={tasks} />
      </div>
    </main>
  )
}
