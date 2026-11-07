import { CreateTaskRequestInput, WorkerSubmissionInput, AssignmentDecisionInput } from './v1-types'

export interface ValidationErrorDetail {
  field: string
  issue: string
}

export interface ValidationResult<T> {
  valid: boolean
  data?: T
  errors: ValidationErrorDetail[]
}

export function validateCreateTaskRequest(body: unknown): ValidationResult<CreateTaskRequestInput> {
  const errors: ValidationErrorDetail[] = []
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', issue: 'Request body must be a JSON object' }] }
  }

  const b = body as Record<string, any>

  // Required properties
  const required = [
    'client_reference',
    'task_type',
    'title',
    'instructions',
    'input',
    'output_schema',
    'work_mode',
    'worker_requirements',
    'proof_requirements',
    'dispatch',
    'reward',
    'billing',
  ]

  for (const field of required) {
    if (b[field] === undefined || b[field] === null) {
      errors.push({ field, issue: `Missing required field '${field}'` })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // client_reference
  if (typeof b.client_reference !== 'string' || b.client_reference.length < 1 || b.client_reference.length > 128) {
    errors.push({ field: 'client_reference', issue: 'client_reference must be a string between 1 and 128 characters' })
  }

  // task_type
  const validTaskTypes = ['digital_review', 'physical_check', 'data_collection', 'document_review', 'usability_test', 'other']
  if (!validTaskTypes.includes(b.task_type)) {
    errors.push({ field: 'task_type', issue: `task_type must be one of: ${validTaskTypes.join(', ')}` })
  }

  // title
  if (typeof b.title !== 'string' || b.title.length < 5 || b.title.length > 120) {
    errors.push({ field: 'title', issue: 'title must be a string between 5 and 120 characters' })
  }

  // instructions
  if (!b.instructions || typeof b.instructions !== 'object' || b.instructions.format !== 'markdown' || typeof b.instructions.body !== 'string' || b.instructions.body.length < 20 || b.instructions.body.length > 10000) {
    errors.push({ field: 'instructions', issue: 'instructions must have format: "markdown" and body between 20 and 10000 characters' })
  }

  // input
  if (!b.input || typeof b.input !== 'object') {
    errors.push({ field: 'input', issue: 'input must be an object' })
  }

  // output_schema
  if (!b.output_schema || typeof b.output_schema !== 'object' || Object.keys(b.output_schema).length === 0) {
    errors.push({ field: 'output_schema', issue: 'output_schema must be a valid non-empty JSON Schema object' })
  }

  // work_mode
  const validWorkModes = ['remote', 'on_site', 'hybrid']
  if (!validWorkModes.includes(b.work_mode)) {
    errors.push({ field: 'work_mode', issue: 'work_mode must be remote, on_site, or hybrid' })
  }

  // location rule: if on_site or hybrid, location is required with country_code and locality
  if (['on_site', 'hybrid'].includes(b.work_mode)) {
    if (!b.location || typeof b.location !== 'object') {
      errors.push({ field: 'location', issue: 'A location is required for on_site and hybrid work' })
    } else {
      if (!b.location.country_code || !/^[A-Z]{2}$/.test(b.location.country_code)) {
        errors.push({ field: 'location.country_code', issue: 'location.country_code must be a 2-letter ISO country code' })
      }
      if (!b.location.locality || typeof b.location.locality !== 'string' || b.location.locality.trim() === '') {
        errors.push({ field: 'location.locality', issue: 'location.locality is required' })
      }
    }
  }

  // proof_requirements
  if (!Array.isArray(b.proof_requirements) || b.proof_requirements.length < 1 || b.proof_requirements.length > 10) {
    errors.push({ field: 'proof_requirements', issue: 'proof_requirements must be an array of 1 to 10 items' })
  } else {
    for (let i = 0; i < b.proof_requirements.length; i++) {
      const p = b.proof_requirements[i]
      if (!p || typeof p.type !== 'string' || !['text', 'photo', 'video', 'file', 'screenshot'].includes(p.type)) {
        errors.push({ field: `proof_requirements[${i}].type`, issue: 'Invalid proof type' })
      }
      if (p.min_count !== undefined && p.max_count !== undefined && p.min_count > p.max_count) {
        errors.push({ field: `proof_requirements[${i}]`, issue: 'min_count must be <= max_count' })
      }
    }
  }

  // dispatch
  if (!b.dispatch || typeof b.dispatch !== 'object') {
    errors.push({ field: 'dispatch', issue: 'dispatch must be an object' })
  } else {
    if (typeof b.dispatch.assignment_count !== 'number' || b.dispatch.assignment_count < 1 || b.dispatch.assignment_count > 5) {
      errors.push({ field: 'dispatch.assignment_count', issue: 'assignment_count must be between 1 and 5' })
    }
    if (typeof b.dispatch.claim_timeout_seconds !== 'number' || b.dispatch.claim_timeout_seconds < 60 || b.dispatch.claim_timeout_seconds > 86400) {
      errors.push({ field: 'dispatch.claim_timeout_seconds', issue: 'claim_timeout_seconds must be between 60 and 86400' })
    }
    if (typeof b.dispatch.completion_deadline !== 'string' || Number.isNaN(Date.parse(b.dispatch.completion_deadline))) {
      errors.push({ field: 'dispatch.completion_deadline', issue: 'completion_deadline must be a valid RFC 3339 date-time string' })
    } else if (Date.parse(b.dispatch.completion_deadline) <= Date.now()) {
      errors.push({ field: 'dispatch.completion_deadline', issue: 'completion_deadline must be in the future' })
    }
    if (!['first_qualified', 'quality_ranked'].includes(b.dispatch.selection)) {
      errors.push({ field: 'dispatch.selection', issue: 'dispatch.selection must be first_qualified or quality_ranked' })
    }
  }

  // reward
  if (!b.reward || typeof b.reward !== 'object' || typeof b.reward.amount_minor !== 'number' || b.reward.amount_minor < 1 || !/^[A-Z]{3}$/.test(b.reward.currency)) {
    errors.push({ field: 'reward', issue: 'reward must have amount_minor (integer >= 1) and 3-letter currency' })
  }

  // billing
  if (!b.billing || typeof b.billing !== 'object' || !b.billing.funding_source_id || typeof b.billing.max_total_amount_minor !== 'number' || b.billing.max_total_amount_minor < 1 || !/^[A-Z]{3}$/.test(b.billing.currency)) {
    errors.push({ field: 'billing', issue: 'billing must have funding_source_id, max_total_amount_minor (>= 1), and 3-letter currency' })
  }

  // cross-field currency check
  if (b.reward?.currency && b.billing?.currency && b.reward.currency !== b.billing.currency) {
    errors.push({ field: 'currency', issue: 'reward.currency must match billing.currency' })
  }

  // budget sufficiency check
  if (b.reward?.amount_minor && b.dispatch?.assignment_count && b.billing?.max_total_amount_minor) {
    const requiredBudget = b.reward.amount_minor * b.dispatch.assignment_count
    if (b.billing.max_total_amount_minor < requiredBudget) {
      errors.push({
        field: 'billing.max_total_amount_minor',
        issue: `max_total_amount_minor (${b.billing.max_total_amount_minor}) cannot cover requested assignments (${requiredBudget})`,
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, data: b as CreateTaskRequestInput, errors: [] }
}

export function validateWorkerSubmission(
  submission: unknown,
  outputSchema: Record<string, any>,
  proofRequirements: Array<{ type: string; required: boolean; min_count?: number; max_count?: number }>
): {
  valid: boolean
  errors: string[]
  automatedChecks: Array<{ name: string; result: 'pass' | 'fail' | 'warn' | 'skip'; details?: string }>
} {
  const errors: string[] = []
  const automatedChecks: Array<{ name: string; result: 'pass' | 'fail' | 'warn' | 'skip'; details?: string }> = []

  if (!submission || typeof submission !== 'object') {
    return {
      valid: false,
      errors: ['Submission body must be an object'],
      automatedChecks: [{ name: 'envelope_check', result: 'fail', details: 'Missing body' }],
    }
  }

  const s = submission as WorkerSubmissionInput
  if (!s.output || typeof s.output !== 'object') {
    errors.push("Missing required 'output' object")
  }
  if (!Array.isArray(s.artifacts)) {
    errors.push("Missing required 'artifacts' array")
  }

  // Validate output against task output_schema properties
  if (s.output && typeof s.output === 'object' && outputSchema && outputSchema.properties) {
    const schemaProps = outputSchema.properties as Record<string, any>
    const requiredProps = (outputSchema.required as string[]) || []

    for (const reqProp of requiredProps) {
      if (s.output[reqProp] === undefined || s.output[reqProp] === null) {
        errors.push(`Field '${reqProp}' is required by task output_schema`)
      }
    }

    for (const [key, val] of Object.entries(s.output)) {
      const propDef = schemaProps[key]
      if (!propDef && outputSchema.additionalProperties === false) {
        errors.push(`Unrecognized property '${key}' not allowed by output_schema`)
      } else if (propDef) {
        if (propDef.type === 'string' && typeof val !== 'string') {
          errors.push(`Field '${key}' must be a string`)
        } else if (propDef.type === 'string' && propDef.maxLength && (val as string).length > propDef.maxLength) {
          errors.push(`Field '${key}' exceeds max length ${propDef.maxLength}`)
        } else if (propDef.type === 'boolean' && typeof val !== 'boolean') {
          errors.push(`Field '${key}' must be a boolean`)
        } else if (propDef.type === 'number' && typeof val !== 'number') {
          errors.push(`Field '${key}' must be a number`)
        }
      }
    }
  }

  automatedChecks.push({
    name: 'schema_validation',
    result: errors.length === 0 ? 'pass' : 'fail',
    details: errors.length === 0 ? 'All output schema constraints satisfied' : errors.join('; '),
  })

  // Validate proof requirements against submitted artifacts
  for (const proofReq of proofRequirements) {
    const matchingArtifacts = (s.artifacts || []).filter((a) => a.type === proofReq.type)
    if (proofReq.required && matchingArtifacts.length === 0) {
      errors.push(`Required proof of type '${proofReq.type}' was not submitted`)
      automatedChecks.push({
        name: `required_${proofReq.type}_present`,
        result: 'fail',
        details: `Expected at least ${proofReq.min_count ?? 1} item(s)`,
      })
    } else if (proofReq.min_count && matchingArtifacts.length < proofReq.min_count) {
      errors.push(`Expected at least ${proofReq.min_count} '${proofReq.type}' proof(s), received ${matchingArtifacts.length}`)
      automatedChecks.push({
        name: `min_${proofReq.type}_count`,
        result: 'fail',
        details: `Expected ${proofReq.min_count}, got ${matchingArtifacts.length}`,
      })
    } else {
      automatedChecks.push({
        name: `proof_${proofReq.type}_verified`,
        result: 'pass',
        details: `${matchingArtifacts.length} ${proofReq.type}(s) provided`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    automatedChecks,
  }
}

export function validateDecision(body: unknown): ValidationResult<AssignmentDecisionInput> {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', issue: 'Body must be JSON object' }] }
  }
  const b = body as Record<string, any>
  if (!['accept', 'reject'].includes(b.decision)) {
    return { valid: false, errors: [{ field: 'decision', issue: "decision must be 'accept' or 'reject'" }] }
  }
  return {
    valid: true,
    data: {
      decision: b.decision,
      reason_code: b.reason_code,
      feedback: b.feedback,
    },
    errors: [],
  }
}
