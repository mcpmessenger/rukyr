import { NextRequest, NextResponse } from 'next/server'
import { V1Store, signWebhookPayload } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function GET() {
  const events = V1Store.listWebhooks()
  const secret = V1Store.getWebhookSecret()

  // Include signature preview for the latest event
  const enriched = events.map((evt) => ({
    ...evt,
    sample_signature_header: signWebhookPayload(evt, secret),
  }))

  return NextResponse.json(
    {
      events: enriched,
      webhook_secret_preview: `${secret.slice(0, 10)}...`,
    },
    { headers: COMMON_HEADERS }
  )
}

export async function POST(req: NextRequest) {
  let body: Record<string, any> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const eventType = body.type || 'task.opened'
  const event = V1Store.emitWebhook(eventType, {
    task_id: body.task_id || 'tsk_01J_sample',
    status: body.status || 'open',
  })

  const secret = V1Store.getWebhookSecret()
  const signature = signWebhookPayload(event, secret)

  return NextResponse.json(
    {
      event,
      rukyr_signature: signature,
      verified: true,
    },
    { status: 201, headers: COMMON_HEADERS }
  )
}
