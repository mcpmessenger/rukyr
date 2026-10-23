import {
  getEscrow,
  getProfile,
  refundMandateSpend,
  updateTask,
  upsertEscrow,
} from './db'
import { notify } from './email'
import { captureAuthorization, payEarner, voidAuthorization } from './paypal'
import type { Task } from './types'
import { usd } from './types'

/** Agent approved the proof: capture the hold and pay the earner. */
export async function approveTask(task: Task) {
  if (task.status !== 'submitted') throw new Error(`Task is ${task.status}, not submitted`)
  const escrow = await getEscrow(task.id)
  if (!escrow?.paypal_authorization_id) throw new Error('No funded escrow for this task')

  await captureAuthorization(escrow.paypal_authorization_id)
  await upsertEscrow({
    task_id: task.id,
    amount_cents: escrow.amount_cents,
    status: 'captured',
    captured_at: new Date().toISOString(),
  })
  const human = task.claimed_by ? await getProfile(task.claimed_by) : null
  const payout = human?.paypal_email
    ? await payEarner({ email: human.paypal_email, cents: task.price_cents, taskId: task.id })
    : 'NO_EMAIL'
  const updated = await updateTask(task.id, { status: 'paid' })
  await notify(
    human?.paypal_email,
    `You earned ${usd(task.price_cents)} on Rukyr`,
    `Your proof for "${task.title}" was approved. Payout reference: ${payout}.`,
  )
  return { task: updated, payout }
}

/** Proof rejected: keep the hold and return the task to the queue. */
export async function rejectTask(task: Task) {
  if (task.status !== 'submitted') throw new Error(`Task is ${task.status}, not submitted`)
  const human = task.claimed_by ? await getProfile(task.claimed_by) : null
  const updated = await updateTask(task.id, { status: 'open', claimed_by: null, claimed_at: null })
  await notify(
    human?.paypal_email,
    'Your proof was not accepted',
    `Your proof for "${task.title}" was rejected and the task is open again.`,
  )
  return { task: updated }
}

/** Cancel the task, release the PayPal hold, and refund the mandate spend pool. */
export async function cancelTask(task: Task) {
  if (['paid', 'cancelled', 'expired'].includes(task.status)) throw new Error(`Task is already ${task.status}`)
  const escrow = await getEscrow(task.id)
  const wasHeld = escrow?.status === 'held'
  if (escrow?.paypal_authorization_id && wasHeld) {
    await voidAuthorization(escrow.paypal_authorization_id)
  }
  if (escrow) {
    await upsertEscrow({ task_id: task.id, amount_cents: escrow.amount_cents, status: 'voided' })
    if (wasHeld) {
      await refundMandateSpend(escrow.amount_cents)
    }
  }
  return { task: await updateTask(task.id, { status: 'cancelled' }) }
}
