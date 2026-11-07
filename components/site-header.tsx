'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Flame } from 'lucide-react'
import { DonutMark } from './donut-mark'
import { ThemeToggle } from './theme-toggle'

const links = [
  { href: '/', label: 'Job Board & Swipe Deck' },
  { href: '/earn', label: 'Earn Marketplace' },
  { href: '/agent', label: 'Agent Console' },
  { href: '/earn/me', label: 'My Earnings' },
]

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-[#faf9f5]/90 dark:bg-[#131312]/90 backdrop-blur-md transition-colors duration-200">
      {/* Top Protocol Status Banner */}
      <div className="border-b border-neutral-200/60 dark:border-neutral-800/60 bg-[#f4f1eb] dark:bg-[#181716] px-4 py-1.5 text-center font-mono text-[11px] font-medium tracking-tight text-[#b85d34] dark:text-[#f4a261]">
        ● Rukyr Human-Work Dispatch API v0.1 • Pre-Authorized Escrow • JSON Schema 2020-12 • Mobile Swipe Deck Active
      </div>

      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 group transition-opacity hover:opacity-90"
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

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1 lg:gap-2">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
        </div>

        {/* Right side controls: ThemeToggle & Mobile menu button */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden inline-flex size-9 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700/70 bg-white/80 dark:bg-neutral-900/80 text-neutral-800 dark:text-neutral-200 shadow-sm"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-[#faf9f5] dark:bg-[#141413] px-5 py-4 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <span>{l.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
