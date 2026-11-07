import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'
import { validateDecision } from '@/lib/v1-validation'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idempotencyKey = req.headers.get('idempotency-key')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_json',
          message: 'Malformed request JSON body',
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 400, headers: COMMON_HEADERS }
    )
  }

  // Idempotency check
  if (idempotencyKey) {
    const { conflict, cached } = V1Store.checkIdempotency(idempotencyKey, body)
    if (conflict) {
      return NextResponse.json(
        {
          error: {
            code: 'idempotency_key_conflict',
            message: 'Idempotency conflict on assignment decision',
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

  const validation = validateDecision(body)
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_decision',
          message: validation.errors[0]?.issue || 'Invalid decision input',
          details: validation.errors,
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 422, headers: COMMON_HEADERS }
    )
  }

  const result = V1Store.decideAssignment(id, validation.data)
  if (!result.success || !result.assignment) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_assignment_state',
          message: result.error || 'Failed to apply decision',
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 409, headers: COMMON_HEADERS }
    )
  }

  const responseData = {
    assignment: result.assignment,
  }

  if (idempotencyKey) {
    V1Store.recordIdempotency(idempotencyKey, body, 200, responseData)
  }

  return NextResponse.json(responseData, { headers: COMMON_HEADERS })
}
