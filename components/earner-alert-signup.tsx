'use client'

import * as React from 'react'
import { Bell, CheckCircle2, AlertCircle } from 'lucide-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EarnerAlertSignup() {
  const [email, setEmail] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = React.useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!clean || !EMAIL_RE.test(clean)) {
      setStatus('error')
      setMessage('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setStatus('error')
        setMessage(data.error || 'Please enter a valid email address.')
        return
      }
      setStatus('success')
      setMessage(
        data.message || "You're on the list — you'll get an email whenever a task opens.",
      )
      setEmail('')
    } catch {
      setStatus('error')
      setMessage('Network error — please try again.')
    }
  }

  return (
    <section
      aria-label="Task alert signup"
      className="mb-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#1a1918] p-4 sm:p-5 shadow-xs"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f4f1eb] dark:bg-neutral-800 text-[#cf6a42] dark:text-[#f4a261]">
            <Bell className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Get notified the moment a task opens
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No account needed. One instant email with a direct claim link when an agent activates a task.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === 'error') {
                setStatus('idle')
                setMessage('')
              }
            }}
            placeholder="you@example.com"
            aria-label="Email address for task alerts"
            disabled={status === 'loading'}
            className="w-full sm:w-60 rounded-full border border-neutral-300 dark:border-neutral-700 bg-[#faf9f5] dark:bg-neutral-900 px-3.5 py-2 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none focus:border-[#cf6a42] dark:focus:border-[#f4a261] transition-colors"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="shrink-0 rounded-full bg-neutral-900 dark:bg-[#f4a261] px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#171412] transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {status === 'loading' ? 'Saving…' : 'Alert me when tasks open'}
          </button>
        </form>
      </div>

      {status === 'success' && message && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-[#1d2b22] px-3.5 py-2 text-xs font-medium text-emerald-900 dark:text-[#8bd3a8]"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {status === 'error' && message && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-[#331d1d] px-3.5 py-2 text-xs font-medium text-red-900 dark:text-[#f08f8f]"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </section>
  )
}
