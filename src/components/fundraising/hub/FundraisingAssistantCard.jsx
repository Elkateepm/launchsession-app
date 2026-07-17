import React from 'react'
import { LS, IconGlyph } from '../fundraisingShared'

export default function FundraisingAssistantCard({ bullets, onViewAll }) {
  return (
    <div style={{ background: LS.softGradient, border: `1px solid ${LS.lavenderBorder}`, borderRadius: 18, padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: LS.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconGlyph name="sparkle" color="#fff" size={13} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: LS.text }}>AI Assistant</div>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: LS.purpleDark, background: '#fff', borderRadius: 20, padding: '2px 8px' }}>BETA</span>
      </div>

      {bullets.length === 0 ? (
        <div style={{ fontSize: 12.5, color: LS.muted, lineHeight: 1.5, marginBottom: 16 }}>
          I'll surface suggestions here as your campaigns, applications and deadlines build up.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: LS.muted, marginBottom: 12, lineHeight: 1.5 }}>I've looked at your fundraising data and have a few suggestions.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {bullets.slice(0, 3).map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <IconGlyph name="check" color={LS.success} size={11} />
                </div>
                <span style={{ fontSize: 12.5, color: LS.text, lineHeight: 1.45 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <button onClick={onViewAll} style={{
        padding: '9px 16px', borderRadius: 10, border: 'none', background: LS.gradient, color: '#fff',
        fontWeight: 700, fontSize: 12.5, cursor: 'pointer', width: '100%',
      }}>
        View All Suggestions →
      </button>
    </div>
  )
}
