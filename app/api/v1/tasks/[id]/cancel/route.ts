import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idempotencyKey = req.headers.get('idempotency-key')

  let body: Record<string, any> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // Idempotency check
  if (idempotencyKey) {
    const { conflict, cached } = V1Store.checkIdempotency(idempotencyKey, body)
    if (conflict) {
      return NextResponse.json(
        {
          error: {
            code: 'idempotency_key_conflict',
            message: 'Idempotency key conflict on task cancellation',
            request_id: `req_${Date.now()}`,
          },
        },
        { status: 409, headers: COMMON_HEADERS }
      )
    }
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status, headers: COMMON_HEADERS })
    }
  }

  const reason = body.reason || 'source_work_no_longer_needed'
  const result = V1Store.cancelTask(id, reason)

  if (!result) {
    return NextResponse.json(
      {
        error: {
          code: 'task_not_found',
          message: `Cannot cancel: Task '${id}' not found`,
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 404, headers: COMMON_HEADERS }
    )
  }

  const respData = {
    task: result.task,
    affected_assignments: result.affected_assignments,
  }

  if (idempotencyKey) {
    V1Store.recordIdempotency(idempotencyKey, body, 200, respData)
  }

  return NextResponse.json(respData, { headers: COMMON_HEADERS })
}
