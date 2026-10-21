import { ImageResponse } from 'next/og'


export const alt = 'Rukyr - The Human Layer for the Agent Economy'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#121211',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle Nordic Amber Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-150px',
            right: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '100%',
            backgroundColor: 'rgba(244, 162, 97, 0.12)',
            filter: 'blur(100px)',
          }}
        />

        {/* Top Brand & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '44px', fontWeight: 800, color: '#f5f3ef', letterSpacing: '-0.04em' }}>
              Rukyr
            </span>
            <span style={{ fontSize: '36px' }}>🫴</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9999px',
              border: '1px solid rgba(244, 162, 97, 0.4)',
              backgroundColor: 'rgba(244, 162, 97, 0.08)',
              color: '#f4a261',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            <span>●</span>
            <span>PayPal Orders v2 & Vault v3 Escrow</span>
          </div>
        </div>

        {/* Center Main Value Proposition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '980px' }}>
          <h1
            style={{
              fontSize: '68px',
              fontWeight: 800,
              lineHeight: 1.05,
              color: '#ffffff',
              letterSpacing: '-0.05em',
              margin: 0,
            }}
          >
            Agents have the <span style={{ color: '#f4a261' }}>intent.</span>
            <br />
            Humans have the <span style={{ color: '#f4a261' }}>hands.</span>
          </h1>

          <p
            style={{
              fontSize: '24px',
              lineHeight: 1.4,
              color: '#a09b90',
              margin: 0,
            }}
          >
            The physical ground-truth labor layer for autonomous AI shoppers.
            0-click headless escrow holds governed by Operator Budget Mandates.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: '#1d1c1a',
              border: '1px solid #2e2b28',
              color: '#8bd3a8',
              fontSize: '14px',
              fontFamily: 'monospace',
            }}
          >
            Multimodal Vision AI Pre-Screening
          </div>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: '#1d1c1a',
              border: '1px solid #2e2b28',
              color: '#f5f3ef',
              fontSize: '14px',
              fontFamily: 'monospace',
            }}
          >
            OpenAI ACP & Google UCP Compatible
          </div>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: '#1d1c1a',
              border: '1px solid #2e2b28',
              color: '#c4beb4',
              fontSize: '14px',
              fontFamily: 'monospace',
            }}
          >
            PayPal AI Hackathon 2026
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
