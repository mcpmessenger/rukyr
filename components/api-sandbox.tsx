'use client'

import React, { useState, useEffect } from 'react'
import {
  Terminal,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Shield,
  Key,
  Webhook,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

const SAMPLE_PAYLOAD = {
  client_reference: 'shop-order-4821-color-check',
  task_type: 'physical_check',
  title: 'Check the T-shirt color in daylight',
  instructions: {
    format: 'markdown',
    body: 'Visit the specified shop. Inspect the garment in daylight. Report the closest color and whether the tag appears to match the listing. Do not buy the item.',
  },
  input: {
    product_url: 'https://example.com/products/vintage-tee',
    listing_claim: 'faded black',
    ambiguity: 'The listing photo could be navy blue.',
  },
  output_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['observed_color', 'matches_listing', 'notes'],
    properties: {
      observed_color: { type: 'string', maxLength: 80 },
      matches_listing: { type: 'boolean' },
      notes: { type: 'string', maxLength: 1000 },
    },
  },
  work_mode: 'on_site',
  location: {
    country_code: 'US',
    region: 'CA',
    locality: 'San Francisco',
  },
  worker_requirements: {
    skills: ['retail_observation'],
    languages: ['en'],
    minimum_quality_score: 0.8,
  },
  proof_requirements: [
    { type: 'photo', required: true, min_count: 1, max_count: 3 },
    { type: 'text', required: true, min_count: 1, max_count: 1 },
  ],
  dispatch: {
    assignment_count: 1,
    claim_timeout_seconds: 1800,
    completion_deadline: '2026-11-08T02:00:00Z',
    selection: 'first_qualified',
  },
  reward: { amount_minor: 300, currency: 'USD' },
  billing: {
    funding_source_id: 'fs_01JEXAMPLE',
    max_total_amount_minor: 450,
    currency: 'USD',
  },
  metadata: { source: 'shopping_agent', workflow_id: 'wf_9931' },
}

export function ApiSandbox() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<'create_task' | 'list_tasks' | 'webhooks'>('create_task')
  const [requestBody, setRequestBody] = useState(JSON.stringify(SAMPLE_PAYLOAD, null, 2))
  const [idempotencyKey, setIdempotencyKey] = useState(`idemp_${Date.now()}`)
  const [isLoading, setIsLoading] = useState(false)
  const [responseStatus, setResponseStatus] = useState<number | null>(null)
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({})
  const [responseData, setResponseData] = useState<any | null>(null)
  const [webhooksList, setWebhooksList] = useState<any[]>([])
  const [copied, setCopied] = useState(false)

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/v1/webhooks')
      const data = await res.json()
      if (data.events) {
        setWebhooksList(data.events)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const handleSendRequest = async () => {
    setIsLoading(true)
    setResponseStatus(null)
    setResponseData(null)

    try {
      let res: Response
      if (selectedEndpoint === 'create_task') {
        res = await fetch('/v1/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer rk_live_demo_key_77192',
            'Idempotency-Key': idempotencyKey,
            'Rukyr-API-Version': '2026-01-01',
          },
          body: requestBody,
        })
      } else if (selectedEndpoint === 'list_tasks') {
        res = await fetch('/v1/tasks', {
          headers: {
            Authorization: 'Bearer rk_live_demo_key_77192',
            'Rukyr-API-Version': '2026-01-01',
          },
        })
      } else {
        res = await fetch('/v1/webhooks')
      }

      setResponseStatus(res.status)
      const hdrs: Record<string, string> = {}
      res.headers.forEach((v, k) => {
        hdrs[k] = v
      })
      setResponseHeaders(hdrs)

      const json = await res.json()
      setResponseData(json)
      setIsLoading(false)
      fetchWebhooks()
    } catch (err: any) {
      setIsLoading(false)
      setResponseStatus(500)
      setResponseData({ error: err.message })
    }
  }

  const copyCurl = () => {
    const curl = `curl -X POST https://api.rukyr.com/v1/tasks \\
  -H "Authorization: Bearer rk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${idempotencyKey}" \\
  -H "Rukyr-API-Version: 2026-01-01" \\
  -d '${requestBody.replace(/'/g, "\\'")}'`
    navigator.clipboard?.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 p-5 sm:p-6 shadow-sm backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/60 dark:border-neutral-800/60 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100 px-3 py-1 font-mono text-[11px] font-bold text-white dark:text-neutral-900">
            <Terminal className="size-3" /> v0.1 DISPATCH API EXPLORER
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Live Human-Work Dispatch Sandbox
          </h2>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Dispatch autonomous tasks, enforce JSON Schema validation, and inspect HMAC-SHA256 webhooks in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedEndpoint('create_task')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedEndpoint === 'create_task'
                ? 'bg-[#cf6a42] text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            POST /v1/tasks
          </button>
          <button
            onClick={() => setSelectedEndpoint('list_tasks')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedEndpoint === 'list_tasks'
                ? 'bg-[#cf6a42] text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            GET /v1/tasks
          </button>
          <button
            onClick={() => setSelectedEndpoint('webhooks')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedEndpoint === 'webhooks'
                ? 'bg-[#cf6a42] text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Webhooks ({webhooksList.length})
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Request Column */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
            <span>Client Request Payload</span>
            {selectedEndpoint === 'create_task' && (
              <button
                onClick={copyCurl}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#cf6a42] dark:text-[#f4a261] hover:underline"
              >
                <Copy className="size-3" /> {copied ? 'Copied cURL!' : 'Copy cURL'}
              </button>
            )}
          </div>

          {selectedEndpoint === 'create_task' ? (
            <div className="flex flex-col flex-1">
              <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-neutral-500">
                <span className="flex items-center gap-1">
                  <Key className="size-3" /> Idempotency-Key:
                </span>
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="rounded-md border border-neutral-300 dark:border-neutral-800 px-2 py-0.5 text-[11px] font-mono bg-neutral-50 dark:bg-neutral-900 w-48 text-right"
                />
              </div>

              <textarea
                rows={16}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="w-full flex-1 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 p-4 font-mono text-xs text-neutral-200 outline-none focus:border-[#cf6a42]"
                spellCheck={false}
              />

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRequestBody(JSON.stringify(SAMPLE_PAYLOAD, null, 2))}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline"
                >
                  Reset to Spec Sample (T-shirt Daylight Check)
                </button>

                <button
                  onClick={handleSendRequest}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <Send className="size-3.5" />
                  {isLoading ? 'Dispatching Task...' : 'Dispatch Task (201 Created)'}
                </button>
              </div>
            </div>
          ) : selectedEndpoint === 'list_tasks' ? (
            <div className="flex flex-col flex-1 rounded-2xl bg-neutral-950 p-5 font-mono text-xs text-neutral-300">
              <p className="text-neutral-400">Endpoint: GET /v1/tasks</p>
              <p className="text-neutral-400">Headers: Authorization: Bearer rk_live_...</p>
              <p className="mt-4 text-emerald-400">Supports query parameters:</p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-300 mt-2">
                <li>status (e.g. open, completed, cancelled)</li>
                <li>client_reference</li>
                <li>work_mode (remote, on_site, hybrid)</li>
                <li>task_type</li>
              </ul>
              <div className="mt-auto pt-6">
                <button
                  onClick={handleSendRequest}
                  disabled={isLoading}
                  className="w-full rounded-full bg-emerald-500 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-600 transition-all"
                >
                  {isLoading ? 'Querying...' : 'Execute GET /v1/tasks'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 rounded-2xl bg-neutral-950 p-4 font-mono text-xs text-neutral-300 overflow-y-auto max-h-[400px]">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-3">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Webhook className="size-3.5" /> Live Webhooks Log
                </span>
                <button onClick={fetchWebhooks} className="text-neutral-400 hover:text-white">
                  <RefreshCw className="size-3" />
                </button>
              </div>
              {webhooksList.length === 0 ? (
                <p className="text-neutral-500">No events logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {webhooksList.map((evt) => (
                    <div key={evt.id} className="rounded-xl bg-neutral-900 p-3 border border-neutral-800">
                      <div className="flex items-center justify-between text-neutral-400">
                        <span className="text-[#f4a261] font-bold">{evt.type}</span>
                        <span>{new Date(evt.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-1 truncate">ID: {evt.id}</p>
                      {evt.sample_signature_header && (
                        <p className="text-[9px] text-emerald-400/80 font-mono mt-1 truncate">
                          Signature: {evt.sample_signature_header}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Response Column */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
            <span>Rukyr API Response</span>
            {responseStatus && (
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded-full font-bold ${
                  responseStatus >= 200 && responseStatus < 300
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-600'
                }`}
              >
                HTTP {responseStatus}
              </span>
            )}
          </div>

          <div className="flex-1 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 p-4 font-mono text-xs text-neutral-200 overflow-y-auto max-h-[460px]">
            {responseData ? (
              <pre className="text-emerald-400">{JSON.stringify(responseData, null, 2)}</pre>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-neutral-500">
                <Terminal className="size-8 opacity-40 mb-2" />
                <p>Click &ldquo;Dispatch Task&rdquo; to send request to /v1/tasks</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
