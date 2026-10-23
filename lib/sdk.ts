import type { Task, Proof, TaskType } from './types'

export interface RukyrClientOptions {
  baseUrl?: string
  agentId?: string
}

export interface CreateTaskParams {
  title: string
  description?: string
  taskType?: TaskType
  priceCents: number
  proofRequirements?: 'photo' | 'text' | 'code'
  deadlineMinutes?: number
  executeAt?: string | null
}

export interface WaitOptions {
  timeoutMs?: number
  pollIntervalMs?: number
}

export class RukyrClient {
  private baseUrl: string
  private agentId?: string

  constructor(options: RukyrClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'https://rukyr.vercel.app').replace(/\/$/, '')
    this.agentId = options.agentId
  }

  /**
   * Post a task to Rukyr and initiate PayPal escrow hold.
   * If within Operator Mandate caps, executes headlessly (approveUrl is null, headless is true).
   */
  async createTask(params: CreateTaskParams): Promise<{
    task: Task
    approveUrl: string | null
    headless?: boolean
    mandate?: { remaining_cents: number }
    requiresConsentReason?: string | null
  }> {
    const res = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.agentId ? { 'x-agent-id': this.agentId } : {}),
      },
      body: JSON.stringify({
        title: params.title,
        description: params.description ?? '',
        task_type: params.taskType ?? 'verification',
        price_cents: params.priceCents,
        proof_requirements: params.proofRequirements ?? 'photo',
        deadline_minutes: params.deadlineMinutes ?? 240,
        ...(params.executeAt ? { execute_at: params.executeAt } : {}),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to create task: ${res.statusText}`)
    }

    return res.json()
  }

  /**
   * Retrieve task details and current lifecycle state.
   */
  async getTask(taskId: string): Promise<Task> {
    const res = await fetch(`${this.baseUrl}/api/tasks?status=`)
    if (!res.ok) throw new Error(`Failed to list tasks: ${res.statusText}`)
    const data = await res.json()
    const found = (data.tasks as Task[]).find((t) => t.id === taskId)
    if (!found) throw new Error(`Task ${taskId} not found`)
    return found
  }

  /**
   * Approve a submitted proof, capture escrowed funds, and release payment to the earner.
   */
  async approveTask(taskId: string): Promise<{ task: Task; payout: string }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to approve task: ${res.statusText}`)
    }

    return res.json()
  }

  /**
   * Reject submitted proof and return the task to the earner queue.
   */
  async rejectTask(taskId: string): Promise<{ task: Task }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to reject task: ${res.statusText}`)
    }

    return res.json()
  }

  /**
   * Cancel task and void the PayPal authorization hold.
   */
  async cancelTask(taskId: string): Promise<{ task: Task }> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to cancel task: ${res.statusText}`)
    }

    return res.json()
  }

  /**
   * Poll until a human has submitted proof for the task.
   */
  async waitForProof(taskId: string, options: WaitOptions = {}): Promise<Task> {
    const timeout = options.timeoutMs ?? 10 * 60 * 1000 // 10 minutes default
    const interval = options.pollIntervalMs ?? 3000
    const start = Date.now()

    while (Date.now() - start < timeout) {
      const task = await this.getTask(taskId)
      if (['submitted', 'verified', 'paid'].includes(task.status)) {
        return task
      }
      if (['cancelled', 'expired'].includes(task.status)) {
        throw new Error(`Task ended prematurely with status: ${task.status}`)
      }
      await new Promise((r) => setTimeout(r, interval))
    }

    throw new Error(`Timed out waiting for task proof (${taskId})`)
  }

  /**
   * Fetch all bids submitted for a task.
   */
  async getBids(taskId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/bids`)
    if (!res.ok) throw new Error(`Failed to list bids: ${res.statusText}`)
    const data = await res.json()
    return data.bids || []
  }

  /**
   * Submit an earner bid on an open task.
   */
  async submitBid(taskId: string, params: { bidCents: number; etaMinutes?: number; pitch?: string }) {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bid_cents: params.bidCents,
        eta_minutes: params.etaMinutes ?? 30,
        pitch: params.pitch ?? '',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to submit bid: ${res.statusText}`)
    }
    return res.json()
  }

  /**
   * Accept an earner's bid on a task.
   */
  async acceptBid(taskId: string, bidId: string) {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/bids/${bidId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to accept bid: ${res.statusText}`)
    }
    return res.json()
  }

  /**
   * Discover external client / Upwork jobs available for agents to subcontract.
   */
  async discoverJobs(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : ''
    const res = await fetch(`${this.baseUrl}/api/subcontract/jobs${q}`)
    if (!res.ok) throw new Error(`Failed to discover jobs: ${res.statusText}`)
    return res.json()
  }

  /**
   * Decompose an external contract into Rukyr micro-tasks with escrow holds.
   */
  async subcontractJob(gigId: string) {
    const res = await fetch(`${this.baseUrl}/api/subcontract/jobs/${gigId}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to subcontract job: ${res.statusText}`)
    }
    return res.json()
  }

  /**
   * Inspect a live e-commerce product or Shopify storefront to detect physical verification risks.
   */
  async inspectLiveProduct(params: { url?: string; storeDomain?: string; query?: string }) {
    const res = await fetch(`${this.baseUrl}/api/merchant/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: params.url,
        store_domain: params.storeDomain,
        query: params.query,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to inspect merchant: ${res.statusText}`)
    }
    return res.json()
  }
}
