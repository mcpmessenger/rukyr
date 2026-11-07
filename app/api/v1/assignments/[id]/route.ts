import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignment = V1Store.getAssignment(id)

  if (!assignment) {
    return NextResponse.json(
      {
        error: {
          code: 'assignment_not_found',
          message: `No assignment found with ID '${id}'`,
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 404, headers: COMMON_HEADERS }
    )
  }

  return NextResponse.json(assignment, { headers: COMMON_HEADERS })
}
