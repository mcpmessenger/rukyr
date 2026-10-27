import { NextRequest, NextResponse } from 'next/server'
import { getEscrow, getTask, notifySubscribers, updateTask, upsertEscrow } from '@/lib/db'
import { authorizeOrder } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

/** PayPal redirects here after the operator approves the hold. */
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('task')
  const task = taskId ? await getTask(taskId) : null
  const escrow = taskId ? await getEscrow(taskId) : null
  if (!task || !escrow?.paypal_order_id) return NextResponse.redirect(new URL('/agent?error=unknown_task', req.url))
  try {
    if (task.status === 'pending_funding') {
      const authId = await authorizeOrder(escrow.paypal_order_id)
      await upsertEscrow({ task_id: task.id, amount_cents: escrow.amount_cents, paypal_authorization_id: authId, status: 'held' })
      const isScheduled = Boolean(task.execute_at && Date.parse(task.execute_at) > Date.now())
      const updated = await updateTask(task.id, { status: isScheduled ? 'scheduled' : 'open' })
      if (!isScheduled) {
        await notifySubscribers(updated)
      }
    }
    return NextResponse.redirect(new URL('/agent?funded=1', req.url))
  } catch (e) {
    console.error('[paypal/return]', e)
    return NextResponse.redirect(new URL('/agent?error=authorize_failed', req.url))
  }
}
