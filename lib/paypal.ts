/**
 * PayPal helpers: authorize-and-hold (escrow), capture, void, payout.
 *
 * Live mode (PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET set) talks to the PayPal
 * REST API (sandbox by default). Without keys it runs in MOCK mode so the full
 * loop is demoable; mock mode is clearly labelled in the UI.
 *
 * Escrow model: an Orders v2 order with intent=AUTHORIZE. The operator approves it
 * at PayPal, we authorize it (funds held), then capture on verification or void on
 * rejection/timeout. Authorizations have a ~3 day honor period and last 29 days.
 */

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID?.trim()
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim()
const MODE = (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox'
const BASE = MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

export const paypalLive = Boolean(CLIENT_ID && CLIENT_SECRET)
export const paypalMode = paypalLive ? MODE : 'mock'

export const FEE_PCT = Number((process.env.PLATFORM_FEE_PCT ?? '15').trim())
export const feeFor = (priceCents: number) => Math.round((priceCents * FEE_PCT) / 100)

async function token(): Promise<string> {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`)
  return (await res.json()).access_token
}

async function pp<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const t = await token()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    method: init.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
    },
    body: init.json === undefined ? undefined : JSON.stringify(init.json),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PayPal ${path} ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

const money = (cents: number) => (cents / 100).toFixed(2)

export interface Hold {
  orderId: string
  /** Where the operator must approve the hold. null in mock mode or when authorized via Vault. */
  approveUrl: string | null
  /** True when authorized headlessly without operator redirect via PayPal Vault token. */
  headless?: boolean
  authorizationId?: string | null
}

/** Step 1: create the order for price + fee. Supports headless Vault MIT or interactive flow. */
export async function createHold(opts: {
  taskId: string
  totalCents: number
  returnUrl: string
  cancelUrl: string
  description: string
  vaultId?: string | null
}): Promise<Hold> {
  // If a vaultId is present, execute a headless Merchant-Initiated Transaction (MIT)
  if (opts.vaultId) {
    if (!paypalLive) {
      return {
        orderId: 'MOCK-VAULT-' + opts.taskId.slice(0, 8),
        approveUrl: null,
        headless: true,
        authorizationId: 'AUTH-VAULT-MOCK-' + opts.taskId.slice(0, 8),
      }
    }

    try {
      const order = await pp<{
        id: string
        status: string
        purchase_units: Array<{
          payments?: {
            authorizations?: Array<{ id: string; status: string }>
          }
        }>
      }>('/v2/checkout/orders', {
        json: {
          intent: 'AUTHORIZE',
          purchase_units: [
            {
              reference_id: opts.taskId,
              description: opts.description.slice(0, 120),
              amount: { currency_code: 'USD', value: money(opts.totalCents) },
            },
          ],
          payment_source: {
            token: {
              id: opts.vaultId,
              type: 'PAYMENT_METHOD_TOKEN',
            },
          },
        },
      })

      const authId = order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id || null
      return {
        orderId: order.id,
        approveUrl: null,
        headless: true,
        authorizationId: authId,
      }
    } catch (err: any) {
      console.warn('Vault MIT order failed, falling back to standard payer approval:', err?.message)
    }
  }

  // Standard interactive approval flow
  if (!paypalLive) return { orderId: 'MOCK-' + opts.taskId.slice(0, 8), approveUrl: null, headless: false }
  const order = await pp<{ id: string; links: { rel: string; href: string }[] }>('/v2/checkout/orders', {
    json: {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: opts.taskId,
          description: opts.description.slice(0, 120),
          amount: { currency_code: 'USD', value: money(opts.totalCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: opts.returnUrl,
            cancel_url: opts.cancelUrl,
            user_action: 'PAY_NOW',
            brand_name: 'Rukyr',
          },
        },
      },
    },
  })
  const link = order.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve')
  return { orderId: order.id, approveUrl: link?.href ?? null, headless: false }
}

/** Step 1b: create a PayPal Vault setup session for one-time operator mandate consent. */
export async function createVaultSetupSession(opts: {
  returnUrl: string
  cancelUrl: string
}): Promise<{ setupToken: string; approveUrl: string | null }> {
  if (!paypalLive) {
    return {
      setupToken: 'VAULT_TOKEN_MANDATE_' + Date.now().toString(36),
      approveUrl: null,
    }
  }

  const res = await pp<{ id: string; links: { rel: string; href: string }[] }>('/v3/vault/setup-tokens', {
    json: {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
          experience_context: {
            brand_name: 'Rukyr Agentic Commerce',
            return_url: opts.returnUrl,
            cancel_url: opts.cancelUrl,
          },
        },
      },
    },
  })
  const link = res.links?.find((l) => l.rel === 'approve')
  if (!res.id || !link?.href) {
    throw new Error('PayPal Vault setup-tokens response missing id or approve link')
  }
  return { setupToken: res.id, approveUrl: link.href }
}

/** Step 1c: after operator approves setup token, exchange it for a permanent vaulted payment token. */
export async function createPaymentTokenFromSetupToken(setupTokenId: string): Promise<string> {
  if (!paypalLive) return 'vault_token_mock_' + setupTokenId.slice(0, 8)

  const res = await pp<{ id: string; status?: string }>('/v3/vault/payment-tokens', {
    json: {
      payment_source: {
        token: {
          id: setupTokenId,
          type: 'SETUP_TOKEN',
        },
      },
    },
  })
  if (!res.id) {
    throw new Error('PayPal Vault payment-tokens exchange returned no token id')
  }
  return res.id
}

/** Step 2: after the operator approves, place the authorization (funds held). */
export async function authorizeOrder(orderId: string): Promise<string> {
  if (!paypalLive) return 'MOCK-AUTH-' + orderId.replace('MOCK-', '')
  const r = await pp<{ purchase_units: { payments: { authorizations: { id: string }[] } }[] }>(
    `/v2/checkout/orders/${orderId}/authorize`,
  )
  const id = r.purchase_units?.[0]?.payments?.authorizations?.[0]?.id
  if (!id) throw new Error('PayPal returned no authorization id')
  return id
}

/** Capture a held authorization (human approved the proof). */
export async function captureAuthorization(authorizationId: string): Promise<string> {
  if (!paypalLive || authorizationId.startsWith('MOCK')) return 'MOCK-CAPTURE'
  const r = await pp<{ id: string }>(`/v2/payments/authorizations/${authorizationId}/capture`, {
    json: { final_capture: true },
  })
  return r.id
}

/** Release the hold (rejection, timeout, cancel). */
export async function voidAuthorization(authorizationId: string): Promise<void> {
  if (!paypalLive || authorizationId.startsWith('MOCK')) return
  await pp(`/v2/payments/authorizations/${authorizationId}/void`)
}

/**
 * Pay the earner after capture. Requires Payouts to be enabled on the PayPal app.
 * Returns the batch id, or a status string when payouts are unavailable.
 */
export async function payEarner(opts: { email: string; cents: number; taskId: string }): Promise<string> {
  if (!paypalLive) return 'MOCK-PAYOUT'
  try {
    const r = await pp<{ batch_header: { payout_batch_id: string } }>('/v1/payments/payouts', {
      json: {
        sender_batch_header: {
          sender_batch_id: `Rukyr-${opts.taskId}`,
          email_subject: 'You earned money on Rukyr',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            receiver: opts.email,
            amount: { value: money(opts.cents), currency: 'USD' },
            note: 'Rukyr task payout',
            sender_item_id: opts.taskId,
          },
        ],
      },
    })
    return r.batch_header.payout_batch_id
  } catch (e) {
    console.error('[paypal] payout failed (is Payouts enabled?)', e)
    return 'PAYOUT_PENDING'
  }
}

