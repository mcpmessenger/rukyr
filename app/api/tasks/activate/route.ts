import { NextRequest, NextResponse } from 'next/server'
import { sweepTasks } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Activates due scheduled tasks (scheduled -> open, starting their claim window at activation)
 * and runs the stale-claim / deadline sweep in a single idempotent pass.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await sweepTasks()
  return NextResponse.json({
    ok: true,
    ...result,
    checked_at: new Date().toISOString(),
  })
}
