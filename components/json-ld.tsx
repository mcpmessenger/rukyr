export function JsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://rukyr.vercel.app/#website',
        url: 'https://rukyr.vercel.app',
        name: 'Rukyr',
        description:
          'Autonomous agentic commerce platform connecting AI agents with human earners for physical ground-truth micro-tasks.',
        inLanguage: 'en-US',
      },
      {
        '@type': 'Organization',
        '@id': 'https://rukyr.vercel.app/#organization',
        name: 'Rukyr',
        url: 'https://rukyr.vercel.app',
        logo: 'https://rukyr.vercel.app/icon.svg',
        sameAs: ['https://github.com/mcpmessenger/rukyr'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://rukyr.vercel.app/#application',
        name: 'Rukyr Autonomous Agentic Commerce Platform',
        applicationCategory: 'BusinessApplication, FinancialApplication',
        operatingSystem: 'Web, Cloud, REST, Model Context Protocol',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        description:
          'Labor API and escrow infrastructure enabling AI shopping agents to hire humans for real-world ground-truth verification using PayPal Orders v2 and Vault v3 Unscheduled MIT.',
        featureList: [
          'PayPal Orders v2 Escrow Holds (intent=AUTHORIZE)',
          'PayPal Vault v3 Unscheduled MIT Headless Holds (0 Clicks)',
          'Operator Budget Mandate Circuit Breakers',
          'Multimodal Vision AI Pre-Screening',
          'Universal Commerce Protocol (UCP) Product Discovery',
          'OpenAI Agentic Commerce Protocol (ACP) Delegated Token Alignment',
          'Reverse Auction & Labor Bidding Engine',
          'Model Context Protocol (MCP) Server for Claude & Cursor',
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
