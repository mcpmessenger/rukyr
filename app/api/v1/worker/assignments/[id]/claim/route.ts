import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: Record<string, any> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const workerId = body.worker_id || 'wrk_01J_earner_live'
  const result = V1Store.claimAssignment(id, workerId)

  if (!result.success || !result.assignment) {
    return NextResponse.json(
      {
        error: {
          code: 'claim_conflict',
          message: result.error || 'Assignment cannot be claimed',
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 409, headers: COMMON_HEADERS }
    )
  }

  return NextResponse.json(
    {
      assignment: result.assignment,
      message: 'Assignment claimed successfully. You have 30 minutes to submit proof.',
    },
    { headers: COMMON_HEADERS }
  )
}
