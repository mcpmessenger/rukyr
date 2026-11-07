import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import {
  V1Task,
  V1Assignment,
  V1Submission,
  V1UploadSlot,
  V1WebhookEnvelope,
  CreateTaskRequestInput,
  WorkerSubmissionInput,
  AssignmentDecisionInput,
  WebhookEventType,
} from './v1-types'
import { validateWorkerSubmission } from './v1-validation'

export interface IdempotencyEntry {
  key: string
  payloadHash: string
  status: number
  body: unknown
  createdAt: number
}

interface V1StoreData {
  tasks: Map<string, V1Task>
  assignments: Map<string, V1Assignment>
  submissions: Map<string, V1Submission>
  uploads: Map<string, V1UploadSlot>
  webhooks: V1WebhookEnvelope[]
  idempotency: Map<string, IdempotencyEntry>
  webhookSecret: string
}

const g = globalThis as unknown as { __rukyrV1Store?: V1StoreData }

function hashPayload(payload: unknown): string {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})
  return createHmac('sha256', 'idempotency-salt').update(str).digest('hex')
}

export function signWebhookPayload(payload: unknown, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const hmac = createHmac('sha256', secret).update(`${timestamp}.${bodyStr}`).digest('hex')
  return `t=${timestamp},v1=${hmac}`
}

function seedV1Store(): V1StoreData {
  const now = Date.now()
  const iso = (ms: number) => new Date(ms).toISOString()

  const tasks = new Map<string, V1Task>()
  const assignments = new Map<string, V1Assignment>()
  const submissions = new Map<string, V1Submission>()
  const uploads = new Map<string, V1UploadSlot>()
  const webhooks: V1WebhookEnvelope[] = []
  const idempotency = new Map<string, IdempotencyEntry>()

  // Helper to create task + assignment
  const addTask = (
    id: string,
    clientRef: string,
    title: string,
    taskType: V1Task['task_type'],
    workMode: V1Task['work_mode'],
    rewardMinor: number,
    instructions: string,
    input: Record<string, unknown>,
    outputSchema: Record<string, unknown>,
    proofReqs: V1Task['proof_requirements'],
    location?: V1Task['location'],
    skills?: string[],
    preclaimed?: boolean
  ): V1Task => {
    const asnId = `asn_${id.replace('tsk_', '')}`
    const completionDeadline = iso(now + 3600 * 1000 * 4)

    const assignment: V1Assignment = {
      id: asnId,
      task_id: id,
      worker_id: preclaimed ? 'wrk_01J_sarah_c' : null,
      worker_name: preclaimed ? 'Sarah C. (Rating: 4.98)' : undefined,
      status: preclaimed ? 'claimed' : 'open',
      claimed_at: preclaimed ? iso(now - 300_000) : null,
      claim_expires_at: preclaimed ? iso(now + 1500_000) : null,
      created_at: iso(now - 600_000),
      updated_at: iso(now - 300_000),
    }

    const task: V1Task = {
      id,
      client_reference: clientRef,
      status: preclaimed ? 'open' : 'open',
      task_type: taskType,
      title,
      instructions: {
        format: 'markdown',
        body: instructions,
      },
      input,
      output_schema: outputSchema,
      work_mode: workMode,
      location,
      worker_requirements: {
        skills: skills ?? ['retail_observation'],
        languages: ['en'],
        minimum_quality_score: 0.8,
      },
      proof_requirements: proofReqs,
      dispatch: {
        assignment_count: 1,
        claim_timeout_seconds: 1800,
        completion_deadline: completionDeadline,
        selection: 'first_qualified',
        review_policy: 'client_review',
      },
      reward: {
        amount_minor: rewardMinor,
        currency: 'USD',
      },
      billing: {
        funding_source_id: 'fs_01J_vault_merch_mit',
        max_total_amount_minor: Math.round(rewardMinor * 1.5),
        currency: 'USD',
        status: 'authorized',
        authorized_amount_minor: Math.round(rewardMinor * 1.5),
      },
      metadata: {
        source: 'autonomous_shopping_agent',
        buyer_trust_score: 0.99,
      },
      assignments: [assignment],
      result: null,
      created_at: iso(now - 600_000),
      updated_at: iso(now - 300_000),
      links: {
        self: `/v1/tasks/${id}`,
      },
    }

    tasks.set(id, task)
    assignments.set(asnId, assignment)
    return task
  }

  // 1. Exact Daylight Color Check Task from the Spec
  addTask(
    'tsk_01J_color_check',
    'shop-order-4821-color-check',
    'Check the T-shirt color in daylight',
    'physical_check',
    'on_site',
    1500, // $15.00
    'Visit the specified shop. Inspect the garment in direct daylight. Report the closest observed color and whether the tag matches the listing. Do not purchase the item.',
    {
      product_url: 'https://example.com/products/vintage-tee',
      listing_claim: 'faded black',
      ambiguity: 'The listing photo could be navy blue under artificial lighting.',
      store_name: 'Wasteland Vintage',
      store_address: '1660 Haight St, San Francisco, CA 94117',
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['observed_color', 'matches_listing', 'notes'],
      properties: {
        observed_color: { type: 'string', maxLength: 80 },
        matches_listing: { type: 'boolean' },
        notes: { type: 'string', maxLength: 1000 },
      },
    },
    [
      { type: 'photo', required: true, min_count: 1, max_count: 3, instructions: 'Clear photo of garment in natural daylight with tag visible' },
      { type: 'text', required: true, min_count: 1, max_count: 1, instructions: 'Brief description of fabric hue' },
    ],
    {
      country_code: 'US',
      region: 'CA',
      locality: 'San Francisco',
      postal_code: '94117',
      radius_km: 15,
    },
    ['retail_observation', 'photography']
  )

  // 2. Retail Shelf Inventory Audit
  addTask(
    'tsk_01J_shelf_audit',
    'agent-inventory-target-soho',
    'Verify Target Soho baby formula stock & barcode',
    'physical_check',
    'on_site',
    1850, // $18.50
    'Locate aisle B4 in Target SoHo. Check if Enfamil NeuroPro 20.7oz is currently stocked on the shelf. Photograph the shelf price tag and confirm the remaining unit count.',
    {
      retailer: 'Target',
      location_name: 'Target SoHo, Manhattan',
      upc: '0007687053424',
      target_product: 'Enfamil NeuroPro 20.7oz Infant Formula Tub',
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['is_in_stock', 'units_on_shelf', 'shelf_price_cents', 'notes'],
      properties: {
        is_in_stock: { type: 'boolean' },
        units_on_shelf: { type: 'number' },
        shelf_price_cents: { type: 'number' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
    [
      { type: 'photo', required: true, min_count: 1, max_count: 2, instructions: 'Wide angle photo of shelf facing and closeup of barcode price label' },
      { type: 'text', required: true, min_count: 1, max_count: 1 },
    ],
    {
      country_code: 'US',
      region: 'NY',
      locality: 'New York',
      postal_code: '10012',
      radius_km: 10,
    },
    ['inventory_audit', 'quick_turnaround']
  )

  // 3. Remote Usability Test & Checkout Bug Reproduction
  addTask(
    'tsk_01J_checkout_test',
    'qa-agent-checkout-safari',
    'Reproduce Safari iOS 18 Apple Pay discount bug',
    'usability_test',
    'remote',
    2500, // $25.00
    'Using an iPhone on iOS 18 Safari, open the staging cart link. Apply promo code AGENT20 and tap Apple Pay sheet. Verify whether the 20% discount is correctly calculated on the Apple Pay total or if it reverts to full price. Do not confirm final payment.',
    {
      staging_url: 'https://staging.cart-flow.dev/checkout?test_cart=9821',
      promo_code: 'AGENT20',
      os_requirement: 'iOS 18+ Safari',
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['bug_reproduced', 'apple_pay_displayed_total', 'device_model', 'ios_version', 'notes'],
      properties: {
        bug_reproduced: { type: 'boolean' },
        apple_pay_displayed_total: { type: 'string' },
        device_model: { type: 'string' },
        ios_version: { type: 'string' },
        notes: { type: 'string', maxLength: 1000 },
      },
    },
    [
      { type: 'screenshot', required: true, min_count: 2, max_count: 4, instructions: 'Screenshot before opening Apple Pay, and screenshot showing Apple Pay sheet total' },
      { type: 'text', required: true, min_count: 1, max_count: 1 },
    ],
    undefined,
    ['mobile_qa', 'ios_testing']
  )

  // 4. Restaurant Menu Price Verification (Austin, TX)
  addTask(
    'tsk_01J_menu_pricing',
    'food-agent-austin-bbq',
    'Photograph Franklin Barbecue brisket blackboard price',
    'physical_check',
    'on_site',
    1200, // $12.00
    'Check today’s blackboard pricing at Franklin BBQ on E 11th St. Photograph the chalkboard menu near the entrance showing price per pound for Brisket and Pork Ribs.',
    {
      restaurant_name: 'Franklin Barbecue',
      address: '900 E 11th St, Austin, TX 78702',
      items_to_verify: ['Brisket per lb', 'Pork Ribs per lb'],
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['brisket_price_per_lb', 'ribs_price_per_lb', 'sold_out_signs_present', 'notes'],
      properties: {
        brisket_price_per_lb: { type: 'string' },
        ribs_price_per_lb: { type: 'string' },
        sold_out_signs_present: { type: 'boolean' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
    [
      { type: 'photo', required: true, min_count: 1, max_count: 2, instructions: 'Clear photo of handwritten chalk board price list' },
    ],
    {
      country_code: 'US',
      region: 'TX',
      locality: 'Austin',
      postal_code: '78702',
      radius_km: 20,
    },
    ['retail_observation']
  )

  // 5. Digital Listing Data Collection (Remote)
  addTask(
    'tsk_01J_doc_review',
    'contract-agent-clause-check',
    'Compare PDF lease addendum against standard template',
    'document_review',
    'remote',
    3000, // $30.00
    'Inspect the provided 3-page commercial lease addendum PDF. Identify any indemnification or personal guarantee clause that differs from standard California CAR forms.',
    {
      document_url: 'https://example.com/leases/sample-addendum-rev3.pdf',
      target_clauses: ['Section 14: Indemnification', 'Section 22: Personal Guarantee'],
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['has_personal_guarantee', 'clause_differences_found', 'flagged_paragraphs', 'summary'],
      properties: {
        has_personal_guarantee: { type: 'boolean' },
        clause_differences_found: { type: 'boolean' },
        flagged_paragraphs: { type: 'string' },
        summary: { type: 'string', maxLength: 1000 },
      },
    },
    [
      { type: 'text', required: true, min_count: 1, max_count: 1, instructions: 'Detailed analysis of clause deviation' },
      { type: 'screenshot', required: false, min_count: 0, max_count: 3 },
    ],
    undefined,
    ['document_review', 'legal_tech']
  )

  // Seed sample webhook event
  webhooks.push({
    id: `evt_01J_seed_${Date.now()}`,
    type: 'task.opened',
    created_at: iso(now - 600_000),
    api_version: '2026-01-01',
    data: {
      task_id: 'tsk_01J_color_check',
      status: 'open',
    },
  })

  return {
    tasks,
    assignments,
    submissions,
    uploads,
    webhooks,
    idempotency,
    webhookSecret: 'whsec_rukyr_test_secret_key_8f4eda611a',
  }
}

function getStore(): V1StoreData {
  if (!g.__rukyrV1Store) {
    g.__rukyrV1Store = seedV1Store()
  }
  return g.__rukyrV1Store
}

export const V1Store = {
  checkIdempotency(key?: string | null, payload?: unknown): { conflict: boolean; cached?: IdempotencyEntry } {
    if (!key) return { conflict: false }
    const store = getStore()
    const existing = store.idempotency.get(key)
    if (!existing) return { conflict: false }

    const currentHash = hashPayload(payload)
    if (existing.payloadHash !== currentHash) {
      return { conflict: true }
    }
    return { conflict: false, cached: existing }
  },

  recordIdempotency(key: string, payload: unknown, status: number, body: unknown) {
    const store = getStore()
    store.idempotency.set(key, {
      key,
      payloadHash: hashPayload(payload),
      status,
      body,
      createdAt: Date.now(),
    })
  },

  emitWebhook(type: WebhookEventType, data: V1WebhookEnvelope['data']) {
    const store = getStore()
    const event: V1WebhookEnvelope = {
      id: `evt_01J${randomBytes(8).toString('hex')}`,
      type,
      created_at: new Date().toISOString(),
      api_version: '2026-01-01',
      data,
    }
    store.webhooks.unshift(event)
    if (store.webhooks.length > 50) {
      store.webhooks.pop()
    }
    return event
  },

  listWebhooks(): V1WebhookEnvelope[] {
    return getStore().webhooks
  },

  getWebhookSecret(): string {
    return getStore().webhookSecret
  },

  createTask(input: CreateTaskRequestInput): V1Task {
    const store = getStore()
    const id = `tsk_01J${randomBytes(8).toString('hex')}`
    const asnId = `asn_01J${randomBytes(8).toString('hex')}`
    const nowIso = new Date().toISOString()

    const assignment: V1Assignment = {
      id: asnId,
      task_id: id,
      worker_id: null,
      status: 'open',
      created_at: nowIso,
      updated_at: nowIso,
    }

    const task: V1Task = {
      id,
      client_reference: input.client_reference,
      status: 'open',
      task_type: input.task_type,
      title: input.title,
      instructions: input.instructions,
      input: input.input,
      input_asset_ids: input.input_asset_ids,
      output_schema: input.output_schema,
      work_mode: input.work_mode,
      location: input.location,
      worker_requirements: input.worker_requirements,
      proof_requirements: input.proof_requirements,
      dispatch: input.dispatch,
      reward: input.reward,
      billing: {
        ...input.billing,
        status: 'authorized',
        authorized_amount_minor: input.billing.max_total_amount_minor,
      },
      metadata: input.metadata,
      callback_url: input.callback_url,
      assignments: [assignment],
      result: null,
      created_at: nowIso,
      updated_at: nowIso,
      links: {
        self: `/v1/tasks/${id}`,
      },
    }

    store.tasks.set(id, task)
    store.assignments.set(asnId, assignment)

    this.emitWebhook('task.opened', {
      task_id: id,
      status: 'open',
    })

    return task
  },

  getTask(id: string): V1Task | null {
    const store = getStore()
    const task = store.tasks.get(id)
    if (!task) return null
    // Update assignments array with latest states
    task.assignments = (task.assignments || []).map((a) => store.assignments.get(a.id) || a)
    return task
  },

  listTasks(filter?: {
    status?: string
    client_reference?: string
    work_mode?: string
    task_type?: string
  }): V1Task[] {
    const store = getStore()
    let list = Array.from(store.tasks.values())

    if (filter?.status) {
      list = list.filter((t) => t.status === filter.status)
    }
    if (filter?.client_reference) {
      list = list.filter((t) => t.client_reference.includes(filter.client_reference!))
    }
    if (filter?.work_mode && filter.work_mode !== 'all') {
      list = list.filter((t) => t.work_mode === filter.work_mode)
    }
    if (filter?.task_type && filter.task_type !== 'all') {
      list = list.filter((t) => t.task_type === filter.task_type)
    }

    return list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  },

  cancelTask(id: string, reason = 'cancelled_by_client'): { task: V1Task; affected_assignments: V1Assignment[] } | null {
    const store = getStore()
    const task = store.tasks.get(id)
    if (!task) return null

    task.status = 'cancelled'
    task.cancel_reason = reason
    task.updated_at = new Date().toISOString()
    task.billing.status = 'voided'

    const affected: V1Assignment[] = []
    for (const a of task.assignments) {
      const live = store.assignments.get(a.id)
      if (live && !['accepted', 'paid', 'cancelled'].includes(live.status)) {
        live.status = 'cancelled'
        live.updated_at = new Date().toISOString()
        affected.push(live)
      }
    }

    this.emitWebhook('task.cancelled', {
      task_id: id,
      status: 'cancelled',
      reason_code: reason,
    })

    return { task, affected_assignments: affected }
  },

  getAssignment(id: string): V1Assignment | null {
    const store = getStore()
    return store.assignments.get(id) || null
  },

  claimAssignment(
    assignmentId: string,
    workerId = 'wrk_01J_earner_live'
  ): { success: boolean; error?: string; assignment?: V1Assignment } {
    const store = getStore()
    const asn = store.assignments.get(assignmentId)
    if (!asn) return { success: false, error: 'Assignment not found' }

    if (asn.status !== 'open') {
      return { success: false, error: `Assignment is currently ${asn.status}, not claimable` }
    }

    const task = store.tasks.get(asn.task_id)
    const timeoutSeconds = task?.dispatch.claim_timeout_seconds || 1800
    const now = Date.now()

    asn.status = 'claimed'
    asn.worker_id = workerId
    asn.worker_name = 'Verified Earner (Quality: 0.96)'
    asn.claimed_at = new Date(now).toISOString()
    asn.claim_expires_at = new Date(now + timeoutSeconds * 1000).toISOString()
    asn.updated_at = new Date(now).toISOString()

    if (task) {
      task.updated_at = new Date(now).toISOString()
    }

    this.emitWebhook('assignment.claimed', {
      task_id: asn.task_id,
      assignment_id: asn.id,
      status: 'claimed',
    })

    return { success: true, assignment: asn }
  },

  submitAssignment(
    assignmentId: string,
    submissionInput: WorkerSubmissionInput
  ): { success: boolean; error?: string; submission?: V1Submission; assignment?: V1Assignment } {
    const store = getStore()
    const asn = store.assignments.get(assignmentId)
    if (!asn) return { success: false, error: 'Assignment not found' }

    if (!['claimed', 'in_progress'].includes(asn.status)) {
      return { success: false, error: `Assignment must be claimed or in_progress to submit, currently ${asn.status}` }
    }

    const task = store.tasks.get(asn.task_id)
    if (!task) return { success: false, error: 'Task not found' }

    // Validate submission against task output_schema and proof_requirements
    const validation = validateWorkerSubmission(submissionInput, task.output_schema, task.proof_requirements)

    const subId = `sub_01J${randomBytes(8).toString('hex')}`
    const nowIso = new Date().toISOString()

    const submission: V1Submission = {
      id: subId,
      assignment_id: asn.id,
      submitted_at: nowIso,
      output: submissionInput.output,
      artifacts: submissionInput.artifacts || [],
      worker_note: submissionInput.worker_note,
      validation: {
        schema_valid: validation.valid,
        schema_errors: validation.errors,
        automated_checks: validation.automatedChecks,
      },
    }

    store.submissions.set(subId, submission)

    asn.status = 'submitted'
    asn.submitted_at = nowIso
    asn.submission = submission
    asn.updated_at = nowIso

    task.updated_at = nowIso

    this.emitWebhook('assignment.submitted', {
      task_id: asn.task_id,
      assignment_id: asn.id,
      submission_id: subId,
      status: 'submitted',
    })

    return { success: true, submission, assignment: asn }
  },

  decideAssignment(
    assignmentId: string,
    input: AssignmentDecisionInput
  ): { success: boolean; error?: string; assignment?: V1Assignment } {
    const store = getStore()
    const asn = store.assignments.get(assignmentId)
    if (!asn) return { success: false, error: 'Assignment not found' }

    if (asn.status !== 'submitted') {
      return { success: false, error: `Assignment status is ${asn.status}, not submitted` }
    }

    const task = store.tasks.get(asn.task_id)
    const nowIso = new Date().toISOString()

    asn.decision = {
      decision: input.decision,
      reason_code: input.reason_code,
      feedback: input.feedback,
      decided_at: nowIso,
    }
    asn.updated_at = nowIso

    if (input.decision === 'accept') {
      asn.status = 'accepted'
      asn.payout = {
        status: 'settled',
        amount_minor: task?.reward.amount_minor || 0,
        currency: task?.reward.currency || 'USD',
        settled_at: nowIso,
      }

      if (task) {
        task.status = 'completed'
        task.result = asn.submission?.output || null
        task.billing.status = 'settled'
        task.updated_at = nowIso
      }

      this.emitWebhook('assignment.accepted', {
        task_id: asn.task_id,
        assignment_id: asn.id,
        status: 'accepted',
      })
      this.emitWebhook('payment.settled', {
        task_id: asn.task_id,
        assignment_id: asn.id,
        status: 'settled',
      })
      this.emitWebhook('task.completed', {
        task_id: asn.task_id,
        status: 'completed',
      })
    } else {
      asn.status = 'rejected'
      if (task) {
        // Return task to queue if configured, or leave partially fulfilled
        task.updated_at = nowIso
      }

      this.emitWebhook('assignment.rejected', {
        task_id: asn.task_id,
        assignment_id: asn.id,
        status: 'rejected',
        reason_code: input.reason_code,
      })
    }

    return { success: true, assignment: asn }
  },

  createUploadSlot(purpose: 'context' | 'evidence' = 'evidence'): V1UploadSlot {
    const store = getStore()
    const uploadId = `upl_01J${randomBytes(8).toString('hex')}`
    const slot: V1UploadSlot = {
      upload_id: uploadId,
      upload_url: `https://uploads.rukyr.com/v1/slots/${uploadId}?token=${randomBytes(16).toString('hex')}`,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      purpose,
    }
    store.uploads.set(uploadId, slot)
    return slot
  },
}
