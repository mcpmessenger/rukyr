import { SiteHeader } from '@/components/site-header'
import { AgentConsole, type ConsoleItem, type Prefill } from '@/components/agent-console'
import {
  getDemoProfile,
  getEscrow,
  getLatestProof,
  getOperatorMandate,
  getStats,
  listBidsForTask,
  listTasks,
} from '@/lib/db'
import { discoverExternalGigs } from '@/lib/subcontract'
import type { Task, TaskType } from '@/lib/types'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Agent Console',
  description: 'Post and manage real-world micro-tasks, inspect earner offers, and monitor PayPal Vault spend.',
  alternates: { canonical: '/agent' },
}

const FLASH: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  funded: { kind: 'ok', text: 'PayPal hold approved. Your task is live.' },
  funding_cancelled: { kind: 'err', text: 'PayPal approval was cancelled; the task was not posted.' },
  authorize_failed: { kind: 'err', text: 'PayPal could not authorize the hold. Try again.' },
  unknown_task: { kind: 'err', text: 'Unknown task.' },
  vault_authorized: { kind: 'ok', text: 'Operator mandate authorized via PayPal Vault. Headless escrow active.' },
  vault_cancelled: { kind: 'err', text: 'PayPal Vault mandate approval was cancelled.' },
  vault_error: { kind: 'err', text: 'PayPal Vault mandate could not be verified. Please authorize again.' },
}

export default async function AgentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  let tasks: Task[] = []
  let fetchError: string | null = null

  const [tasksResult, stats, externalGigs, mandate, agentProfile] = await Promise.all([
    listTasks().catch((err: unknown) => {
      fetchError = (err as Error)?.message || 'Failed to load tasks from database'
      return [] as Task[]
    }),
    getStats().catch(() => ({ escrowed_cents: 0, released_cents: 0, open: 0, paid: 0, total: 0 })),
    discoverExternalGigs().catch(() => []),
    getOperatorMandate().catch(() => undefined),
    getDemoProfile('agent').catch(() => null),
  ])
  tasks = tasksResult

  const items: ConsoleItem[] = await Promise.all(
    tasks.map(async (task) => ({
      task,
      escrow: await getEscrow(task.id).catch(() => null),
      proof:
        task.status === 'submitted' || task.status === 'paid' || task.status === 'verified'
          ? await getLatestProof(task.id).catch(() => null)
          : null,
      bids: await listBidsForTask(task.id).catch(() => []),
    })),
  )

  const prefill: Prefill | undefined = sp.title
    ? {
        title: sp.title,
        description: sp.description,
        task_type: (sp.type as TaskType) ?? 'verification',
        price_cents: sp.price ? Number(sp.price) : undefined,
        proof_requirements: sp.proof,
      }
    : undefined

  const flash = sp.funded
    ? FLASH.funded
    : sp.vault === 'authorized'
    ? mandate?.vault_status === 'active' && mandate?.vault_id
      ? FLASH.vault_authorized
      : FLASH.vault_error
    : sp.vault === 'cancelled'
    ? FLASH.vault_cancelled
    : sp.vault === 'error'
    ? FLASH.vault_error
    : sp.error
    ? FLASH[sp.error] ?? null
    : null

  const initialTaskId = typeof sp.task === 'string' && sp.task.trim() ? sp.task.trim() : undefined

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <AgentConsole
        items={items}
        stats={stats}
        prefill={prefill}
        flash={flash}
        externalGigs={externalGigs}
        initialMandate={mandate}
        initialTaskId={initialTaskId}
        fetchError={fetchError}
        currentAgentId={agentProfile?.id}
      />
    </main>
  )
}
