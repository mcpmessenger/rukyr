import { Resend } from 'resend'
import { TASK_TYPE_LABEL, usd, type EarnerAlertSubscription, type Proof, type Task } from './types'

const key = process.env.RESEND_API_KEY?.trim()
const FROM = process.env.EMAIL_FROM?.trim() || 'Rukyr <alerts@automationalien.com>'
const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || 'will@automationalien.com'
const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://rukyr.vercel.app'
).replace(/\/$/, '')
const CAN_SPAM_ADDRESS =
  process.env.CAN_SPAM_ADDRESS?.trim() || 'Rukyr · 1225 SW State St · Ankeny, IA 50023'

/** Fire-and-forget notification. Logs to console when Resend isn't configured. */
export async function notify(to: string | null | undefined, subject: string, body: string) {
  if (!to) return
  if (!key) {
    console.log(`[email:mock] to=${to} subject="${subject}"\n${body}`)
    return
  }
  try {
    const res = await new Resend(key).emails.send({ from: FROM, to, subject, text: body, reply_to: REPLY_TO })
    if (res.error) {
      console.error('[email] resend error:', res.error)
    }
  } catch (e) {
    console.error('[email] failed', e)
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatCentralDeadline(iso: string | null | undefined): string {
  if (!iso) return 'within 4 hours'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return 'within 4 hours'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

function summarizeTask(description: string): string {
  const clean = (description || '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Complete the requested physical verification and submit proof.'
  if (clean.length <= 200) return clean
  return clean.slice(0, 197).trimEnd() + '...'
}

/**
 * Sends a v1 Earner Alert email for a newly opened task.
 * Throws if Resend returns an error so the caller only records delivery on success.
 */
export async function sendTaskAlertEmail(
  task: Task,
  subscriber: EarnerAlertSubscription,
): Promise<{ mocked: boolean; id?: string }> {
  const reward = usd(task.price_cents)
  const taskType = TASK_TYPE_LABEL[task.task_type] || task.task_type.toUpperCase()
  const deadlineCentral = formatCentralDeadline(task.deadline_at)
  const summary = summarizeTask(task.description)
  const claimUrl = `${BASE_URL}/earn/tasks/${encodeURIComponent(task.id)}`
  const unsubscribeUrl = `${BASE_URL}/alerts/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`

  const subject = `New Rukyr task: ${task.title} — ${reward}`

  const text = [
    `${taskType} · ${reward}`,
    task.title,
    '',
    summary,
    '',
    `Claim by ${deadlineCentral} Central — unclaimed tasks expire and the escrow returns.`,
    '',
    `Claim this task: ${claimUrl}`,
    '',
    '---',
    `You signed up for Rukyr task alerts. Unsubscribe: ${unsubscribeUrl}`,
    CAN_SPAM_ADDRESS,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px 16px;background-color:#faf9f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #e5e2dc;border-radius:16px;padding:28px 24px;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#b85d34;">
        ${escapeHtml(taskType)} &middot; <span style="color:#16a34a;">${escapeHtml(reward)} PAYPAL ESCROW</span>
      </div>
      <h1 style="margin:8px 0 12px;font-size:20px;line-height:1.35;color:#131312;">
        ${escapeHtml(task.title)}
      </h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#403e39;">
        ${escapeHtml(summary)}
      </p>
      <div style="margin:0 0 22px;padding:12px 14px;background:#f4f1eb;border-radius:10px;font-size:13px;line-height:1.45;color:#33312c;">
        <strong>Claim by ${escapeHtml(deadlineCentral)} Central</strong> &mdash; unclaimed tasks expire and the escrow returns.
      </div>
      <div style="margin:0 0 8px;">
        <a href="${claimUrl}" style="display:inline-block;background-color:#131312;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:9999px;">
          Claim this task (${escapeHtml(reward)}) &rarr;
        </a>
      </div>
    </div>
    <div style="max-width:540px;margin:16px auto 0;text-align:center;font-size:12px;line-height:1.5;color:#78746c;">
      <p style="margin:0 0 4px;">
        You signed up for Rukyr task alerts.
        <a href="${unsubscribeUrl}" style="color:#78746c;text-decoration:underline;">Unsubscribe</a>
      </p>
      <p style="margin:0;font-size:11px;color:#9c978e;">
        ${escapeHtml(CAN_SPAM_ADDRESS)}
      </p>
    </div>
  </body>
</html>`

  if (!key) {
    console.log(`[email:mock:alert] to=${subscriber.email} subject="${subject}"\n${text}`)
    return { mocked: true }
  }

  const res = await new Resend(key).emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to: subscriber.email,
    subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
    },
  })

  if (res.error) {
    throw new Error(res.error.message || 'Resend API error')
  }

  return { mocked: false, id: res.data?.id }
}

/**
 * Sends a P0 operator alert when an earner submits proof for a task,
 * including the AI verdict, proof text, and a deep link to `/agent?task=<id>`.
 */
export async function sendProofSubmittedEmail(
  task: Task,
  proof: Proof,
  toEmail: string,
): Promise<{ mocked: boolean; id?: string }> {
  const cleanTo = toEmail.trim().toLowerCase()
  const reward = usd(task.price_cents)
  const taskType = TASK_TYPE_LABEL[task.task_type] || task.task_type.toUpperCase()
  const verdict = (proof.ai_verdict || 'unsure').toUpperCase()
  const confidence = Math.round((proof.ai_confidence ?? 0) * 100)
  const consoleUrl = `${BASE_URL}/agent?task=${encodeURIComponent(task.id)}`
  const proofText = (proof.proof_text || '').trim() || '(Image proof attached — click below to review)'

  const subject = `Proof waiting on Rukyr: ${task.title} — Review & release ${reward}`

  const text = [
    `PROOF WAITING FOR REVIEW · ${taskType} · ${reward}`,
    task.title,
    '',
    `Vision AI Verdict: ${verdict} (${confidence}% confidence)`,
    ...(proof.ai_reasoning ? [`AI Reasoning: ${proof.ai_reasoning}`] : []),
    '',
    'Submitted Proof:',
    proofText,
    ...(proof.proof_image_url ? [`Proof Image: ${proof.proof_image_url}`] : []),
    '',
    `Review & release ${reward} in Agent Console: ${consoleUrl}`,
    '',
    '---',
    CAN_SPAM_ADDRESS,
  ].join('\n')

  const verdictBg = verdict === 'PASS' ? '#dcfce7' : verdict === 'FAIL' ? '#fee2e2' : '#fef3c7'
  const verdictColor = verdict === 'PASS' ? '#166534' : verdict === 'FAIL' ? '#991b1b' : '#92400e'

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px 16px;background-color:#faf9f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #e5e2dc;border-radius:16px;padding:28px 24px;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#d97706;">
        &#9679; PROOF WAITING &middot; ${escapeHtml(taskType)} &middot; ${escapeHtml(reward)}
      </div>
      <h1 style="margin:8px 0 12px;font-size:20px;line-height:1.35;color:#131312;">
        ${escapeHtml(task.title)}
      </h1>
      <div style="margin:0 0 14px;padding:10px 14px;background:${verdictBg};color:${verdictColor};border-radius:10px;font-size:12px;line-height:1.45;">
        <strong>Vision AI Verdict: ${escapeHtml(verdict)} (${confidence}% confidence)</strong>
        ${proof.ai_reasoning ? `<div style="margin-top:4px;opacity:0.9;">${escapeHtml(proof.ai_reasoning)}</div>` : ''}
      </div>
      <div style="margin:0 0 20px;padding:14px;background:#f8f7f3;border:1px solid #e5e2dc;border-radius:10px;font-size:13px;line-height:1.55;color:#1c1b18;white-space:pre-wrap;">${escapeHtml(proofText)}</div>
      <div style="margin:0 0 8px;">
        <a href="${consoleUrl}" style="display:inline-block;background-color:#131312;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:9999px;">
          Review &amp; Release ${escapeHtml(reward)} in Agent Console &rarr;
        </a>
      </div>
    </div>
    <div style="max-width:540px;margin:16px auto 0;text-align:center;font-size:11px;line-height:1.5;color:#9c978e;">
      ${escapeHtml(CAN_SPAM_ADDRESS)}
    </div>
  </body>
</html>`

  if (!key) {
    console.log(`[email:mock:proof] to=${cleanTo} subject="${subject}"\n${text}`)
    return { mocked: true }
  }

  const res = await new Resend(key).emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to: cleanTo,
    subject,
    text,
    html,
  })

  if (res.error) {
    throw new Error(res.error.message || 'Resend API error')
  }

  return { mocked: false, id: res.data?.id }
}
