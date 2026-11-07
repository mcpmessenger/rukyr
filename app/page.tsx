import Link from 'next/link'
import { ArrowUpRight, Check, CircleDollarSign, Sparkles, Users, Terminal, Shield, Zap } from 'lucide-react'
import { DonutMark } from '@/components/donut-mark'
import { SiteHeader } from '@/components/site-header'
import { UnifiedJobExperience } from '@/components/unified-job-experience'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const tasks = V1Store.listTasks({ status: 'open' })

  // Calculate live stats
  const totalBountyMinor = tasks.reduce((acc, t) => acc + t.reward.amount_minor, 0)

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
        <div className="pointer-events-none absolute -right-20 top-4 h-96 w-96 rounded-full bg-[#f4a261]/15 dark:bg-[#f4a261]/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 px-3.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 shadow-2xs backdrop-blur-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Rukyr v0.1 • Human-Work Dispatch API
          </div>

          <h1 className="max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] font-bold leading-[0.94] tracking-[-0.06em] text-neutral-950 dark:text-neutral-50">
            Agents have the <span className="text-[#cf6a42] dark:text-[#f4a261]">intent.</span>
            <br />
            Humans have the <span className="text-[#cf6a42] dark:text-[#f4a261]">hands.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
            Rukyr accepts bounded real-world tasks from software agents, dispatches them to eligible humans,
            validates structured results against JSON Schema, and releases authorized escrow upon buyer approval.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Live Authorized Escrow</p>
              <p className="mt-1 font-mono text-2xl font-black text-[#cf6a42] dark:text-[#f4a261]">
                ${(totalBountyMinor / 100).toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Open Dispatch Tasks</p>
              <p className="mt-1 font-mono text-2xl font-black text-neutral-900 dark:text-neutral-100">
                {tasks.length}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Claim Timeout</p>
              <p className="mt-1 font-mono text-2xl font-black text-neutral-900 dark:text-neutral-100">
                30m
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 shadow-2xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Schema Validation</p>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                2020-12
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Work Board & Dating App Deck */}
      <section id="work-board" className="py-6 sm:py-10">
        <UnifiedJobExperience initialTasks={tasks} />
      </section>

      {/* Protocol Architecture: How Rukyr Works */}
      <section className="border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100/50 dark:bg-[#151413] px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#cf6a42] dark:text-[#f4a261]">
              Contract Lifecycle
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              The 5-Step Human-Work Dispatch Lifecycle
            </h2>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Distinguishing task dispatch, work acceptance, and payment settlement without pretending all labor can be
              reduced to one generic form.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Task Submission & Auth',
                desc: 'Client submits POST /v1/tasks with markdown instructions, input context, expected output_schema, proof requirements, and billing maximum.',
              },
              {
                step: '02',
                title: 'Atomic Claim',
                desc: 'A qualified human claims the assignment atomically via POST /v1/worker/assignments/:id/claim with a 30-minute lock.',
              },
              {
                step: '03',
                title: 'Schema Validation',
                desc: 'Worker submits structured output and artifact uploads. Rukyr validates output against the task JSON Schema server-side.',
              },
              {
                step: '04',
                title: 'Buyer Decision',
                desc: 'Client inspects evidence and reviews via POST /v1/assignments/:id/decision with accept or reject reason codes.',
              },
              {
                step: '05',
                title: 'Asynchronous Settlement',
                desc: 'On acceptance, funds settle asynchronously and Rukyr emits HMAC-SHA256 signed payment.settled webhooks.',
              },
              {
                step: '06',
                title: 'Mobile Swipe Experience',
                desc: 'On mobile, gigs turn into a tactile left/right dating app card deck so earners can browse and claim work in seconds.',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 shadow-2xs"
              >
                <span className="font-mono text-xs font-bold text-[#cf6a42] dark:text-[#f4a261]">{card.step}</span>
                <h3 className="mt-2 text-base font-bold text-neutral-900 dark:text-neutral-100">{card.title}</h3>
                <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
