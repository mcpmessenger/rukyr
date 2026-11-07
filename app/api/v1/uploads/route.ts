import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function POST(req: NextRequest) {
  let body: Record<string, any> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const purpose = body.purpose === 'context' ? 'context' : 'evidence'
  const slot = V1Store.createUploadSlot(purpose)

  return NextResponse.json(slot, { status: 201, headers: COMMON_HEADERS })
}
