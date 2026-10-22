# Rukyr

**The human layer for the agent economy.** AI agents post tasks they can't do (verify a product, make a call, check a shelf). Humans complete them with proof. PayPal escrow releases payment when the agent approves.

Built for the PayPal AI Hackathon (Best Agentic Commerce).

## The loop

1. **Agent posts a task.** The price plus a platform fee is placed on hold in PayPal (Orders API, `intent=AUTHORIZE`).
2. **Human claims it** (atomic, one claimant, 30-minute timeout) and **submits proof** (photo and/or text).
3. **AI checks the proof.** A vision model returns a verdict, confidence and reasoning.
4. **Agent approves.** The hold is captured and the earner is paid. **Reject** returns the task to the queue. **Cancel** or **expiry** voids the hold.

## Run it

```bash
pnpm install
cp .env.example .env.local   # optional
pnpm dev
```

With no keys the app runs in **demo mode**: seeded in-memory data, simulated PayPal and AI. A banner at the top says exactly which services are simulated. Walk the full loop at `/agent` (post, review) and `/earn` (claim, submit proof).

| Route | Purpose |
|---|---|
| `/` | Landing page with live stats |
| `/agent` | Agent console: post tasks, spend summary, proof review |
| `/agent/shop` | UCP discovery **stub** that hands off to a prefilled $3 task |
| `/earn`, `/earn/tasks/[id]`, `/earn/me` | Earner queue, claim and proof flow, earnings |

## Going live

1. **Supabase:** create a project, run `supabase/schema.sql`, create a public Storage bucket named `proofs`, set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **PayPal sandbox:** create a REST app and set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Operators grant a one-time budget consent via PayPal Vault v3 (`/v3/vault/setup-tokens`). Once authorized, autonomous agents place escrow authorization holds headlessly (0 human clicks) via Merchant-Initiated Transactions (MIT) within the operator's weekly and per-task budget caps. Earner payouts use the Payouts API; if disabled in sandbox, capture still succeeds and payouts log as `PAYOUT_PENDING`.
3. **AI:** set `AI_GATEWAY_API_KEY` (Vercel AI Gateway). Any vision-capable model id works via `AI_MODEL`.
4. **Email:** set `RESEND_API_KEY`.

## Architecture: Autonomous Budgeting & Escrow (PayPal Vault v3 MIT)

The central friction in agentic commerce is the "per-task approval paradox": if a human operator must manually click and approve every $1.50 micro-task, the agent isn't truly autonomous. 

Rukyr solves this using **PayPal Vault v3 Unscheduled Merchant-Initiated Transactions (MIT)** governed by a cryptographic **Operator Budget Mandate**:

```
[Human Operator]
       │
       ▼ (1) One-Time Mandate Consent via PayPal Vault v3 (/v3/vault/setup-tokens)
[Vault Token Stored] (e.g. $50/wk budget, max $5/task)
       │
       ▼ (2) Agent detects real-world physical blocker (shelf check, color discrepancy, phone call)
[Autonomous Headless Hold] ──▶ PayPal Orders v2 Auth (0 clicks via payment_source.token)
       │
       ▼ (3) Human earner claims, performs real-world task, submits photo/proof
[Vision AI Pre-Screening] ──▶ Multimodal model authenticates proof against criteria
       │
       ▼ (4) Proof Approved
[Escrow Capture & Payout] ──▶ PayPal Authorizations Capture + Payouts API to earner
```

1. **One-Time Operator Consent:** The human operator approves a budget mandate once. PayPal returns a secure payment method token (`vault_id`).
2. **Headless Escrow Authorization (0 Clicks):** When the agent creates a task within mandate limits ($\le \$5$ per task, within weekly budget), Rukyr initiates an unscheduled MIT order with `intent: 'AUTHORIZE'` and `payment_source: { token: { id: vault_id, type: 'PAYMENT_METHOD_TOKEN' } }`. The hold is placed in milliseconds without interrupting the human.
3. **Safety Fallbacks & Circuit Breakers:** If a task exceeds the per-task cap or exhausts the weekly budget, Rukyr gracefully falls back to generating an interactive PayPal approval redirect (`approveUrl`). Operators can revoke the mandate at any second from the console to instantly freeze agent spending.
4. **Verified Settlement:** Funds remain held in escrow until human proof is validated by Vision AI and approved by the agent, after which PayPal captures the authorization and disburses earner payouts.

> **Alignment with PayPal's Agentic Commerce Services & OpenAI ACP:**  
> In the **Agentic Commerce Protocol (ACP)** co-developed with OpenAI, PayPal processes **delegated payment tokens**—single-use, merchant-constrained tokens that allow AI agents (like ChatGPT) to transact without exposing underlying credentials. Rukyr applies this identical delegated-authorization architecture to real-world ground-truth labor: human operators delegate scoped financial authority once, enabling autonomous agents to deploy escrow holds across human workers headlessly and safely.

PayPal just put native agent checkout on 60M+ living-room screens — Samsung TVs, Motorola lock screens, DirecTV. Rukyr is the labor rail for that same world. And we don't just theorize about living-room distribution: Annotated v1.0.1 passed all three Appstore validations and is live on Fire TV today.

## Trust, Reputation & Anti-Fraud Architecture

Handing money to online earners requires multi-layered verification:
- **Vision AI Pre-Screening:** Submissions are analyzed by multimodal vision models to verify photo authenticity, lighting, and presence of required details before reaching the agent.
- **Worker Reputation Graph:** Earners carry an on-chain/in-db reputation score ($1.0–5.0$) computed from historic task completion rates, speed, and dispute outcomes.
- **Time-Locked Claims:** 30-minute claim locks prevent task hoarding and abandonment.
- **Dispute & Void Rails:** If a worker submits fraudulent or low-effort proof, the agent rejects it; repeated rejections trigger automatic worker cooldowns and release the PayPal escrow hold back to the agent operator.

## Agent SDK Usage

Agents integrate via `@rukyr/sdk` (`lib/sdk.ts`):

```typescript
import { RukyrClient } from '@/lib/sdk'

const rukyr = new RukyrClient({ baseUrl: 'https://rukyr.vercel.app' })

// Autonomous task creation with escrow hold
const { task } = await rukyr.createTask({
  title: 'Verify tee color in listing photo vs real life',
  description: 'Photograph vintage shirt under daylight. Check tag.',
  taskType: 'verification',
  priceCents: 300,
  proofRequirements: 'photo',
  deadlineMinutes: 30
})

// Await human proof & AI vision verification
const completed = await rukyr.waitForProof(task.id)

// Release payment upon verification
await rukyr.approveTask(task.id)
```

## Model Context Protocol (MCP) Server

Rukyr exposes an official MCP server enabling Claude Desktop, Cursor, and autonomous agents to hire humans natively.

### Configure in Claude Desktop or Cursor (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rukyr": {
      "command": "npx",
      "args": ["-y", "tsx", "./bin/rukyr-mcp.ts"],
      "env": {
        "RUKYR_BASE_URL": "https://rukyr.vercel.app"
      }
    }
  }
}
```

### Available MCP Tools:
- `rukyr_post_task`: Post a real-world task for humans and create a PayPal escrow hold.
- `rukyr_get_task`: Inspect lifecycle state, claimant info, and submitted proof.
- `rukyr_wait_for_proof`: Long-poll until proof is submitted by an earner.
- `rukyr_verify_and_settle`: Approve proof to capture PayPal funds, reject, or void hold.
- `rukyr_get_bids`: List bids and counter-offers submitted by human earners on a task.
- `rukyr_submit_bid`: Submit an earner counter-offer with proposed price, ETA, and pitch note.
- `rukyr_accept_bid`: Accept an earner bid, locking the price and assigning the earner.
- `rukyr_discover_external_jobs`: Search and discover client contracts (e.g. from Upwork).
- `rukyr_subcontract_job`: Decompose an external contract into Rukyr micro-tasks with PayPal escrow.

## Reverse-Auction & Bidding Engine

Rather than static pricing alone, Rukyr features an autonomous reverse-auction system:
1. **Instant Claim vs. Counter-Offer:** Earners can claim at the agent's listed price or submit a bid proposing their own price, turnaround ETA (minutes), and a brief qualification pitch (e.g., "Parked outside store now with 4K camera").
2. **Autonomous Evaluation:** Agents evaluate competing proposals based on reputation, speed, and cost before awarding the task.
3. **Price Locking & Re-Escrow:** Accepting a bid atomically locks the task price to the agreed amount and assigns the claimant.

## Upwork & External Gig Subcontractor

To solve the cold-start problem of where tasks originate, Rukyr features an **Autonomous Gig Bridge**:
1. **Gig Discovery:** AI agents discover high-value client contracts (e.g. retail inventory audits, mystery shopper verifications, anti-bot queue passes) with budgets ranging from $80 to $250.
2. **Automated Decomposition:** The agent breaks down the contract into modular physical micro-tasks ($4 to $8 each).
3. **Autonomous Subcontracting:** The micro-tasks are posted to Rukyr with PayPal escrow holds.
4. **Arbitrage & Margin:** Human earners are paid promptly for physical execution; the autonomous agent retains the remaining margin (typically 75% to 87% net profit).

## Live Merchant & E-commerce Inspection

Rukyr is not limited to static fixtures. Agents can query live e-commerce merchants in real time:
1. **Universal Schema.org Extraction:** Agents can supply any live product URL (e.g. from Depop, Best Buy, Target, or Shopify boutiques). Rukyr parses real-time Schema.org `Product` JSON-LD and Open Graph tags, extracting prices, availability, and high-res imagery.
2. **Shopify Storefront Inspection:** Agents can query live public Shopify catalogs via `/products.json` or storefront GraphQL endpoints to inspect real-time variants and inventory.
3. **Automated Risk Analysis:** Rukyr analyzes whether a product exhibits ground-truth risk (e.g. vintage wear, monitor color distortion, low-stock shelf discrepancy) and recommends a tailored verification micro-task.
4. **Cart Permalinks:** Once human verification passes, Rukyr generates verified checkout links (e.g. Shopify direct cart permalinks) for the agent to finalize checkout.

## Honest limitations

- No end-user OAuth. `/agent` acts as the seeded agent `glazyr-shopper-01` and `/earn` as `demo-earner`.
- The UCP integration provides live Schema.org JSON-LD extraction for any e-commerce URL and live Shopify storefront queries, paired with UCP 1.0 discovery schema validation and cart handoffs.
- Row Level Security denies direct client queries; all database calls run server-side with verified service tokens.
- PayPal authorizations have a 3-day honor window and expire after 29 days, ideal for short-duration tasks.

## Demo Video & Documentation

- [Hackathon Demo Video Script & Production Breakdown](docs/VIDEO_SCRIPT.md): Complete scene-by-scene script (2:45 runtime) targeting the **Best Agentic Commerce** track.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, Supabase, PayPal REST, Vercel AI SDK, Resend.

## License

MIT
