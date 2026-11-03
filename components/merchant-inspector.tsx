'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { LiveProduct, VerificationAnalysis } from '@/lib/merchant-live'
import { Search, Store, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'

const PRESET_EXAMPLES = [
  {
    label: 'Vintage Denim Jacket',
    url: 'https://demo-vintage.myshopify.com/products/vintage-tee-1994',
    type: 'url',
  },
  {
    label: 'Allbirds Store',
    domain: 'allbirds.com',
    type: 'store',
  },
  {
    label: 'Gymshark Store',
    domain: 'gymshark.com',
    type: 'store',
  },
]

export function MerchantInspector() {
  const [mode, setMode] = useState<'url' | 'store'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [domainInput, setDomainInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [singleResult, setSingleResult] = useState<{
    product: LiveProduct
    analysis: VerificationAnalysis
  } | null>(null)
  const [storeResults, setStoreResults] = useState<
    Array<{ product: LiveProduct; analysis: VerificationAnalysis }>
  >([])

  async function inspect(targetUrl?: string, targetDomain?: string) {
    const url = targetUrl ?? (mode === 'url' ? urlInput : undefined)
    const domain = targetDomain ?? (mode === 'store' ? domainInput : undefined)

    if (!url && !domain) {
      setError('Please enter a product URL or store domain.')
      return
    }

    setBusy(true)
    setError(null)
    setSingleResult(null)
    setStoreResults([])

    try {
      const res = await fetch('/api/merchant/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, store_domain: domain }),
      })

      const data = await res.json()
      setBusy(false)

      if (!res.ok) {
        setError(data.error || 'Failed to inspect merchant')
        return
      }

      if (data.type === 'single_product') {
        setSingleResult({ product: data.product, analysis: data.analysis })
      } else if (data.type === 'store_catalog') {
        setStoreResults(data.items || [])
      }
    } catch (err: any) {
      setBusy(false)
      setError(err?.message || 'Failed to reach merchant inspection service')
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-5 sm:p-7 shadow-xs mb-8 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-amber-900 dark:text-[#f4a261]">
            Universal Web Ingestion
          </span>
          <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Live Merchant & Product Inspector
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 max-w-xl">
            Extract Schema.org JSON-LD from any e-commerce link or query live public Shopify storefronts.
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex rounded-full bg-neutral-100 dark:bg-neutral-900 p-1 border border-neutral-200 dark:border-neutral-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setMode('url')
              setError(null)
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              mode === 'url'
                ? 'bg-white dark:bg-[#f4a261] text-neutral-900 dark:text-[#171412] shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Product URL
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('store')
              setError(null)
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              mode === 'store'
                ? 'bg-white dark:bg-[#f4a261] text-neutral-900 dark:text-[#171412] shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Shopify Store
          </button>
        </div>
      </div>

      {/* Input row */}
      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        {mode === 'url' ? (
          <input
            type="url"
            placeholder="Paste any live product URL (e.g. Best Buy, Depop, Shopify store, Target)..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && inspect()}
            className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 px-4 py-2.5 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#cf6a42] dark:focus:border-[#f4a261]"
          />
        ) : (
          <input
            type="text"
            placeholder="Enter Shopify store domain (e.g. allbirds.com or gymshark.com)..."
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && inspect()}
            className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900 px-4 py-2.5 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-[#cf6a42] dark:focus:border-[#f4a261]"
          />
        )}
        <button
          onClick={() => inspect()}
          disabled={busy}
          className="rounded-xl bg-neutral-900 dark:bg-[#f4a261] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs"
        >
          {busy ? 'Extracting…' : 'Inspect Live'}
        </button>
      </div>

      {/* Preset pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
        <span className="text-neutral-400 font-medium">Quick examples:</span>
        {PRESET_EXAMPLES.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (p.type === 'url' && p.url) {
                setMode('url')
                setUrlInput(p.url)
                inspect(p.url, undefined)
              } else if (p.type === 'store' && p.domain) {
                setMode('store')
                setDomainInput(p.domain)
                inspect(undefined, p.domain)
              }
            }}
            className="rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-xs text-neutral-600 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-2xs transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 dark:bg-[#331d1d] border border-red-200 dark:border-red-900/60 p-3 text-xs text-red-900 dark:text-[#f08f8f]">
          {error}
        </div>
      )}

      {/* Single Live Product Result */}
      {singleResult && (
        <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#161514] p-5">
          <div className="flex flex-col sm:flex-row gap-5">
            {singleResult.product.images[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={singleResult.product.images[0].url}
                alt={singleResult.product.title}
                className="h-44 w-44 rounded-xl object-contain bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shrink-0 self-center sm:self-start"
              />
            )}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10px] uppercase font-semibold text-neutral-400">
                      {singleResult.product.merchant.name} ({singleResult.product.merchant.domain})
                    </span>
                    <h3 className="mt-1 text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                      {singleResult.product.title}
                    </h3>
                  </div>
                  <span className="font-mono text-lg font-bold text-[#cf6a42] dark:text-[#f4a261] shrink-0">
                    ${singleResult.product.price.amount.toFixed(2)}
                  </span>
                </div>
                {singleResult.product.description && (
                  <p className="mt-2 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                    {singleResult.product.description}
                  </p>
                )}

                {/* Verification Need Badge */}
                {singleResult.analysis.requiresVerification ? (
                  <div className="mt-3 rounded-xl bg-amber-50 dark:bg-[#33281c] border border-amber-200 dark:border-amber-800/60 p-3 text-xs text-amber-900 dark:text-[#f4a261]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>Ground-Truth Verification Advised:</span>
                      <span className="capitalize font-mono">({singleResult.analysis.riskLevel} risk)</span>
                    </div>
                    <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                      {singleResult.analysis.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-[#1d2b22] border border-emerald-200 dark:border-emerald-800/60 p-2.5 text-xs text-emerald-800 dark:text-[#8bd3a8] flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" /> No physical risk detected. Ready for automated agent checkout.
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <a
                  href={singleResult.product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  View live listing <ExternalLink className="size-3" />
                </a>
                {singleResult.analysis.suggestedTask && (
                  <Link
                    href={`/agent?${new URLSearchParams({
                      title: singleResult.analysis.suggestedTask.title,
                      description: singleResult.analysis.suggestedTask.description,
                      type: singleResult.analysis.suggestedTask.taskType,
                      price: (
                        singleResult.analysis.suggestedTask.suggestedPriceCents / 100
                      ).toString(),
                      proof: singleResult.analysis.suggestedTask.proofRequirements,
                      reference_image_url: singleResult.product.images[0]?.url || '',
                    })}`}
                    className="rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-1.5 text-xs font-semibold text-white dark:text-[#171412] hover:opacity-90 shadow-2xs"
                  >
                    Hire Human to Verify ($
                    {(singleResult.analysis.suggestedTask.suggestedPriceCents / 100).toFixed(2)})
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi Storefront Results */}
      {storeResults.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-xs uppercase font-mono font-semibold tracking-wider text-neutral-500">
            Storefront Catalog ({storeResults.length} items extracted)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {storeResults.slice(0, 6).map(({ product, analysis }) => (
              <div
                key={product.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#161514] p-3.5 text-xs shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">{product.title}</span>
                    <span className="font-mono font-bold text-[#cf6a42] dark:text-[#f4a261]">
                      ${product.price.amount.toFixed(2)}
                    </span>
                  </div>
                  {product.images[0]?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.images[0].url}
                      alt={product.title}
                      className="mt-2 h-28 w-full rounded-lg object-contain bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    />
                  )}
                  {analysis.requiresVerification && (
                    <p className="mt-2 text-[11px] text-amber-800 dark:text-[#f4a261] line-clamp-2">
                      ⚠️ {analysis.reasons[0]}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  >
                    Store link ↗
                  </a>
                  {analysis.suggestedTask && (
                    <Link
                      href={`/agent?${new URLSearchParams({
                        title: analysis.suggestedTask.title,
                        description: analysis.suggestedTask.description,
                        type: analysis.suggestedTask.taskType,
                        price: (analysis.suggestedTask.suggestedPriceCents / 100).toString(),
                        proof: analysis.suggestedTask.proofRequirements,
                        reference_image_url: product.images[0]?.url || '',
                      })}`}
                      className="rounded-full bg-neutral-900 dark:bg-[#f4a261] px-3 py-1 font-semibold text-white dark:text-[#171412] hover:opacity-90 shadow-2xs"
                    >
                      Verify (${(analysis.suggestedTask.suggestedPriceCents / 100).toFixed(2)})
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
