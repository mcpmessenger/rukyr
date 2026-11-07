import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: any
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

  const result = V1Store.submitAssignment(id, body)

  if (!result.success || !result.submission) {
    return NextResponse.json(
      {
        error: {
          code: 'submission_failed',
          message: result.error || 'Failed to submit assignment',
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 422, headers: COMMON_HEADERS }
    )
  }

  return NextResponse.json(
    {
      submission: result.submission,
      assignment: result.assignment,
      message: 'Submission received and validated against output_schema.',
    },
    { status: 201, headers: COMMON_HEADERS }
  )
}
