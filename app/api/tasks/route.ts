import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createTask,
  getDemoProfile,
  getOperatorMandate,
  listTasks,
  notifySubscribers,
  recordMandateSpend,
  updateTask,
  upsertEscrow,
} from '@/lib/db'
import { authorizeOrder, createHold, feeFor } from '@/lib/paypal'
import { notify } from '@/lib/email'

export const dynamic = 'force-dynamic'

const body = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(1000).default(''),
  task_type: z.enum(['verification', 'bot_gate', 'phone_call', 'taste_call', 'local_presence', 'spend_approval']),
  price_cents: z.number().int().min(50).max(1000),
  proof_requirements: z.enum(['photo', 'text', 'code']).default('photo'),
  deadline_minutes: z.number().int().min(10).max(60 * 24 * 7).default(240),
  execute_at: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  return NextResponse.json({ tasks: await listTasks({ status }) })
}

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid task', issues: parsed.error.issues }, { status: 400 })
  }
  const input = parsed.data

  let executeAtIso: string | null = null
  let isScheduled = false
  if (input.execute_at && input.execute_at.trim() !== '') {
    const execMs = Date.parse(input.execute_at)
    if (Number.isNaN(execMs)) {
      return NextResponse.json({ error: 'Invalid execute_at timestamp' }, { status: 400 })
    }
    if (execMs < Date.now() - 60_000) {
      return NextResponse.json({ error: 'execute_at cannot be in the past' }, { status: 400 })
    }
    if (execMs > Date.now()) {
      isScheduled = true
      executeAtIso = new Date(execMs).toISOString()
    }
  }

  const agent = await getDemoProfile('agent')
  const fee = feeFor(input.price_cents)
  const total = input.price_cents + fee

  const mandate = await getOperatorMandate()
  const canUseVault =
    mandate.vault_status === 'active' &&
    Boolean(mandate.vault_id) &&
    input.price_cents <= mandate.per_task_cap_cents &&
    mandate.spent_this_week_cents + total <= mandate.weekly_cap_cents

  const baseStartMs = isScheduled && executeAtIso ? Date.parse(executeAtIso) : Date.now()
  const task = await createTask({
    agent_id: agent.id,
    title: input.title,
    description: input.description,
    task_type: input.task_type,
    price_cents: input.price_cents,
    proof_requirements: input.proof_requirements,
    deadline_at: new Date(baseStartMs + input.deadline_minutes * 60_000).toISOString(),
    execute_at: executeAtIso,
    deadline_minutes: input.deadline_minutes,
    status: 'pending_funding',
  })

  try {
    const origin = req.nextUrl.origin
    const hold = await createHold({
      taskId: task.id,
      totalCents: total,
      returnUrl: `${origin}/api/paypal/return?task=${task.id}`,
      cancelUrl: `${origin}/api/paypal/cancel?task=${task.id}`,
      description: `Rukyr task: ${task.title}`,
      vaultId: canUseVault ? mandate.vault_id : null,
    })
    await upsertEscrow({
      task_id: task.id,
      amount_cents: total,
      platform_fee_cents: fee,
      paypal_order_id: hold.orderId,
      status: 'pending',
    })

    if (hold.approveUrl) {
      return NextResponse.json(
        {
          task,
          approveUrl: hold.approveUrl,
          headless: false,
          requiresConsentReason: canUseVault
            ? null
            : input.price_cents > mandate.per_task_cap_cents
            ? `Price (${input.price_cents / 100}) exceeds operator mandate cap of $${(mandate.per_task_cap_cents / 100).toFixed(2)}`
            : 'Operator mandate limit reached',
        },
        { status: 201 },
      )
    }

    // Headless Vault MIT or auto-approved hold: no operator approval needed!
    const authId = hold.authorizationId || (await authorizeOrder(hold.orderId))
    await upsertEscrow({
      task_id: task.id,
      amount_cents: total,
      paypal_authorization_id: authId,
      status: 'held',
    })
    const targetStatus = isScheduled ? 'scheduled' : 'open'
    const updated = await updateTask(task.id, {
      status: targetStatus,
      execute_at: executeAtIso,
      deadline_minutes: input.deadline_minutes,
    })
    if (canUseVault) {
      await recordMandateSpend(total)
    }
    if (!isScheduled) {
      await notifySubscribers(updated)
    }
    await notify(
      agent.paypal_email,
      isScheduled ? 'Task scheduled' : 'Task posted',
      isScheduled
        ? `"${task.title}" is scheduled for ${executeAtIso}. ${total / 100} USD held in escrow via PayPal Vault.`
        : `"${task.title}" is live. ${total / 100} USD held in escrow via PayPal Vault.`,
    )
    return NextResponse.json(
      {
        task: updated,
        approveUrl: null,
        headless: true,
        mandate: {
          remaining_cents: Math.max(0, mandate.weekly_cap_cents - mandate.spent_this_week_cents - total),
        },
      },
      { status: 201 },
    )
  } catch (e) {
    await updateTask(task.id, { status: 'cancelled' })
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

