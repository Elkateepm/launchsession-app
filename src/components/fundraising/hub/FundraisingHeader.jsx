import React from 'react'
import { LS, IconGlyph } from '../fundraisingShared'
import { useIsMobile } from '../../../hooks/useIsMobile'

export default function FundraisingHeader({ onNewCampaign, onOpenAssistant, isAdmin }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14, background: LS.gradient, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 16px ${LS.purple}33`,
        }}>
          <IconGlyph name="coin" color="#fff" size={22} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: LS.text, letterSpacing: '-0.01em' }}>Fundraising Hub</div>
          <div style={{ fontSize: 13, color: LS.muted, marginTop: 1 }}>Raise more. Save time. Create more impact.</div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onOpenAssistant} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11,
            border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff', color: LS.purpleDark,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            <IconGlyph name="sparkle" color={LS.purpleDark} size={14} /> AI Assistant
          </button>
          <button onClick={onNewCampaign} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none',
            background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: `0 6px 16px ${LS.purple}35`,
          }}>
            <IconGlyph name="plus" color="#fff" size={14} /> New Campaign
          </button>
        </div>
      )}
    </div>
  )
}
