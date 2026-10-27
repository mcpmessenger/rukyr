import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeEarnerAlertByToken } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() || ''
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing unsubscribe token' }, { status: 400 })
  }
  const sub = await unsubscribeEarnerAlertByToken(token)
  if (!sub) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired unsubscribe token' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    message: 'You have been unsubscribed from Rukyr task alerts.',
    email: sub.email,
    active: sub.active,
    unsubscribed_at: sub.unsubscribed_at,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = (body?.token || req.nextUrl.searchParams.get('token') || '').trim()
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing unsubscribe token' }, { status: 400 })
  }
  const sub = await unsubscribeEarnerAlertByToken(token)
  if (!sub) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired unsubscribe token' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    message: 'You have been unsubscribed from Rukyr task alerts.',
    email: sub.email,
    active: sub.active,
    unsubscribed_at: sub.unsubscribed_at,
  })
}
