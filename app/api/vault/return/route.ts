import { NextRequest, NextResponse } from 'next/server'
import { getOperatorMandate, updateOperatorMandate } from '@/lib/db'
import { createPaymentTokenFromSetupToken } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const approvalSessionId =
    req.nextUrl.searchParams.get('approval_session_id') ||
    req.nextUrl.searchParams.get('approval_token_id') ||
    req.nextUrl.searchParams.get('token')

  const mandate = await getOperatorMandate()
  const setupToken = mandate.vault_id || approvalSessionId

  if (!setupToken) {
    return NextResponse.redirect(`${origin}/agent?vault=error`)
  }

  try {
    const permanentVaultId = await createPaymentTokenFromSetupToken(setupToken)
    await updateOperatorMandate({
      vault_id: permanentVaultId,
      vault_status: 'active',
      last_authorized_at: new Date().toISOString(),
    })
    return NextResponse.redirect(`${origin}/agent?vault=authorized`)
  } catch (err: any) {
    console.error('Failed to confirm PayPal Vault token:', err?.message)
    return NextResponse.redirect(`${origin}/agent?vault=error`)
  }
}
