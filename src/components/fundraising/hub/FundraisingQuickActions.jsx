import React from 'react'
import { LS, IconGlyph } from '../fundraisingShared'
import { useIsMobile } from '../../../hooks/useIsMobile'

export default function FundraisingQuickActions({ onNewCampaign, onFindFunding, onNewApplication, onDocuments, onShareCampaign, onReports, isAdmin }) {
  const isMobile = useIsMobile()

  const actions = [
    { key: 'campaign', icon: 'plus', color: '#7C5CFC', bg: '#F1EDFF', title: 'New Campaign', desc: 'Start a new fundraising campaign', onClick: onNewCampaign, adminOnly: true },
    { key: 'find', icon: 'search', color: '#2F6F63', bg: '#EAF5F2', title: 'Find Funding', desc: 'Discover grants and opportunities', onClick: onFindFunding },
    { key: 'application', icon: 'file-plus', color: '#BA7517', bg: '#FDF3E4', title: 'New Application', desc: 'Create a grant application', onClick: onNewApplication, adminOnly: true },
    { key: 'documents', icon: 'folder', color: '#375A82', bg: '#E9F0F7', title: 'Documents', desc: 'Access policies, reports & files', onClick: onDocuments },
    { key: 'share', icon: 'share', color: '#4E7A3A', bg: '#EEF3EA', title: 'Share Campaign', desc: 'Promote and share your campaign', onClick: onShareCampaign },
    { key: 'reports', icon: 'chart', color: '#8C5A3C', bg: '#F6EFEA', title: 'Reports & Insights', desc: 'View analytics & impact reports', onClick: onReports },
  ].filter(a => !a.adminOnly || isAdmin)

  return (
    <div style={{
      display: isMobile ? 'grid' : 'flex',
      gridTemplateColumns: isMobile ? '1fr 1fr' : undefined,
      gap: 10, marginBottom: 20,
      overflowX: isMobile ? 'visible' : 'auto',
    }}>
      {actions.map(a => (
        <button key={a.key} onClick={a.onClick} style={{
          flex: isMobile ? undefined : '1 1 0',
          minWidth: isMobile ? undefined : 150,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
          padding: '14px 14px', borderRadius: 16, border: `1px solid ${LS.border}`, background: '#fff',
          cursor: 'pointer', textAlign: 'left', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(76,50,200,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconGlyph name={a.icon} color={a.color} size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: LS.text }}>{a.title}</div>
            <div style={{ fontSize: 11, color: LS.muted, marginTop: 1, lineHeight: 1.35 }}>{a.desc}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
