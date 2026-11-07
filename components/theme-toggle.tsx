'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle({
  className = '',
  showLabels = false,
}: {
  className?: string
  showLabels?: boolean
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className={`h-9 w-18 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`}
        aria-hidden="true"
      />
    )
  }

  const isDark = resolvedTheme === 'dark'

  if (showLabels) {
    return (
      <div className={`inline-flex rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100/70 dark:bg-neutral-900/70 p-0.5 text-xs font-semibold ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
            !isDark
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Light Mode"
        >
          <Sun className="size-3.5 text-amber-500" />
          <span className="text-[11px]">Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
            isDark
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Dark Mode"
        >
          <Moon className="size-3.5 text-[#f4a261]" />
          <span className="text-[11px]">Dark</span>
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative inline-flex size-9 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700/70 bg-white/80 dark:bg-neutral-900/80 text-neutral-800 dark:text-neutral-200 shadow-sm backdrop-blur transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Sun
        className={`size-4 transition-all duration-300 ${
          isDark
            ? 'rotate-0 scale-100 opacity-100 text-[#f4a261]'
            : '-rotate-90 scale-0 opacity-0 absolute'
        }`}
      />
      <Moon
        className={`size-4 transition-all duration-300 ${
          isDark
            ? 'rotate-90 scale-0 opacity-0 absolute'
            : 'rotate-0 scale-100 opacity-100 text-neutral-700'
        }`}
      />
    </button>
  )
}
