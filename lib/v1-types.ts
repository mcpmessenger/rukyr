/**
 * Rukyr Human-Work Dispatch API v0.1 Types
 * Implements the official Rukyr Human-Work Dispatch API Specification (v0.1)
 */

export type WorkMode = 'remote' | 'on_site' | 'hybrid'

export type TaskType =
  | 'digital_review'
  | 'physical_check'
  | 'data_collection'
  | 'document_review'
  | 'usability_test'
  | 'other'

export type TaskStatus =
  | 'dispatching'
  | 'open'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'completed'
  | 'cancelled'
  | 'cancel_requested'
  | 'expired'
  | 'failed'

export type AssignmentStatus =
  | 'open'
  | 'claimed'
  | 'in_progress'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'paid'
  | 'payment_failed'
  | 'expired'
  | 'cancelled'
  | 'disputed'

export type FundingStatus =
  | 'pending'
  | 'authorized'
  | 'capture_pending'
  | 'settled'
  | 'failed'
  | 'voided'
  | 'refunded'
  | 'partially_refunded'

export type ProofType = 'text' | 'photo' | 'video' | 'file' | 'screenshot'

export interface TaskLocation {
  country_code: string
  region?: string
  locality?: string
  postal_code?: string
  radius_km?: number
}

export interface WorkerRequirements {
  skills?: string[]
  languages?: string[]
  minimum_quality_score?: number
  qualification_id?: string
}

export interface ProofRequirement {
  type: ProofType
  required: boolean
  min_count?: number
  max_count?: number
  max_size_mb?: number
  allowed_mime_types?: string[]
  instructions?: string
}

export interface DispatchConfig {
  assignment_count: number
  claim_timeout_seconds: number
  completion_deadline: string // RFC 3339 UTC
  selection: 'first_qualified' | 'quality_ranked'
  review_policy?: 'client_review' | 'automatic_schema_only' | 'manual_rukyr_review'
}

export interface RewardConfig {
  amount_minor: number // integer minor units (e.g. 300 = $3.00)
  currency: string // ISO 4217, e.g. "USD"
}

export interface BillingConfig {
  funding_source_id: string
  max_total_amount_minor: number
  currency: string
  status?: FundingStatus
  authorized_amount_minor?: number
}

export interface InstructionsConfig {
  format: 'markdown'
  body: string
}

export interface ArtifactItem {
  upload_id: string
  type: 'photo' | 'video' | 'file' | 'screenshot'
  caption?: string
  url?: string
}

export interface AutomatedCheckResult {
  name: string
  result: 'pass' | 'fail' | 'warn' | 'skip'
  details?: string
}

export interface SubmissionValidation {
  schema_valid: boolean
  schema_errors?: string[]
  automated_checks: AutomatedCheckResult[]
}

export interface V1Submission {
  id: string
  assignment_id: string
  submitted_at: string
  output: Record<string, unknown>
  artifacts: ArtifactItem[]
  worker_note?: string
  validation: SubmissionValidation
}

export interface V1AssignmentDecision {
  decision: 'accept' | 'reject'
  reason_code?: string
  feedback?: string
  decided_at: string
}

export interface V1Assignment {
  id: string
  task_id: string
  worker_id?: string | null
  worker_name?: string
  status: AssignmentStatus
  claimed_at?: string | null
  claim_expires_at?: string | null
  submitted_at?: string | null
  submission?: V1Submission | null
  decision?: V1AssignmentDecision | null
  payout?: {
    status: 'pending' | 'settled' | 'failed'
    amount_minor: number
    currency: string
    settled_at?: string
  } | null
  created_at: string
  updated_at: string
}

export interface V1Task {
  id: string
  client_reference: string
  status: TaskStatus
  task_type: TaskType
  title: string
  instructions: InstructionsConfig
  input: Record<string, unknown>
  input_asset_ids?: string[]
  output_schema: Record<string, unknown>
  work_mode: WorkMode
  location?: TaskLocation
  worker_requirements?: WorkerRequirements
  proof_requirements: ProofRequirement[]
  dispatch: DispatchConfig
  reward: RewardConfig
  billing: BillingConfig
  metadata?: Record<string, unknown>
  callback_url?: string
  assignments: V1Assignment[]
  result: unknown | null
  cancel_reason?: string | null
  created_at: string
  updated_at: string
  links: {
    self: string
  }
}

export interface V1UploadSlot {
  upload_id: string
  upload_url: string
  expires_at: string
  purpose: 'context' | 'evidence'
}

export type WebhookEventType =
  | 'task.opened'
  | 'task.claimed'
  | 'task.submitted'
  | 'task.completed'
  | 'task.cancelled'
  | 'task.expired'
  | 'assignment.claimed'
  | 'assignment.submitted'
  | 'assignment.accepted'
  | 'assignment.rejected'
  | 'payment.settled'
  | 'payment.failed'

export interface V1WebhookEnvelope {
  id: string
  type: WebhookEventType
  created_at: string
  api_version: string
  data: {
    task_id: string
    assignment_id?: string
    submission_id?: string
    status?: string
    reason_code?: string
  }
}

export interface CreateTaskRequestInput {
  client_reference: string
  task_type: TaskType
  title: string
  instructions: InstructionsConfig
  input: Record<string, unknown>
  input_asset_ids?: string[]
  output_schema: Record<string, unknown>
  work_mode: WorkMode
  location?: TaskLocation
  worker_requirements?: WorkerRequirements
  proof_requirements: ProofRequirement[]
  dispatch: DispatchConfig
  reward: RewardConfig
  billing: BillingConfig
  metadata?: Record<string, unknown>
  callback_url?: string
}

export interface WorkerSubmissionInput {
  output: Record<string, unknown>
  artifacts: ArtifactItem[]
  worker_note?: string
}

export interface AssignmentDecisionInput {
  decision: 'accept' | 'reject'
  reason_code?: string
  feedback?: string
}

export function formatMinorUsd(minor: number, currency = 'USD'): string {
  const amount = (minor / 100).toFixed(2)
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`
}
