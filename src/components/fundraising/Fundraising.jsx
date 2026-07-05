import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'

const CAMPAIGN_TYPES = [
  { key: 'general',    label: 'General Fundraiser', icon: '💛' },
  { key: 'equipment',  label: 'Equipment Fund',     icon: '⚽' },
  { key: 'trips',      label: 'Trips & Events',     icon: '🚌' },
  { key: 'bursary',    label: 'Bursary Fund',       icon: '🎓' },
  { key: 'emergency',  label: 'Emergency Appeal',   icon: '🚨' },
  { key: 'annual',     label: 'Annual Appeal',      icon: '📅' },
]

function ProgressBar({ raised, target, color }) {
  const pct = target > 0 ? Math.min((raised / target) * 100, 100) : 0
  return (
    <div>
      <div style={{ height: 10, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16A34A' : color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280' }}>
        <span style={{ fontWeight: 700, color: pct >= 100 ? '#16A34A' : color }}>£{raised.toLocaleString()} raised</span>
        <span>{pct.toFixed(0)}% of £{target.toLocaleString()}</span>
      </div>
    </div>
  )
}

function CampaignDetail({ campaign, org, onBack, onUpdate }) {
  const isMobile = useIsMobile()
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newDonation, setNewDonation] = useState({ donor_name: '', amount: '', message: '', gift_aid: false })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...campaign })
  const primary = org?.primary_color || '#1B9AAA'
  const typeCfg = CAMPAIGN_TYPES.find(t => t.key === campaign.campaign_type) || CAMPAIGN_TYPES[0]

  const load = useCallback(async () => {
    const { data } = await supabase.from('fundraising_donations').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false })
    setDonations(data || [])
    setLoading(false)
  }, [campaign.id])

  useEffect(() => { load() }, [load])

  const addDonation = async () => {
    if (!newDonation.amount) return
    setSaving(true)
    const amount = parseFloat(newDonation.amount)
    const { data } = await supabase.from('fundraising_donations').insert({ campaign_id: campaign.id, org_id: org.id, donor_name: newDonation.donor_name || 'Anonymous', amount, message: newDonation.message, gift_aid: newDonation.gift_aid }).select().single()
    if (data) {
      setDonations(d => [data, ...d])
      const newRaised = (campaign.raised || 0) + amount
      await supabase.from('fundraising_campaigns').update({ raised: newRaised }).eq('id', campaign.id)
      onUpdate({ ...campaign, raised: newRaised })
    }
    setNewDonation({ donor_name: '', amount: '', message: '', gift_aid: false })
    setShowAdd(false)
    setSaving(false)
  }

  const saveEdit = async () => {
    const { data } = await supabase.from('fundraising_campaigns').update({ name: editForm.name, description: editForm.description, target_amount: editForm.target_amount, end_date: editForm.end_date }).eq('id', campaign.id).select().single()
    if (data) { onUpdate(data); setEditing(false) }
  }

  const raised = campaign.raised || 0
  const target = campaign.target_amount || 0
  const pct = target > 0 ? Math.min((raised / target) * 100, 100).toFixed(0) : null
  const giftAidTotal = donations.filter(d => d.gift_aid).reduce((s, d) => s + d.amount * 0.25, 0)
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>← Back to Campaigns</button>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #16A34A18, #16A34A05)`, border: '1.5px solid #16A34A30', borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 28 }}>{typeCfg.icon}</span>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{campaign.name}</div>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>{campaign.description || typeCfg.label}</div>
          </div>
          <button onClick={() => setEditing(!editing)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {editing ? '✕ Cancel' : '✏️ Edit'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total Raised', value: `£${raised.toLocaleString()}`, color: '#16A34A' },
            { label: 'Target', value: target ? `£${target.toLocaleString()}` : 'No target', color: '#6B7280' },
            { label: 'Donations', value: donations.length, color: primary },
            { label: 'Gift Aid Value', value: giftAidTotal > 0 ? `£${giftAidTotal.toFixed(2)}` : '—', color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {target > 0 && <ProgressBar raised={raised} target={target} color={primary} />}
        {pct >= 100 && <div style={{ textAlign: 'center', marginTop: 10, fontSize: 16, fontWeight: 900, color: '#16A34A' }}>🎉 Target reached! Amazing work!</div>}
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Campaign Name</label><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Description</label><textarea value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'none' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Target Amount (£)</label><input type="number" value={editForm.target_amount || ''} onChange={e => setEditForm(f => ({ ...f, target_amount: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>End Date</label><input type="date" value={editForm.end_date || ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add donation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>💰 Donations ({donations.length})</div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>+ Record Donation</button>
      </div>

      {showAdd && (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DONOR NAME</label><input value={newDonation.donor_name} onChange={e => setNewDonation(n => ({ ...n, donor_name: e.target.value }))} placeholder="Anonymous" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>AMOUNT (£) *</label><input type="number" step="0.01" value={newDonation.amount} onChange={e => setNewDonation(n => ({ ...n, amount: e.target.value }))} placeholder="0.00" style={inp} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>MESSAGE</label><input value={newDonation.message} onChange={e => setNewDonation(n => ({ ...n, message: e.target.value }))} placeholder="Donation message or reference..." style={inp} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={newDonation.gift_aid} onChange={e => setNewDonation(n => ({ ...n, gift_aid: e.target.checked }))} />
            Gift Aid eligible (+25% from HMRC)
          </label>
          {newDonation.gift_aid && newDonation.amount && (
            <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#16A34A', fontWeight: 700, marginBottom: 12 }}>
              🎉 Gift Aid adds £{(parseFloat(newDonation.amount) * 0.25).toFixed(2)} — total value £{(parseFloat(newDonation.amount) * 1.25).toFixed(2)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addDonation} disabled={saving || !newDonation.amount} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: saving || !newDonation.amount ? '#9CA3AF' : '#16A34A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Saving...' : '💰 Record Donation'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Donations list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Loading donations...</div>
      ) : donations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#F9FAFB', borderRadius: 14, color: '#9CA3AF', border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
          <div style={{ fontWeight: 700 }}>No donations recorded yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Start recording donations as they come in</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {donations.map((d, i) => (
            <div key={d.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💰</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{d.donor_name || 'Anonymous'}</span>
                  {d.gift_aid && <span style={{ background: '#F0FDF4', color: '#16A34A', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>Gift Aid</span>}
                </div>
                {d.message && <div style={{ fontSize: 12, color: '#6B7280' }}>{d.message}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{format(new Date(d.created_at), 'd MMM yyyy')}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#16A34A' }}>£{d.amount.toFixed(2)}</div>
                {d.gift_aid && <div style={{ fontSize: 10, color: '#16A34A', opacity: 0.7 }}>+£{(d.amount * 0.25).toFixed(2)} GA</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Fundraising({ org }) {
  const isMobile = useIsMobile()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', campaign_type: 'general', target_amount: '', start_date: new Date().toISOString().slice(0, 10), end_date: '' })
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('fundraising_campaigns').select('*, fundraising_donations(count)').eq('org_id', org.id).order('created_at', { ascending: false })
    setCampaigns(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const createCampaign = async () => {
    if (!newCampaign.name) return
    setCreating(true)
    const { data } = await supabase.from('fundraising_campaigns').insert({ ...newCampaign, org_id: org.id, raised: 0, target_amount: newCampaign.target_amount || 0 }).select().single()
    setCreating(false)
    if (data) { setCampaigns(c => [{ ...data, fundraising_donations: [{ count: 0 }] }, ...c]); setShowCreate(false); setNewCampaign({ name: '', description: '', campaign_type: 'general', target_amount: '', start_date: new Date().toISOString().slice(0, 10), end_date: '' }) }
  }

  const totalRaised = campaigns.reduce((s, c) => s + (c.raised || 0), 0)
  const totalDonations = campaigns.reduce((s, c) => s + (c.fundraising_donations?.[0]?.count || 0), 0)
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  if (selectedCampaign) return <CampaignDetail campaign={selectedCampaign} org={org} onBack={() => { setSelectedCampaign(null); load() }} onUpdate={updated => { setCampaigns(c => c.map(x => x.id === updated.id ? { ...x, ...updated } : x)); setSelectedCampaign(updated) }} />

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #16A34A18, #16A34A05)`, border: '1.5px solid #16A34A30', borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>💷 Fundraising</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} · £{totalRaised.toLocaleString()} raised in total</div>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ New Campaign</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Total Raised', value: `£${totalRaised.toLocaleString()}`, color: '#16A34A' },
            { label: 'Campaigns', value: campaigns.length, color: primary },
            { label: 'Total Donations', value: totalDonations, color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create campaign */}
      {showCreate && (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>💷 New Fundraising Campaign</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CAMPAIGN NAME *</label><input value={newCampaign.name} onChange={e => setNewCampaign(n => ({ ...n, name: e.target.value }))} placeholder="e.g. New Minibus Fund 🚌" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>TYPE</label>
              <select value={newCampaign.campaign_type} onChange={e => setNewCampaign(n => ({ ...n, campaign_type: e.target.value }))} style={inp}>
                {CAMPAIGN_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>TARGET (£)</label><input type="number" value={newCampaign.target_amount} onChange={e => setNewCampaign(n => ({ ...n, target_amount: e.target.value }))} placeholder="0 = no target" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>START DATE</label><input type="date" value={newCampaign.start_date} onChange={e => setNewCampaign(n => ({ ...n, start_date: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>END DATE</label><input type="date" value={newCampaign.end_date} onChange={e => setNewCampaign(n => ({ ...n, end_date: e.target.value }))} style={inp} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DESCRIPTION</label><textarea value={newCampaign.description} onChange={e => setNewCampaign(n => ({ ...n, description: e.target.value }))} rows={2} placeholder="What are you raising money for?" style={{ ...inp, resize: 'none' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createCampaign} disabled={creating || !newCampaign.name} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: creating || !newCampaign.name ? '#9CA3AF' : '#16A34A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{creating ? 'Creating...' : '💷 Launch Campaign'}</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Campaign cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💷</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Launch your first fundraising campaign and start tracking donations</div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Launch First Campaign</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {campaigns.map(campaign => {
            const typeCfg = CAMPAIGN_TYPES.find(t => t.key === campaign.campaign_type) || CAMPAIGN_TYPES[0]
            const raised = campaign.raised || 0
            const target = campaign.target_amount || 0
            const donCount = campaign.fundraising_donations?.[0]?.count || 0
            return (
              <div key={campaign.id} onClick={() => setSelectedCampaign(campaign)} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#16A34A'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,163,74,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{typeCfg.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{campaign.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{typeCfg.label}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#16A34A' }}>£{raised.toLocaleString()}</div>
                </div>
                {target > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <ProgressBar raised={raised} target={target} color='#16A34A' />
                  </div>
                )}
                {campaign.description && <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 10 }}>{campaign.description}</div>}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9CA3AF' }}>
                  <span>💰 {donCount} donation{donCount !== 1 ? 's' : ''}</span>
                  {campaign.end_date && <span>⏰ Ends {format(new Date(campaign.end_date), 'd MMM yyyy')}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
