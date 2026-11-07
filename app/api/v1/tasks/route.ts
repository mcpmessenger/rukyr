import { NextRequest, NextResponse } from 'next/server'
import { V1Store } from '@/lib/v1-store'
import { validateCreateTaskRequest } from '@/lib/v1-validation'

export const dynamic = 'force-dynamic'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Rukyr-API-Version': '2026-01-01',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') || undefined
  const client_reference = searchParams.get('client_reference') || undefined
  const work_mode = searchParams.get('work_mode') || undefined
  const task_type = searchParams.get('task_type') || undefined

  const tasks = V1Store.listTasks({
    status,
    client_reference,
    work_mode,
    task_type,
  })

  return NextResponse.json(
    {
      data: tasks,
      pagination: {
        has_more: false,
        total: tasks.length,
      },
    },
    { headers: COMMON_HEADERS }
  )
}

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('idempotency-key')
  const authHeader = req.headers.get('authorization')

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_json',
          message: 'Malformed request JSON body',
          details: [],
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
            message: 'Idempotency key reused with differing request payload',
            details: [],
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

  // Validate request
  const validation = validateCreateTaskRequest(body)
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_task',
          message: validation.errors[0]?.issue || 'Invalid task input',
          details: validation.errors,
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 422, headers: COMMON_HEADERS }
    )
  }

  // Create Task
  const task = V1Store.createTask(validation.data)

  if (idempotencyKey) {
    V1Store.recordIdempotency(idempotencyKey, body, 201, task)
  }

  return NextResponse.json(task, { status: 201, headers: COMMON_HEADERS })
}
