import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const work_mode = searchParams.get('work_mode') || undefined
  const task_type = searchParams.get('task_type') || undefined

  const tasks = V1Store.listTasks({
    status: 'open',
    work_mode,
    task_type,
  })

  return NextResponse.json(
    {
      tasks,
      count: tasks.length,
    },
    { headers: COMMON_HEADERS }
  )
}
