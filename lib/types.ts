export type TaskType =
  | 'verification'
  | 'bot_gate'
  | 'phone_call'
  | 'taste_call'
  | 'local_presence'
  | 'spend_approval'

export type TaskStatus =
  | 'pending_funding'
  | 'scheduled'
  | 'open'
  | 'claimed'
  | 'submitted'
  | 'verified'
  | 'paid'
  | 'cancelled'
  | 'expired'

export type EscrowStatus = 'pending' | 'held' | 'captured' | 'voided'

export interface Profile {
  id: string
  kind: 'agent' | 'human'
  display_name: string
  paypal_email: string | null
  reputation: number
  created_at: string
}

export interface Task {
  id: string
  agent_id: string
  title: string
  description: string
  task_type: TaskType
  price_cents: number
  status: TaskStatus
  proof_requirements: string
  claimed_by: string | null
  claimed_at: string | null
  deadline_at: string | null
  execute_at?: string | null
  deadline_minutes?: number
  status_reason?: string | null
  created_at: string
}

export interface Proof {
  id: string
  task_id: string
  human_id: string
  proof_text: string
  proof_image_url: string | null
  ai_verdict: 'pass' | 'fail' | 'unsure' | null
  ai_confidence: number | null
  ai_reasoning: string | null
  submitted_at: string
}

export interface Escrow {
  id: string
  task_id: string
  paypal_order_id: string | null
  paypal_authorization_id: string | null
  amount_cents: number
  platform_fee_cents: number
  status: EscrowStatus
  created_at: string
  captured_at: string | null
}

export type BidStatus = 'pending' | 'accepted' | 'rejected'

export interface Bid {
  id: string
  task_id: string
  bidder_id: string
  bid_cents: number
  eta_minutes: number
  pitch: string
  status: BidStatus
  created_at: string
  bidder?: Profile
}

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  verification: 'PHOTO PROOF',
  bot_gate: 'BOT GATE',
  phone_call: 'PHONE CALL',
  taste_call: 'TASTE CALL',
  local_presence: 'LOCAL PRESENCE',
  spend_approval: 'SPEND APPROVAL',
}

export const CLAIM_TIMEOUT_MS = 30 * 60 * 1000

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

export interface OperatorMandate {
  vault_id: string | null
  vault_status: 'active' | 'pending_approval' | 'unauthorized' | 'revoked'
  weekly_cap_cents: number
  spent_this_week_cents: number
  per_task_cap_cents: number
  operator_email: string
  last_authorized_at: string | null
}

export interface EarnerAlertSubscription {
  id: string
  email: string
  active: boolean
  unsubscribe_token: string
  created_at: string
  unsubscribed_at: string | null
}

export interface AlertDelivery {
  task_id: string
  subscriber_email: string
  sent_at: string
}
