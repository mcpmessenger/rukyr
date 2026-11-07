'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, User, Bot, Sun, Moon } from 'lucide-react'
import { DonutMark } from './donut-mark'
import { ThemeToggle } from './theme-toggle'

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isAgentMode = pathname.startsWith('/agent')
  const isEarnerMode = !isAgentMode

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-[#faf9f5]/90 dark:bg-[#131312]/90 backdrop-blur-md transition-colors duration-200">
      {/* Top Protocol Status Banner */}
      <div className="border-b border-neutral-200/60 dark:border-neutral-800/60 bg-[#f4f1eb] dark:bg-[#181716] px-4 py-1.5 text-center font-mono text-[11px] font-medium tracking-tight text-[#b85d34] dark:text-[#f4a261]">
        ● Rukyr Human-Work Dispatch API v0.1 • Pre-Authorized Escrow • JSON Schema 2020-12 • Mobile Swipe Mode Active
      </div>

      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group transition-opacity hover:opacity-90 shrink-0"
          aria-label="Rukyr home"
        >
          <span className="text-xl font-bold tracking-[-0.04em] text-neutral-950 dark:text-neutral-50">
            Rukyr
          </span>
          <DonutMark
            width={30}
            height={17}
            className="transition-transform group-hover:scale-105 text-[#cf6a42] dark:text-[#f4a261]"
          />
        </Link>

        {/* Center: Agent Mode vs Earner Mode Toggle */}
        <div className="hidden sm:inline-flex items-center rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/70 dark:bg-neutral-900/70 p-1 text-xs font-semibold shadow-2xs">
          <Link
            href="/"
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all ${
              isEarnerMode
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <User className="size-3.5" />
            <span>Earner Mode</span>
          </Link>

          <Link
            href="/agent"
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all ${
              isAgentMode
                ? 'bg-[#cf6a42] text-white font-bold shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Bot className="size-3.5" />
            <span>Agent Console</span>
          </Link>
        </div>

        {/* Right Controls: Light/Dark Toggle + Nav Links */}
        <div className="flex items-center gap-3">
          <Link
            href="/earn/me"
            className="hidden lg:inline-flex text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-100"
          >
            My Earnings
          </Link>

          {/* Light / Dark Mode Toggle with Labels on Desktop */}
          <ThemeToggle showLabels className="hidden md:inline-flex" />
          <ThemeToggle className="md:hidden" />

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="sm:hidden inline-flex size-9 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700/70 bg-white/80 dark:bg-neutral-900/80 text-neutral-800 dark:text-neutral-200 shadow-sm"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-neutral-200 dark:border-neutral-800 bg-[#faf9f5] dark:bg-[#141413] px-5 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          {/* Mobile Role Switcher */}
          <div className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 p-1 text-xs font-semibold">
            <Link
              href="/"
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                isEarnerMode
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shadow-xs'
                  : 'text-neutral-500'
              }`}
            >
              <User className="size-3.5" /> Earner Mode
            </Link>
            <Link
              href="/agent"
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                isAgentMode
                  ? 'bg-[#cf6a42] text-white font-bold shadow-xs'
                  : 'text-neutral-500'
              }`}
            >
              <Bot className="size-3.5" /> Agent Mode
            </Link>
          </div>

          <div className="space-y-1 pt-1">
            <Link
              href="/"
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span>Job Board & Swipe Deck</span>
            </Link>
            <Link
              href="/agent"
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span>Agent Console & Dispatch</span>
            </Link>
            <Link
              href="/earn/me"
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span>My Earnings</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
