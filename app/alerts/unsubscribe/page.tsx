import Link from 'next/link'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { unsubscribeEarnerAlertByToken } from '@/lib/db'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unsubscribe from Task Alerts',
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const sub = token ? await unsubscribeEarnerAlertByToken(token) : null

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-5 py-16 sm:px-6">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-6 sm:p-8 shadow-xs text-center">
          {sub ? (
            <>
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#8bd3a8]">
                <CheckCircle2 className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                You&apos;re unsubscribed
              </h1>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-200">{sub.email}</span> will
                no longer receive Rukyr task alert emails.
              </p>
              <div className="mt-6">
                <Link
                  href="/earn"
                  className="inline-flex items-center justify-center rounded-full bg-neutral-900 dark:bg-[#f4a261] px-5 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] transition-opacity hover:opacity-90"
                >
                  Back to Earn Marketplace
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-[#f4a261]">
                <AlertCircle className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                Invalid unsubscribe link
              </h1>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                This unsubscribe link is missing or unrecognized. If you need help, visit the Earn Marketplace.
              </p>
              <div className="mt-6">
                <Link
                  href="/earn"
                  className="inline-flex items-center justify-center rounded-full bg-neutral-900 dark:bg-[#f4a261] px-5 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] transition-opacity hover:opacity-90"
                >
                  Go to Earn Marketplace
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
