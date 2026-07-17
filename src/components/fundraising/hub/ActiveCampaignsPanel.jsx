import React from 'react'
import { LS, IconGlyph, PurpleProgress, statusOf, daysLeftLabel, CAMPAIGN_TYPES } from '../fundraisingShared'
import FundraisingEmptyState from './FundraisingEmptyState'

const STATUS_META = {
  active:    { label: 'Active',    color: '#16803C', bg: '#E7F6EC' },
  planning:  { label: 'Draft',     color: '#6B7280', bg: '#F3F2F7' },
  completed: { label: 'Completed', color: '#375A82', bg: '#E9F0F7' },
}

// No image_url column exists on fundraising_campaigns yet, so every card uses
// a deterministic gradient + icon fallback illustration based on campaign type.
const TYPE_ICON = { general: 'heart', equipment: 'target', trips: 'rocket', bursary: 'people', emergency: 'alert-triangle', annual: 'trophy' }
const TYPE_GRADIENT = {
  general: 'linear-gradient(135deg,#8B6CFF,#6647F0)', equipment: 'linear-gradient(135deg,#4E9EFF,#2F6FE0)',
  trips: 'linear-gradient(135deg,#FF9E6C,#E0692F)', bursary: 'linear-gradient(135deg,#4ECBAA,#2F9E7E)',
  emergency: 'linear-gradient(135deg,#FF7A7A,#E03A3A)', annual: 'linear-gradient(135deg,#C08BFF,#8B4FE0)',
}

function CampaignCard({ c, onSelect, isMobile }) {
  const status = statusOf(c)
  const meta = STATUS_META[status.key]
  const raised = c.raised || 0
  const target = c.target_amount || 0
  const pct = target > 0 ? Math.min(Math.round((raised / target) * 100), 100) : 0
  const endingSoon = status.key === 'active' && c.end_date && Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24)) <= 7
  const typeLabel = CAMPAIGN_TYPES.find(t => t.key === c.campaign_type)?.label

  return (
    <div onClick={() => onSelect(c)} style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 16, border: `1px solid ${LS.border}`, background: '#fff', cursor: 'pointer', marginBottom: 12 }}>
      <div style={{
        width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: 12, flexShrink: 0,
        background: TYPE_GRADIENT[c.campaign_type] || TYPE_GRADIENT.general,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconGlyph name={TYPE_ICON[c.campaign_type] || 'heart'} color="#fff" size={isMobile ? 20 : 26} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.bg, borderRadius: 20, padding: '2px 9px' }}>{endingSoon ? 'Ending Soon' : meta.label}</span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: LS.text, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>

        {target > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: LS.muted, marginBottom: 5 }}>
              <span>£{raised.toLocaleString()} / £{target.toLocaleString()}</span>
              <span style={{ fontWeight: 700, color: LS.purpleDark }}>{pct}%</span>
            </div>
            <PurpleProgress raised={raised} target={target} height={6} />
          </>
        ) : (
          <div style={{ fontSize: 12, color: LS.muted, marginBottom: 5 }}>£{raised.toLocaleString()} raised · no target set</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {typeLabel && <span style={{ fontSize: 10.5, color: LS.muted, background: '#F5F4FA', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{typeLabel}</span>}
            <span style={{ fontSize: 10.5, color: LS.muted, fontWeight: 600 }}>{daysLeftLabel(c, status)}</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onSelect(c) }} style={{
            padding: '6px 12px', borderRadius: 9, border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff',
            color: LS.purpleDark, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', flexShrink: 0,
          }}>
            {status.key === 'completed' ? 'View Report' : 'Manage'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ActiveCampaignsPanel({ campaigns, isMobile, onSelect, onNewCampaign, isAdmin }) {
  const [showAll, setShowAll] = React.useState(false)
  const visible = showAll ? campaigns : campaigns.slice(0, 5)
  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Active Campaigns</div>
        {campaigns.length > 5 && (
          <button onClick={() => setShowAll(v => !v)} style={{ background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {showAll ? 'Show less' : `View all (${campaigns.length}) →`}
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <FundraisingEmptyState icon="rocket" title="Launch your first campaign"
          subtitle="Set a target, tell your story, and start tracking donations in one place."
          actionLabel={isAdmin ? '+ New Campaign' : undefined} onAction={onNewCampaign} />
      ) : (
        visible.map(c => <CampaignCard key={c.id} c={c} onSelect={onSelect} isMobile={isMobile} />)
      )}
    </div>
  )
}
