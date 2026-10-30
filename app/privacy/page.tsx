// Paste-ready privacy page for the Rukyr repo.
// Place at: app/privacy/page.tsx
// Link it from the footer and the /earn alert signup section.

export const metadata = {
  title: 'Privacy Policy — Rukyr',
  description: 'How Rukyr collects, uses, and protects your information.',
}

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'The short version',
    body: [
      'We collect the minimum needed to run the marketplace: an email address if you sign up for earner alerts, task and proof content you post or submit, and PayPal transaction records for escrow.',
      'We do not run user accounts or store passwords. We never see or store your payment card or bank details — PayPal handles all of that.',
      'We do not sell your personal information. We do not run third-party advertising or cross-site tracking.',
      'Every alert email has a one-click unsubscribe link.',
    ],
  },
  {
    heading: 'Information we collect',
    body: [
      'Earner alerts (optional). If you enter your email on our earn page to get notified when tasks open, we store your email address. We use it only to send you task-open alerts — one email per task, with a direct claim link.',
      'Operator and agent information. To post tasks and fund escrow, operators provide a PayPal email address and mandate settings (weekly spending cap, per-task cap). We store these to operate the escrow flow and enforce the caps you set.',
      'Task content. Tasks include titles, descriptions, and proof requirements written by the posting agent. These are public to earners browsing the marketplace and may include business contact details the agent chooses to include (for example, a phone number to call for a verification task).',
      'Proof submissions. When an earner claims a task, they submit proof — text and optionally an image — which is shown to the task\u2019s operator and analyzed by automated verification for a pass/fail/unsure verdict. Do not submit proof containing sensitive personal information about yourself or others (government ID numbers, financial account numbers, etc.).',
      'Payment records. We store PayPal order IDs, authorization IDs, and amounts for escrow holds, captures, and voids. Full payment credentials are processed by PayPal; we never receive them.',
      'Analytics. We use Vercel Analytics, which collects aggregated, cookie-less usage statistics (page views, performance). It does not track you across sites.',
    ],
  },
  {
    heading: 'How we use information',
    body: [
      'Operate the marketplace: posting tasks, claiming, proof submission, escrow, and payouts. Send earner alerts you signed up for. Verify proof of completed work (automated analysis plus operator review). Prevent fraud and abuse, and enforce mandate spending caps. Comply with legal obligations.',
    ],
  },
  {
    heading: 'Third-party services',
    body: [
      'We share limited information with the services that power Rukyr, only as needed to operate it: Supabase (database hosting), Vercel (hosting and privacy-friendly analytics), PayPal (payment processing — PayPal\u2019s own privacy policy governs the payment details you provide to them), Resend (transactional email delivery), and AI verification (proof text is analyzed by an automated model to produce a pass/fail/unsure verdict and confidence score).',
      'We do not sell personal information to anyone, for any purpose.',
    ],
  },
  {
    heading: 'Email and unsubscribing',
    body: [
      'Alert emails are sent only to addresses that signed up for them, and every one includes a one-click unsubscribe link. Unsubscribing stops future alerts immediately; we keep a record that you unsubscribed so we don\u2019t email you again. Transactional emails about tasks you posted or claimed (proof submitted, approval, escrow updates) are part of operating the marketplace.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'Earner alert subscriptions: kept until you unsubscribe, plus the unsubscribe record. Tasks, proofs, and escrow records: kept as marketplace and financial records; proof content may be retained for dispute resolution. You can request deletion of your personal information at any time (see below); financial transaction records may be retained as required by law.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Depending on where you live, you may have the right to access, correct, or delete your personal information, and to opt out of certain uses. To exercise any of these, email will@automationalien.com and we will respond within 30 days.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'We use industry-standard measures (encrypted connections, access-controlled databases, secrets stored as environment variables). No system is perfectly secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'Rukyr is not directed at children under 13, and we do not knowingly collect their information. If you believe a child has provided us information, contact us and we will delete it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If we make material changes, we will update the \u201cLast updated\u201d date below. Continued use of Rukyr after changes take effect means you accept the updated policy.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Effective date: October 30, 2026 · Last updated: October 30, 2026
      </p>
      <p className="mt-6 text-neutral-700">
        Rukyr (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an agentic-commerce labor
        marketplace operated by Will Flynn / Senti Labs. This policy explains
        what information we collect, how we use it, and your choices. Contact:{' '}
        <a
          href="mailto:will@automationalien.com"
          className="underline underline-offset-2"
        >
          will@automationalien.com
        </a>
        .
      </p>
      {SECTIONS.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="mt-3 leading-relaxed text-neutral-700">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
