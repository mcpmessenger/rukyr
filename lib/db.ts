import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { sendTaskAlertEmail } from './email'
import { voidAuthorization } from './paypal'
import {
  CLAIM_TIMEOUT_MS,
  type Escrow,
  type Profile,
  type Proof,
  type Task,
  type Bid,
  type OperatorMandate,
  type EarnerAlertSubscription,
  type AlertDelivery,
} from './types'

/**
 * Data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are set; otherwise falls back to an in-memory store seeded with demo data so the
 * whole loop is demoable with zero configuration (resets on server restart).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
export const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY)

let _sb: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!_sb) _sb = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } })
  return _sb
}

// ---------- in-memory fallback ----------
interface Mem {
  profiles: Profile[]
  tasks: Task[]
  proofs: Proof[]
  escrows: Escrow[]
  bids: Bid[]
  mandate: OperatorMandate
  alertSubscriptions: EarnerAlertSubscription[]
  alertDeliveries: AlertDelivery[]
}
const g = globalThis as unknown as { __rukyrMem?: Mem }

function seed(): Mem {
  const now = Date.now()
  const iso = (ms: number) => new Date(ms).toISOString()
  const agent: Profile = {
    id: randomUUID(), kind: 'agent', display_name: 'glazyr-shopper-01',
    paypal_email: 'agent@example.com', reputation: 5, created_at: iso(now),
  }
  const human: Profile = {
    id: randomUUID(), kind: 'human', display_name: 'demo-earner',
    paypal_email: 'human@example.com', reputation: 4.9, created_at: iso(now),
  }
  const mk = (
    title: string, description: string, task_type: Task['task_type'],
    price_cents: number, proof: string, minsLeft: number,
  ): [Task, Escrow] => {
    const id = randomUUID()
    const fee = Math.round(price_cents * 0.15)
    return [
      {
        id, agent_id: agent.id, title, description, task_type, price_cents,
        status: 'open', proof_requirements: proof, claimed_by: null, claimed_at: null,
        deadline_at: iso(now + minsLeft * 60_000), created_at: iso(now),
      },
      {
        id: randomUUID(), task_id: id, paypal_order_id: 'MOCK-' + id.slice(0, 8),
        paypal_authorization_id: 'MOCK-AUTH-' + id.slice(0, 8),
        amount_cents: price_cents + fee, platform_fee_cents: fee, status: 'held',
        created_at: iso(now), captured_at: null,
      },
    ]
  }
  const seeded = [
    mk('Verify tee color in listing photo vs. real life',
      'The agent is buying a vintage band tee. The listing photo shows faded black, but the agent suspects navy. Find a similar item or visit the store and photograph it in daylight.',
      'verification', 300, 'photo', 28),
    mk('Call a local store and check stock',
      'Call the store and confirm whether size M is in stock. Submit the name of the person you spoke to and what they said.',
      'phone_call', 650, 'text', 120),
    mk('Confirm a product detail from the shelf',
      'Read the ingredient list on the product and submit the first five ingredients.',
      'local_presence', 175, 'text', 240),
  ]
  return {
    profiles: [agent, human],
    tasks: seeded.map((s) => s[0]),
    proofs: [],
    escrows: seeded.map((s) => s[1]),
    bids: [],
    mandate: {
      vault_id: null,
      vault_status: 'unauthorized',
      weekly_cap_cents: 5000,
      spent_this_week_cents: 0,
      per_task_cap_cents: 500,
      operator_email: 'operator@rukyr.ai',
      last_authorized_at: null,
    },
    alertSubscriptions: [],
    alertDeliveries: [],
  }
}
function mem(): Mem {
  if (!g.__rukyrMem) g.__rukyrMem = seed()
  return g.__rukyrMem
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

// ---------- profiles ----------
export async function getDemoProfile(kind: 'agent' | 'human'): Promise<Profile> {
  if (!usingSupabase) return mem().profiles.find((p) => p.kind === kind)!
  const rows = must(
    await sb()
      .from('profiles')
      .select('*')
      .eq('kind', kind)
      .neq('display_name', '__operator_mandate__')
      .neq('display_name', '__scheduled_tasks__')
      .neq('display_name', '__earner_alerts__')
      .order('created_at')
      .limit(1),
  ) as Profile[]
  if (!rows.length) throw new Error(`No ${kind} profile found. Run supabase/schema.sql`)
  return rows[0]
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!usingSupabase) return mem().profiles.find((p) => p.id === id) ?? null
  const r = await sb().from('profiles').select('*').eq('id', id).maybeSingle()
  return (must(r) as Profile | null) ?? null
}

// ---------- task schedule metadata (zero-migration Supabase persistence) ----------
const SCHEDULE_PROFILE_ID = '00000000-0000-0000-0000-000000000002'

interface TaskScheduleMeta {
  status?: Task['status']
  execute_at: string | null
  deadline_minutes: number
  status_reason?: string | null
}

async function getScheduleMap(): Promise<Record<string, TaskScheduleMeta>> {
  if (!usingSupabase) return {}
  try {
    const r = await sb().from('profiles').select('paypal_email').eq('id', SCHEDULE_PROFILE_ID).maybeSingle()
    if (!r.error && r.data?.paypal_email) {
      return JSON.parse(r.data.paypal_email) as Record<string, TaskScheduleMeta>
    }
  } catch (err: any) {
    console.warn('Supabase schedule map read warning:', err?.message || err)
  }
  return {}
}

async function saveScheduleMap(map: Record<string, TaskScheduleMeta>): Promise<void> {
  if (!usingSupabase) return
  try {
    await sb().from('profiles').upsert(
      {
        id: SCHEDULE_PROFILE_ID,
        kind: 'agent',
        display_name: '__scheduled_tasks__',
        paypal_email: JSON.stringify(map),
        reputation: 5,
      },
      { onConflict: 'id' },
    )
  } catch (err: any) {
    console.warn('Supabase schedule map write warning:', err?.message || err)
  }
}

function hydrateTask(row: Task, map: Record<string, TaskScheduleMeta>): Task {
  const m = map[row.id]
  if (!m) {
    return {
      ...row,
      execute_at: row.execute_at ?? null,
      deadline_minutes: row.deadline_minutes ?? 240,
      status_reason: row.status_reason ?? null,
    }
  }
  const effectiveStatus =
    row.status === 'pending_funding' && m.status === 'scheduled' ? 'scheduled' : m.status === 'expired' && row.status === 'expired' ? 'expired' : row.status
  return {
    ...row,
    status: effectiveStatus,
    execute_at: row.execute_at ?? m.execute_at ?? null,
    deadline_minutes: row.deadline_minutes ?? m.deadline_minutes ?? 240,
    status_reason: row.status_reason ?? m.status_reason ?? null,
  }
}

// ---------- tasks ----------
/**
 * Activate scheduled tasks whose execute_at timestamp has arrived.
 * Starts the claim window (deadline_at = now + deadline_minutes) at activation time.
 * If the operator mandate was revoked while scheduled, expires the task and voids the hold.
 */
export async function activateDueTasks(): Promise<{
  activated: string[]
  expired_scheduled: string[]
  alerts: { sent: number; skipped: number; failed: number }
}> {
  const now = Date.now()
  const all = await listTasks({ sweep: false })
  const due = all.filter(
    (t) => t.status === 'scheduled' && t.execute_at && Date.parse(t.execute_at) <= now,
  )
  const alerts = { sent: 0, skipped: 0, failed: 0 }
  if (!due.length) return { activated: [], expired_scheduled: [], alerts }

  const mandate = await getOperatorMandate()
  const activated: string[] = []
  const expired_scheduled: string[] = []

  for (const t of due) {
    // Check if task is still scheduled (idempotent guard)
    const fresh = await getTask(t.id)
    if (!fresh || fresh.status !== 'scheduled') continue

    if (mandate.vault_status !== 'active') {
      const esc = await getEscrow(t.id)
      if (esc?.status === 'held' || esc?.status === 'pending') {
        try {
          if (esc.paypal_authorization_id) await voidAuthorization(esc.paypal_authorization_id)
        } catch (e) {
          console.error('[activate] void failed on revoked mandate', e)
        }
        await upsertEscrow({ task_id: t.id, amount_cents: esc.amount_cents, status: 'voided' })
        if (esc.status === 'held') {
          await refundMandateSpend(esc.amount_cents)
        }
      }
      await updateTask(t.id, {
        status: 'expired',
        status_reason:
          'Operator Budget Mandate was revoked before scheduled activation time. Escrow hold voided.',
      })
      expired_scheduled.push(t.id)
      continue
    }

    const mins =
      fresh.deadline_minutes ??
      (fresh.deadline_at && fresh.execute_at
        ? Math.max(10, Math.round((Date.parse(fresh.deadline_at) - Date.parse(fresh.execute_at)) / 60_000))
        : 240)
    const newDeadlineAt = new Date(now + mins * 60_000).toISOString()

    const opened = await updateTask(t.id, {
      status: 'open',
      deadline_at: newDeadlineAt,
      deadline_minutes: mins,
    })
    activated.push(t.id)
    try {
      const res = await notifySubscribers(opened)
      alerts.sent += res.sent
      alerts.skipped += res.skipped
      alerts.failed += res.failed
    } catch (err) {
      console.error('[activate] notifySubscribers failed for task', t.id, err)
    }
  }

  return { activated, expired_scheduled, alerts }
}

/** Activate due scheduled tasks, return stale claims to the queue, and expire tasks past their deadline. */
export async function sweepTasks(): Promise<{
  activated: string[]
  expired_scheduled: string[]
  reopened: string[]
  expired: string[]
  alerts: { sent: number; skipped: number; failed: number }
}> {
  const { activated, expired_scheduled, alerts } = await activateDueTasks()
  const now = Date.now()
  const all = await listTasks({ sweep: false })
  const reopened: string[] = []
  const expired: string[] = []
  for (const t of all) {
    if (t.status === 'claimed' && t.claimed_at && now - Date.parse(t.claimed_at) > CLAIM_TIMEOUT_MS) {
      await updateTask(t.id, { status: 'open', claimed_by: null, claimed_at: null })
      reopened.push(t.id)
    } else if (
      (t.status === 'open' || t.status === 'pending_funding') &&
      t.deadline_at && Date.parse(t.deadline_at) < now
    ) {
      await updateTask(t.id, { status: 'expired' })
      const esc = await getEscrow(t.id)
      if (esc?.status === 'held' || esc?.status === 'pending') {
        try {
          if (esc.paypal_authorization_id) await voidAuthorization(esc.paypal_authorization_id)
        } catch (e) {
          console.error('[sweep] void failed', e)
        }
        await upsertEscrow({ task_id: t.id, amount_cents: esc.amount_cents, status: 'voided' })
      }
      expired.push(t.id)
    } else if (t.status === 'open' && !activated.includes(t.id)) {
      try {
        const res = await notifySubscribers(t)
        alerts.sent += res.sent
        alerts.skipped += res.skipped
        alerts.failed += res.failed
      } catch (err) {
        console.error('[sweep] notifySubscribers failed for open task', t.id, err)
      }
    }
  }
  return { activated, expired_scheduled, reopened, expired, alerts }
}

export async function listTasks(opts: { status?: string; sweep?: boolean } = {}): Promise<Task[]> {
  if (opts.sweep !== false) await sweepTasks()
  let rows: Task[]
  if (!usingSupabase) {
    rows = [...mem().tasks]
  } else {
    const [rawRows, scheduleMap] = await Promise.all([
      sb().from('tasks').select('*').order('created_at', { ascending: false }),
      getScheduleMap(),
    ])
    rows = (must(rawRows) as Task[]).map((r) => hydrateTask(r, scheduleMap))
  }
  if (opts.status) rows = rows.filter((t) => t.status === opts.status)
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getTask(id: string): Promise<Task | null> {
  if (!usingSupabase) return mem().tasks.find((t) => t.id === id) ?? null
  const [raw, scheduleMap] = await Promise.all([
    sb().from('tasks').select('*').eq('id', id).maybeSingle(),
    getScheduleMap(),
  ])
  const row = (must(raw) as Task | null) ?? null
  return row ? hydrateTask(row, scheduleMap) : null
}

export async function createTask(
  input: Pick<Task, 'agent_id' | 'title' | 'description' | 'task_type' | 'price_cents' | 'proof_requirements' | 'deadline_at' | 'status'> &
    Partial<Pick<Task, 'execute_at' | 'deadline_minutes' | 'status_reason'>>,
): Promise<Task> {
  if (!usingSupabase) {
    const t: Task = {
      ...input,
      id: randomUUID(),
      claimed_by: null,
      claimed_at: null,
      execute_at: input.execute_at ?? null,
      deadline_minutes: input.deadline_minutes ?? 240,
      status_reason: input.status_reason ?? null,
      created_at: new Date().toISOString(),
    }
    mem().tasks.push(t)
    return t
  }

  const baseInput = {
    agent_id: input.agent_id,
    title: input.title,
    description: input.description,
    task_type: input.task_type,
    price_cents: input.price_cents,
    status: input.status === 'scheduled' ? 'pending_funding' : input.status,
    proof_requirements: input.proof_requirements,
    deadline_at: input.deadline_at,
  }

  const created = must(await sb().from('tasks').insert(baseInput).select().single()) as Task

  if (input.execute_at || input.status === 'scheduled' || input.deadline_minutes || input.status_reason) {
    const map = await getScheduleMap()
    map[created.id] = {
      status: input.status,
      execute_at: input.execute_at ?? null,
      deadline_minutes: input.deadline_minutes ?? 240,
      status_reason: input.status_reason ?? null,
    }
    await saveScheduleMap(map)
    return hydrateTask(created, map)
  }

  return hydrateTask(created, {})
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  if (!usingSupabase) {
    const t = mem().tasks.find((x) => x.id === id)
    if (!t) throw new Error('Task not found')
    Object.assign(t, patch)
    return t
  }

  const map = await getScheduleMap()
  const existingMeta = map[id]
  const hasSchedulePatch =
    patch.status === 'scheduled' ||
    patch.execute_at !== undefined ||
    patch.deadline_minutes !== undefined ||
    patch.status_reason !== undefined ||
    Boolean(existingMeta)

  const dbPatch: Record<string, unknown> = {}
  if (patch.title !== undefined) dbPatch.title = patch.title
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.task_type !== undefined) dbPatch.task_type = patch.task_type
  if (patch.price_cents !== undefined) dbPatch.price_cents = patch.price_cents
  if (patch.proof_requirements !== undefined) dbPatch.proof_requirements = patch.proof_requirements
  if (patch.claimed_by !== undefined) dbPatch.claimed_by = patch.claimed_by
  if (patch.claimed_at !== undefined) dbPatch.claimed_at = patch.claimed_at
  if (patch.deadline_at !== undefined) dbPatch.deadline_at = patch.deadline_at
  if (patch.status !== undefined) {
    dbPatch.status = patch.status === 'scheduled' ? 'pending_funding' : patch.status
  }

  const updated =
    Object.keys(dbPatch).length > 0
      ? (must(await sb().from('tasks').update(dbPatch).eq('id', id).select().single()) as Task)
      : (must(await sb().from('tasks').select('*').eq('id', id).single()) as Task)

  if (hasSchedulePatch) {
    map[id] = {
      status: patch.status ?? existingMeta?.status ?? updated.status,
      execute_at: patch.execute_at !== undefined ? patch.execute_at : (existingMeta?.execute_at ?? null),
      deadline_minutes: patch.deadline_minutes ?? existingMeta?.deadline_minutes ?? 240,
      status_reason:
        patch.status_reason !== undefined ? patch.status_reason : (existingMeta?.status_reason ?? null),
    }
    await saveScheduleMap(map)
  }

  return hydrateTask(updated, map)
}

/** Atomic claim: only succeeds if the task is currently open (never claims scheduled tasks). */
export async function claimTask(id: string, humanId: string): Promise<Task | null> {
  const existing = await getTask(id)
  if (!existing || existing.status !== 'open') return null
  const patch = { status: 'claimed' as const, claimed_by: humanId, claimed_at: new Date().toISOString() }
  if (!usingSupabase) {
    const t = mem().tasks.find((x) => x.id === id)
    if (!t || t.status !== 'open') return null
    Object.assign(t, patch)
    return t
  }
  const r = await sb().from('tasks').update(patch).eq('id', id).eq('status', 'open').select()
  const rows = must(r) as Task[]
  if (!rows[0]) return null
  const map = await getScheduleMap()
  if (map[id]) {
    map[id].status = 'claimed'
    await saveScheduleMap(map)
  }
  return hydrateTask(rows[0], map)
}

// ---------- proofs ----------
export async function addProof(
  input: Omit<Proof, 'id' | 'submitted_at'>,
): Promise<Proof> {
  if (!usingSupabase) {
    const p: Proof = { ...input, id: randomUUID(), submitted_at: new Date().toISOString() }
    mem().proofs.push(p)
    return p
  }
  return must(await sb().from('proofs').insert(input).select().single()) as Proof
}

export async function getLatestProof(taskId: string): Promise<Proof | null> {
  if (!usingSupabase) {
    const rows = mem().proofs.filter((p) => p.task_id === taskId)
    return rows[rows.length - 1] ?? null
  }
  const rows = must(
    await sb().from('proofs').select('*').eq('task_id', taskId).order('submitted_at', { ascending: false }).limit(1),
  ) as Proof[]
  return rows[0] ?? null
}

// ---------- escrows ----------
export async function upsertEscrow(
  input: Partial<Escrow> & Pick<Escrow, 'task_id' | 'amount_cents'>,
): Promise<Escrow> {
  if (!usingSupabase) {
    const existing = mem().escrows.find((e) => e.task_id === input.task_id)
    if (existing) return Object.assign(existing, input)
    const e: Escrow = {
      id: randomUUID(), paypal_order_id: null, paypal_authorization_id: null,
      platform_fee_cents: 0, status: 'pending', created_at: new Date().toISOString(),
      captured_at: null, ...input,
    }
    mem().escrows.push(e)
    return e
  }
  return must(
    await sb().from('escrows').upsert(input, { onConflict: 'task_id' }).select().single(),
  ) as Escrow
}

export async function getEscrow(taskId: string): Promise<Escrow | null> {
  if (!usingSupabase) return mem().escrows.find((e) => e.task_id === taskId) ?? null
  return (must(await sb().from('escrows').select('*').eq('task_id', taskId).maybeSingle()) as Escrow | null) ?? null
}

export async function getEscrowByOrder(orderId: string): Promise<Escrow | null> {
  if (!usingSupabase) return mem().escrows.find((e) => e.paypal_order_id === orderId) ?? null
  return (must(await sb().from('escrows').select('*').eq('paypal_order_id', orderId).maybeSingle()) as Escrow | null) ?? null
}

export async function listEscrows(): Promise<Escrow[]> {
  if (!usingSupabase) return [...mem().escrows]
  return must(await sb().from('escrows').select('*')) as Escrow[]
}

// ---------- bids ----------
export async function addBid(
  input: Omit<Bid, 'id' | 'status' | 'created_at'>,
): Promise<Bid> {
  const fallback = () => {
    const b: Bid = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    mem().bids.push(b)
    return b
  }

  if (!usingSupabase) {
    return fallback()
  }

  try {
    const res = await sb().from('bids').insert(input).select().single()
    if (res.error) {
      console.warn('Supabase bids insert error, falling back to memory:', res.error.message)
      return fallback()
    }
    return res.data as Bid
  } catch (err: any) {
    console.warn('Supabase bids exception, falling back to memory:', err?.message || err)
    return fallback()
  }
}

export async function listBidsForTask(taskId: string): Promise<Bid[]> {
  const fallback = () => {
    const bids = mem().bids.filter((b) => b.task_id === taskId)
    return bids.map((b) => ({
      ...b,
      bidder: mem().profiles.find((p) => p.id === b.bidder_id),
    }))
  }

  if (!usingSupabase) {
    return fallback()
  }

  try {
    const res = await sb()
      .from('bids')
      .select('*, bidder:profiles(*)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    if (res.error) {
      console.warn('Supabase list bids error, falling back to memory:', res.error.message)
      return fallback()
    }
    return (res.data || []) as (Bid & { bidder: Profile })[]
  } catch (err: any) {
    console.warn('Supabase list bids exception, falling back to memory:', err?.message || err)
    return fallback()
  }
}

export async function acceptBid(bidId: string): Promise<{ task: Task; bid: Bid } | null> {
  let bid: Bid | null = null

  if (!usingSupabase) {
    const b = mem().bids.find((x) => x.id === bidId)
    if (!b || b.status !== 'pending') return null
    const task = mem().tasks.find((t) => t.id === b.task_id)
    if (!task || task.status !== 'open') return null

    b.status = 'accepted'
    bid = b
    // Reject other bids for this task
    for (const other of mem().bids) {
      if (other.task_id === b.task_id && other.id !== b.id) {
        other.status = 'rejected'
      }
    }
    // Update task to claimed by this bidder at their bid price
    task.status = 'claimed'
    task.claimed_by = b.bidder_id
    task.claimed_at = new Date().toISOString()
    task.price_cents = b.bid_cents
    return { task, bid }
  }

  // Supabase implementation with fallback
  try {
    const rBid = await sb().from('bids').select('*').eq('id', bidId).maybeSingle()
    if (rBid.error) throw rBid.error
    const fetchedBid = rBid.data as Bid | null
    if (!fetchedBid || fetchedBid.status !== 'pending') return null

    const now = new Date().toISOString()
    const rTask = await sb()
      .from('tasks')
      .update({
        status: 'claimed',
        claimed_by: fetchedBid.bidder_id,
        claimed_at: now,
        price_cents: fetchedBid.bid_cents,
      })
      .eq('id', fetchedBid.task_id)
      .eq('status', 'open')
      .select()

    if (rTask.error) throw rTask.error
    const updatedTasks = rTask.data as Task[]
    if (!updatedTasks.length) return null

    // Mark bid accepted & reject others
    await sb().from('bids').update({ status: 'accepted' }).eq('id', bidId)
    await sb()
      .from('bids')
      .update({ status: 'rejected' })
      .eq('task_id', fetchedBid.task_id)
      .neq('id', bidId)

    return { task: updatedTasks[0], bid: fetchedBid }
  } catch (err: any) {
    console.warn('Supabase accept bid error, falling back to memory:', err?.message || err)
    // Check if bid exists in mem
    const b = mem().bids.find((x) => x.id === bidId)
    if (!b || b.status !== 'pending') return null
    b.status = 'accepted'
    for (const other of mem().bids) {
      if (other.task_id === b.task_id && other.id !== b.id) {
        other.status = 'rejected'
      }
    }
    // Update task in Supabase or mem
    try {
      const updated = await updateTask(b.task_id, {
        status: 'claimed',
        claimed_by: b.bidder_id,
        claimed_at: new Date().toISOString(),
        price_cents: b.bid_cents,
      })
      return { task: updated, bid: b }
    } catch {
      return null
    }
  }
}

// ---------- proof image storage ----------
/** Upload to Supabase Storage bucket "proofs" if configured, else return a data URL. */
export async function storeProofImage(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer())
  if (!usingSupabase) {
    return `data:${file.type || 'image/jpeg'};base64,${buf.toString('base64')}`
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${randomUUID()}.${ext}`
  const up = await sb().storage.from('proofs').upload(path, buf, { contentType: file.type || 'image/jpeg' })
  if (up.error) throw new Error(up.error.message)
  return sb().storage.from('proofs').getPublicUrl(path).data.publicUrl
}

// ---------- stats ----------
export async function getStats() {
  const [tasks, escrows] = await Promise.all([listTasks({ sweep: false }), listEscrows()])
  const byTask = new Map(escrows.map((e) => [e.task_id, e]))
  let escrowed = 0
  let released = 0
  for (const e of escrows) {
    if (e.status === 'held') escrowed += e.amount_cents
    if (e.status === 'captured') released += e.amount_cents - e.platform_fee_cents
  }
  return {
    escrowed_cents: escrowed,
    released_cents: released,
    open: tasks.filter((t) => t.status === 'open').length,
    paid: tasks.filter((t) => t.status === 'paid').length,
    total: tasks.length,
  }
}

// ---------- operator budget mandate & vault ----------
const MANDATE_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const DEFAULT_MANDATE: OperatorMandate = {
  vault_id: null,
  vault_status: 'unauthorized',
  weekly_cap_cents: 5000,
  spent_this_week_cents: 0,
  per_task_cap_cents: 500,
  operator_email: 'operator@rukyr.ai',
  last_authorized_at: null,
}

function normalizeMandate(raw: Partial<OperatorMandate> | null | undefined): OperatorMandate {
  return {
    vault_id: raw?.vault_id ?? DEFAULT_MANDATE.vault_id,
    vault_status: raw?.vault_status ?? DEFAULT_MANDATE.vault_status,
    weekly_cap_cents:
      typeof raw?.weekly_cap_cents === 'number' ? raw.weekly_cap_cents : DEFAULT_MANDATE.weekly_cap_cents,
    spent_this_week_cents:
      typeof raw?.spent_this_week_cents === 'number'
        ? raw.spent_this_week_cents
        : DEFAULT_MANDATE.spent_this_week_cents,
    per_task_cap_cents:
      typeof raw?.per_task_cap_cents === 'number' ? raw.per_task_cap_cents : DEFAULT_MANDATE.per_task_cap_cents,
    operator_email: raw?.operator_email ?? DEFAULT_MANDATE.operator_email,
    last_authorized_at: raw?.last_authorized_at ?? DEFAULT_MANDATE.last_authorized_at,
  }
}

export async function getOperatorMandate(): Promise<OperatorMandate> {
  if (!usingSupabase) return mem().mandate

  // 1. Primary: dedicated single-row operator_mandate table
  const res = await sb().from('operator_mandate').select('*').eq('id', 1).maybeSingle()
  if (!res.error) {
    if (res.data) {
      const m = normalizeMandate(res.data as Partial<OperatorMandate>)
      g.__rukyrMem && (g.__rukyrMem.mandate = m)
      return m
    }
    const seeded = await sb()
      .from('operator_mandate')
      .upsert({ id: 1, ...DEFAULT_MANDATE }, { onConflict: 'id' })
      .select('*')
      .single()
    if (!seeded.error && seeded.data) {
      const m = normalizeMandate(seeded.data as Partial<OperatorMandate>)
      g.__rukyrMem && (g.__rukyrMem.mandate = m)
      return m
    }
  }

  // 2. Durable Supabase fallback if operator_mandate table is not migrated yet
  try {
    const fb = await sb().from('profiles').select('paypal_email').eq('id', MANDATE_PROFILE_ID).maybeSingle()
    if (!fb.error && fb.data?.paypal_email) {
      const parsed = JSON.parse(fb.data.paypal_email) as Partial<OperatorMandate>
      const m = normalizeMandate(parsed)
      g.__rukyrMem && (g.__rukyrMem.mandate = m)
      return m
    }
    if (!fb.error && !fb.data) {
      await sb().from('profiles').upsert(
        {
          id: MANDATE_PROFILE_ID,
          kind: 'agent',
          display_name: '__operator_mandate__',
          paypal_email: JSON.stringify(DEFAULT_MANDATE),
          reputation: 5,
        },
        { onConflict: 'id' },
      )
      return { ...DEFAULT_MANDATE }
    }
  } catch (err: any) {
    console.warn('Supabase mandate fallback read warning:', err?.message || err)
  }

  return mem().mandate
}

export async function updateOperatorMandate(patch: Partial<OperatorMandate>): Promise<OperatorMandate> {
  if (!usingSupabase) {
    Object.assign(mem().mandate, patch)
    return mem().mandate
  }

  const current = await getOperatorMandate()
  const next = normalizeMandate({ ...current, ...patch })
  if (g.__rukyrMem) g.__rukyrMem.mandate = next

  // 1. Primary: update single-row operator_mandate table
  const res = await sb()
    .from('operator_mandate')
    .upsert({ id: 1, ...next }, { onConflict: 'id' })
    .select('*')
    .single()
  if (!res.error && res.data) {
    return normalizeMandate(res.data as Partial<OperatorMandate>)
  }

  // 2. Durable Supabase fallback if operator_mandate table is not migrated yet
  const fb = await sb().from('profiles').upsert(
    {
      id: MANDATE_PROFILE_ID,
      kind: 'agent',
      display_name: '__operator_mandate__',
      paypal_email: JSON.stringify(next),
      reputation: 5,
    },
    { onConflict: 'id' },
  )
  if (fb.error) {
    console.warn('Supabase mandate fallback write warning:', fb.error.message)
  }
  return next
}

export async function recordMandateSpend(cents: number): Promise<void> {
  const current = await getOperatorMandate()
  await updateOperatorMandate({
    spent_this_week_cents: current.spent_this_week_cents + cents,
  })
}

export async function refundMandateSpend(cents: number): Promise<void> {
  const current = await getOperatorMandate()
  await updateOperatorMandate({
    spent_this_week_cents: Math.max(0, current.spent_this_week_cents - cents),
  })
}

export async function revokeOperatorMandate(): Promise<OperatorMandate> {
  return updateOperatorMandate({
    vault_status: 'revoked',
    vault_id: null,
  })
}

// ---------- earner alerts (subscriptions & idempotent deliveries) ----------
const ALERTS_PROFILE_ID = '00000000-0000-0000-0000-000000000003'

interface AlertsFallbackStore {
  subscriptions: EarnerAlertSubscription[]
  deliveries: AlertDelivery[]
}

async function getAlertsFallbackStore(): Promise<AlertsFallbackStore> {
  if (!usingSupabase) {
    return {
      subscriptions: mem().alertSubscriptions,
      deliveries: mem().alertDeliveries,
    }
  }
  try {
    const r = await sb().from('profiles').select('paypal_email').eq('id', ALERTS_PROFILE_ID).maybeSingle()
    if (!r.error && r.data?.paypal_email) {
      const parsed = JSON.parse(r.data.paypal_email) as Partial<AlertsFallbackStore>
      return {
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
        deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : [],
      }
    }
  } catch (err: any) {
    console.warn('Supabase alerts fallback read warning:', err?.message || err)
  }
  return { subscriptions: [], deliveries: [] }
}

async function saveAlertsFallbackStore(store: AlertsFallbackStore): Promise<void> {
  if (g.__rukyrMem) {
    g.__rukyrMem.alertSubscriptions = store.subscriptions
    g.__rukyrMem.alertDeliveries = store.deliveries
  }
  if (!usingSupabase) return
  try {
    await sb().from('profiles').upsert(
      {
        id: ALERTS_PROFILE_ID,
        kind: 'agent',
        display_name: '__earner_alerts__',
        paypal_email: JSON.stringify(store),
        reputation: 5,
      },
      { onConflict: 'id' },
    )
  } catch (err: any) {
    console.warn('Supabase alerts fallback write warning:', err?.message || err)
  }
}

export async function subscribeEarnerAlert(rawEmail: string): Promise<EarnerAlertSubscription> {
  const email = rawEmail.trim().toLowerCase()
  const now = new Date().toISOString()

  if (usingSupabase) {
    const existingRes = await sb()
      .from('earner_alert_subscriptions')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (!existingRes.error) {
      if (existingRes.data) {
        const current = existingRes.data as EarnerAlertSubscription
        if (current.active && !current.unsubscribed_at) {
          return current
        }
        const reactivated = await sb()
          .from('earner_alert_subscriptions')
          .update({ active: true, unsubscribed_at: null })
          .eq('id', current.id)
          .select('*')
          .single()
        if (!reactivated.error && reactivated.data) {
          return reactivated.data as EarnerAlertSubscription
        }
      } else {
        const created = await sb()
          .from('earner_alert_subscriptions')
          .insert({
            email,
            active: true,
            unsubscribe_token: randomUUID().replace(/-/g, ''),
            created_at: now,
            unsubscribed_at: null,
          })
          .select('*')
          .single()
        if (!created.error && created.data) {
          return created.data as EarnerAlertSubscription
        }
      }
    }
  }

  // Zero-migration Supabase fallback (or in-memory fallback)
  const store = await getAlertsFallbackStore()
  const found = store.subscriptions.find((s) => s.email === email)
  if (found) {
    found.active = true
    found.unsubscribed_at = null
    if (!found.unsubscribe_token) {
      found.unsubscribe_token = randomUUID().replace(/-/g, '')
    }
    await saveAlertsFallbackStore(store)
    return found
  }

  const sub: EarnerAlertSubscription = {
    id: randomUUID(),
    email,
    active: true,
    unsubscribe_token: randomUUID().replace(/-/g, ''),
    created_at: now,
    unsubscribed_at: null,
  }
  store.subscriptions.push(sub)
  await saveAlertsFallbackStore(store)
  return sub
}

export async function unsubscribeEarnerAlertByToken(
  rawToken: string,
): Promise<EarnerAlertSubscription | null> {
  const token = rawToken.trim()
  if (!token) return null
  const now = new Date().toISOString()

  if (usingSupabase) {
    const existingRes = await sb()
      .from('earner_alert_subscriptions')
      .select('*')
      .eq('unsubscribe_token', token)
      .maybeSingle()

    if (!existingRes.error && existingRes.data) {
      const updated = await sb()
        .from('earner_alert_subscriptions')
        .update({ active: false, unsubscribed_at: now })
        .eq('unsubscribe_token', token)
        .select('*')
        .single()
      if (!updated.error && updated.data) {
        return updated.data as EarnerAlertSubscription
      }
    }
  }

  const store = await getAlertsFallbackStore()
  const found = store.subscriptions.find((s) => s.unsubscribe_token === token)
  if (!found) return null
  found.active = false
  found.unsubscribed_at = now
  await saveAlertsFallbackStore(store)
  return found
}

export async function listActiveAlertSubscribers(): Promise<EarnerAlertSubscription[]> {
  if (usingSupabase) {
    const res = await sb()
      .from('earner_alert_subscriptions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })
    if (!res.error && res.data) {
      return res.data as EarnerAlertSubscription[]
    }
  }
  const store = await getAlertsFallbackStore()
  return store.subscriptions.filter((s) => s.active)
}

export async function hasAlertDelivery(taskId: string, subscriberEmail: string): Promise<boolean> {
  const email = subscriberEmail.trim().toLowerCase()
  if (usingSupabase) {
    const res = await sb()
      .from('alert_deliveries')
      .select('task_id')
      .eq('task_id', taskId)
      .eq('subscriber_email', email)
      .maybeSingle()
    if (!res.error) {
      return Boolean(res.data)
    }
  }
  const store = await getAlertsFallbackStore()
  return store.deliveries.some((d) => d.task_id === taskId && d.subscriber_email === email)
}

export async function recordAlertDelivery(taskId: string, subscriberEmail: string): Promise<void> {
  const email = subscriberEmail.trim().toLowerCase()
  const sent_at = new Date().toISOString()
  if (usingSupabase) {
    const res = await sb()
      .from('alert_deliveries')
      .upsert({ task_id: taskId, subscriber_email: email, sent_at }, { onConflict: 'task_id,subscriber_email' })
    if (!res.error) return
  }
  const store = await getAlertsFallbackStore()
  if (!store.deliveries.some((d) => d.task_id === taskId && d.subscriber_email === email)) {
    store.deliveries.push({ task_id: taskId, subscriber_email: email, sent_at })
    await saveAlertsFallbackStore(store)
  }
}

/**
 * Notifies all active earner alert subscribers that `task` is open for claiming.
 * Idempotent per (task_id, subscriber_email): running multiple times never double-sends.
 * Never throws: individual subscriber failures are logged and skipped so activation is never blocked.
 */
export async function notifySubscribers(task: Task): Promise<{
  sent: number
  skipped: number
  failed: number
}> {
  let sent = 0
  let skipped = 0
  let failed = 0

  try {
    const subscribers = await listActiveAlertSubscribers()
    if (!subscribers.length) return { sent, skipped, failed }

    for (const sub of subscribers) {
      if (!sub.active || !sub.email) continue
      try {
        const alreadySent = await hasAlertDelivery(task.id, sub.email)
        if (alreadySent) {
          skipped++
          continue
        }
        await sendTaskAlertEmail(task, sub)
        await recordAlertDelivery(task.id, sub.email)
        sent++
      } catch (err) {
        failed++
        console.error(`[alerts] failed to send task=${task.id} to=${sub.email}:`, err)
      }
    }
  } catch (err) {
    console.error(`[alerts] notifySubscribers top-level error for task=${task.id}:`, err)
  }

  return { sent, skipped, failed }
}



