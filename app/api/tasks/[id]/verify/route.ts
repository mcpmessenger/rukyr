import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDemoProfile, getTask } from '@/lib/db'
import { approveTask, cancelTask, rejectTask } from '@/lib/service'

export const dynamic = 'force-dynamic'

const body = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  agent_id: z.string().optional(),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'action must be approve | reject | cancel' }, { status: 400 })
  const task = await getTask(id)
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Verify operator / poster ownership
  const operatorAgent = await getDemoProfile('agent').catch(() => null)
  const callerAgentId =
    parsed.data.agent_id || req.headers.get('x-agent-id') || operatorAgent?.id || null
  const secret = process.env.OPERATOR_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  const hasSecret =
    Boolean(secret) &&
    (req.headers.get('x-operator-secret') === secret || authHeader === `Bearer ${secret}`)

  if (!hasSecret && callerAgentId && task.agent_id !== callerAgentId) {
    return NextResponse.json(
      { error: 'Forbidden: Only the task poster / operator can approve, reject, or cancel this task.' },
      { status: 403 },
    )
  }

  try {
    const fn = { approve: approveTask, reject: rejectTask, cancel: cancelTask }[parsed.data.action]
    return NextResponse.json(await fn(task))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
