import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { MerchantInspector } from '@/components/merchant-inspector'
import { queryUcpCatalog } from '@/lib/ucp'
import { ArrowUpRight } from 'lucide-react'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Agent Shop & Universal Discovery',
  description: 'Inspect live products via Schema.org JSON-LD and Shopify storefronts with UCP 1.0 discovery.',
  alternates: { canonical: '/agent/shop' },
}

export default async function ShopPage() {
  const products = await queryUcpCatalog()

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#121211] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Agent Shop & Universal Discovery
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 max-w-2xl leading-relaxed">
            Autonomous agent shopping interface. Inspect live products via Schema.org JSON-LD or Shopify storefronts.
            When vision models detect ground-truth discrepancy risks, post an escrowed verification micro-task.
          </p>
        </div>

        {/* Live Merchant & Product Inspector */}
        <MerchantInspector />

        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Universal Commerce Protocol Reference Catalog
            </h2>
            <span className="rounded-full bg-neutral-200/80 dark:bg-neutral-800 px-3 py-1 font-mono text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">
              UCP 1.0 Spec
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Compliant with Google and Shopify Universal Commerce Protocol specifications for agent shopping discovery.
          </p>

          {products.map((p) => (
            <article
              key={p.id}
              className="mt-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 sm:p-6 shadow-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center p-4">
                <img
                  src={p.images[0]?.url || '/vintage-band-tee.svg'}
                  alt={p.title}
                  className="h-52 w-full object-contain"
                />
              </div>

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {p.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500 font-mono">
                    {p.merchant.name} ({p.merchant.domain})
                  </p>
                </div>
                <span className="font-mono text-xl sm:text-2xl font-bold text-[#cf6a42] dark:text-[#f4a261]">
                  ${p.price.amount}
                </span>
              </div>

              {p.verificationReason && (
                <div className="mt-4 rounded-xl bg-amber-50 dark:bg-[#33281c] border border-amber-200 dark:border-amber-800/60 p-3 text-xs text-amber-900 dark:text-[#f4a261]">
                  <strong>UCP Agent Check Required:</strong> {p.verificationReason}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  Headless authorization hold available via Vault
                </span>
                <Link
                  href={`/agent?${new URLSearchParams({
                    title: 'Verify tee color in listing photo vs. real life',
                    description: `UCP Product: ${p.title} (${p.id}). ${p.verificationReason}`,
                    type: 'verification',
                    price: '300',
                    proof: 'photo',
                  })}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-5 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] hover:opacity-90 transition-opacity shadow-xs"
                >
                  Post $3.00 Verification Task <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
