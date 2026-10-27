import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { listActiveAlertSubscribers, subscribeEarnerAlert } from '@/lib/db'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(254),
})

export async function GET() {
  const subs = await listActiveAlertSubscribers()
  return NextResponse.json({
    ok: true,
    active_subscribers: subs.length,
  })
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please enter a valid email address.',
      },
      { status: 400 },
    )
  }

  try {
    const sub = await subscribeEarnerAlert(parsed.data.email)
    return NextResponse.json({
      ok: true,
      message: "You're on the list — you'll get an email whenever a task opens.",
      subscription: {
        id: sub.id,
        email: sub.email,
        active: sub.active,
        created_at: sub.created_at,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'Could not save subscription' },
      { status: 500 },
    )
  }
}
