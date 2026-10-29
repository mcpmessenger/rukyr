import { NextRequest, NextResponse } from 'next/server'
import { addProof, getDemoProfile, getTask, notifyOperatorOnProofSubmitted, storeProofImage, updateTask } from '@/lib/db'
import { verifyProof } from '@/lib/ai-verify'
import { approveTask } from '@/lib/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
/** Set AUTO_RELEASE_CONFIDENCE (e.g. 0.9) to auto-pay when the AI passes with that confidence. Off by default. */
const AUTO_RELEASE = Number(process.env.AUTO_RELEASE_CONFIDENCE ?? 0)

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const task = await getTask(id)
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  const human = await getDemoProfile('human')
  if (task.status !== 'claimed' || task.claimed_by !== human.id) {
    return NextResponse.json({ error: 'You have not claimed this task (or the claim expired)' }, { status: 409 })
  }

  const form = await req.formData()
  const text = String(form.get('proof_text') ?? '').slice(0, 2000)
  const file = form.get('image')
  let imageUrl: string | null = null
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Proof must be an image' }, { status: 400 })
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image too large (6MB max)' }, { status: 413 })
    imageUrl = await storeProofImage(file)
  }
  if (!imageUrl && !text.trim()) {
    return NextResponse.json({ error: 'Submit a photo or notes' }, { status: 400 })
  }

  const verdict = await verifyProof(task, { proof_text: text, proof_image_url: imageUrl })
  const proof = await addProof({ task_id: id, human_id: human.id, proof_text: text, proof_image_url: imageUrl, ...verdict })
  let updated = await updateTask(id, { status: 'submitted' })

  await notifyOperatorOnProofSubmitted(updated, proof)

  if (AUTO_RELEASE > 0 && verdict.ai_verdict === 'pass' && (verdict.ai_confidence ?? 0) >= AUTO_RELEASE) {
    updated = (await approveTask(updated)).task
  }
  return NextResponse.json({ task: updated, proof })
}
