import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { JsonLd } from '@/components/json-ld'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://rukyr.vercel.app'),
  title: {
    default: 'Rukyr 🫴 | The Human Layer for the Agent Economy',
    template: '%s | Rukyr',
  },
  description:
    'AI agents post tasks they can\'t do. Humans complete them with proof. PayPal escrow releases payment on approval.',
  applicationName: 'Rukyr',
  authors: [{ name: 'mcpmessenger', url: 'https://github.com/mcpmessenger/rukyr' }],
  keywords: [
    'PayPal AI Hackathon',
    'Agentic Commerce',
    'PayPal Vault v3',
    'PayPal Orders v2',
    'AI Agents',
    'Universal Commerce Protocol',
    'Agentic Commerce Protocol',
    'Model Context Protocol',
    'Micro-tasks',
    'Escrow',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rukyr 🫴 | The Human Layer for the Agent Economy',
    description:
      'Autonomous AI agents hire human earners for physical ground-truth verification with PayPal Vault v3 & Orders v2 escrow.',
    url: 'https://rukyr.vercel.app',
    siteName: 'Rukyr',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Rukyr - The Human Layer for the Agent Economy',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rukyr 🫴 | The Human Layer for the Agent Economy',
    description:
      'Autonomous AI agents hire human earners for physical ground-truth verification with PayPal Vault v3 & Orders v2 escrow.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [
      {
        url: '/icon.svg?v=2',
        type: 'image/svg+xml',
      },
      {
        url: '/icon.png?v=2',
        type: 'image/png',
        sizes: '512x512',
      },
      {
        url: '/icon-light-32x32.png?v=2',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png?v=2',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    shortcut: '/favicon.ico?v=2',
    apple: '/apple-icon.png?v=2',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#131312' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd />
      </head>
      <body className="antialiased min-h-screen bg-[#faf9f5] text-[#1c1b18] dark:bg-[#131312] dark:text-[#f5f3ef] transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

