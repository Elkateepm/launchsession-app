import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'
import FundingMarketplace from './FundingMarketplace'
import FundraisingCalendar from './FundraisingCalendar'
import DocumentVault from './DocumentVault'
import ApplicationTracker from './ApplicationTracker'

const CAMPAIGN_TYPES = [
  { key: 'general',    label: 'General fundraiser' },
  { key: 'equipment',  label: 'Equipment fund' },
  { key: 'trips',      label: 'Trips and events' },
  { key: 'bursary',    label: 'Bursary fund' },
  { key: 'emergency',  label: 'Emergency appeal' },
  { key: 'annual',     label: 'Annual appeal' },
]

const GOLD = '#BA7517'
const DAY_MS = 1000 * 60 * 60 * 24

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'discover', label: 'Discover Funding' },
  { key: 'calendar', label: 'Deadlines' },
  { key: 'documents', label: 'Documents' },
  { key: 'applications', label: 'Applications' },
]

function statusOf(c) {
  const today = new Date().toISOString().slice(0, 10)
  if (c.start_date && c.start_date > today) return { key: 'planning', label: 'Planning' }
  if (c.end_date && c.end_date < today) return { key: 'completed', label: 'Completed' }
  return { key: 'active', label: 'Active' }
}

function daysLeftLabel(c, status) {
  if (status.key === 'planning') return `Starts ${format(new Date(c.start_date), 'd MMM')}`
  if (status.key === 'completed') return `Ended ${format(new Date(c.end_date), 'd MMM yyyy')}`
  if (c.end_date) {
    const days = Math.ceil((new Date(c.end_date) - new Date()) / DAY_MS)
    return days >= 0 ? `${days} day${days === 1 ? '' : 's'} left` : 'Ended'
  }
  return 'Ongoing'
}

// ---------------------------------------------------------------------------
// Heuristic insights — pace-to-target, stalled campaigns, missing story.
// No external AI call.
// ---------------------------------------------------------------------------
function buildFundraisingInsights(campaigns, latestDonationByCampaign) {
  const bullets = []
  const now = new Date()

  campaigns.forEach(c => {
    const status = statusOf(c)
    if (status.key !== 'active' || !c.target_amount || !c.start_date || !c.end_date) return
    const start = new Date(c.start_date), end = new Date(c.end_date)
    const totalDays = (end - start) / DAY_MS
    const elapsedDays = (now - start) / DAY_MS
    if (totalDays <= 0 || elapsedDays <= 0) return
    const expectedPct = Math.min(elapsedDays / totalDays, 1)
    const actualPct = (c.raised || 0) / c.target_amount
    const diff = actualPct - expectedPct
    if (diff > 0.1) {
      const daysEarly = Math.round((diff) * totalDays)
      bullets.push({ icon: 'trending-up', tone: 'success', priority: 2, text: `${c.name} is on pace to hit its target${daysEarly > 0 ? ` around ${daysEarly} days early` : ''}.` })
    } else if (diff < -0.15) {
      bullets.push({ icon: 'alert-triangle', tone: 'warning', priority: 1, text: `${c.name} is behind pace — ${Math.round(actualPct * 100)}% raised with ${Math.round((1 - expectedPct) * 100)}% of the time remaining.` })
    }
  })

  campaigns.forEach(c => {
    const status = statusOf(c)
    if (status.key !== 'active') return
    const latest = latestDonationByCampaign[c.id]
    const daysSince = latest ? (now - new Date(latest)) / DAY_MS : (now - new Date(c.start_date || c.created_at)) / DAY_MS
    if (daysSince >= 14) {
      bullets.push({ icon: 'clock-pause', tone: 'warning', priority: 1, text: `${c.name} has had no donations in ${Math.floor(daysSince)} days. An update to supporters often restarts momentum.` })
    }
  })

  const missingStory = campaigns.filter(c => statusOf(c).key !== 'completed' && !c.description)
  if (missingStory.length) {
    const shown = missingStory.slice(0, 2).map(c => c.name).join(', ')
    const extra = missingStory.length > 2 ? ` and ${missingStory.length - 2} more` : ''
    bullets.push({ icon: 'bulb', tone: 'accent', priority: 3, text: `${shown}${extra} ${missingStory.length === 1 ? "doesn't" : "don't"} have a story yet. Campaigns with a description tend to raise more.` })
  }

  bullets.sort((a, b) => a.priority - b.priority)
  return bullets.slice(0, 6)
}

const TONE_COLOR = { success: '#16A34A', warning: '#B45309' }
const TONE_BG = { success: '#DCFCE7', warning: '#FEF3C7', accent: '#F3EFFF' }

const bulletListVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const bulletItemVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 22 } },
}

function InsightsPanel({ bullets: heuristicBullets, org, primary }) {
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [fetchedOnce, setFetchedOnce] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const fetchAI = useCallback(async (force = false) => {
    setAiLoading(true)
    setAiError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/fundraising-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ force }),
      })
      const body = await res.json()
      if (!res.ok) { setAiError(body.error || 'AI insights unavailable'); return }
      if (body.headline) setAiResult(body)
    } catch (err) {
      setAiError(err?.message || 'AI insights unavailable')
    } finally {
      setAiLoading(false)
      setFetchedOnce(true)
    }
  }, [])

  useEffect(() => { if (org?.id) fetchAI(false) }, [org?.id, fetchAI]) // eslint-disable-line react-hooks/exhaustive-deps

  const isAI = !!aiResult
  const showingBullets = isAI ? aiResult.bullets : heuristicBullets
  if (heuristicBullets.length === 0 && !aiResult) return null

  return (
    <div style={{ background: 'linear-gradient(135deg, #FDF6E8, #ffffff)', border: '1px solid #F3E3BC', borderRadius: 20, padding: '16px 18px', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.span animate={{ rotate: [0, -12, 12, -8, 0] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3 }} style={{ fontSize: 15, display: 'inline-block' }}>✨</motion.span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#92640C' }}>Fundraising Insights</span>
          <AnimatePresence mode="wait">
            {aiLoading ? (
              <motion.span key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 11, color: '#B08B3F', fontWeight: 600 }}>
                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}>Cooking up insights…</motion.span>
              </motion.span>
            ) : isAI ? (
              <motion.span key="refined" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                style={{ fontSize: 10, fontWeight: 700, color: '#92640C', background: '#F3E3BC', borderRadius: 20, padding: '2px 8px' }}>
                AI-refined
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setShowInfo(v => !v)} title="What data does this use?"
            style={{ background: 'none', cursor: 'pointer', fontSize: 11, color: '#B08B3F', width: 16, height: 16, borderRadius: 999, border: '1px solid #E2C77E', lineHeight: '14px', padding: 0 }}>
            i
          </button>
          <motion.button onClick={() => fetchAI(true)} disabled={aiLoading} whileTap={{ scale: 0.85, rotate: 20 }}
            animate={aiLoading ? { rotate: 360 } : { rotate: 0 }} transition={aiLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
            title="Refresh insights" style={{ background: 'none', border: 'none', cursor: aiLoading ? 'default' : 'pointer', fontSize: 14, color: '#B08B3F', padding: 4, lineHeight: 1 }}>
            ↻
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 11.5, color: '#8A6A2E', lineHeight: 1.5, background: '#fff', border: '1px solid #F3E3BC', borderRadius: 10, padding: '8px 10px', marginBottom: 8, marginTop: 4 }}>
              Generated from campaign pace, donation activity and targets only — campaign names and numbers you've already entered. It never sees donor personal details, safeguarding records or anything from other modules.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div key={isAI ? 'ai' : 'heuristic'} variants={bulletListVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {showingBullets.map((b, i) => (
          <motion.div key={i} variants={bulletItemVariants} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 26, height: 26, borderRadius: 999, background: TONE_BG[b.tone] || TONE_BG.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconGlyph name={b.icon} color={TONE_COLOR[b.tone] || primary} />
            </span>
            <span style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>{b.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {aiError && fetchedOnce && (
        <div style={{ fontSize: 11, color: '#B08B3F', marginTop: 10 }}>AI insights unavailable right now — showing the quick summary instead.</div>
      )}
    </div>
  )
}

// Minimal inline icon set (no external icon font dependency in the app bundle)
function IconGlyph({ name, color }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'trending-up') return <svg {...common}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>
  if (name === 'alert-triangle') return <svg {...common}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  if (name === 'clock-pause') return <svg {...common}><circle cx="12" cy="12" r="9" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></svg>
  return <svg {...common}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a6 6 0 0 0-4 10.5c.5.5.9 1.2 1 2.5h6c.1-1.3.5-2 1-2.5A6 6 0 0 0 12 2Z" /></svg>
}

function Thermometer({ raised, target, thin }) {
  const pct = target > 0 ? Math.min((raised / target) * 100, 100) : 0
  return (
    <div style={{ height: thin ? 3 : 4, background: '#eceae4', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: pct >= 100 ? '#16A34A' : GOLD, borderRadius: 2, transition: 'width 0.6s ease' }} />
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
  const [donationError, setDonationError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...campaign })
  const [editError, setEditError] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'
  const status = statusOf(campaign)

  const load = useCallback(async () => {
    const { data } = await supabase.from('fundraising_donations').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false })
    setDonations(data || [])
    setLoading(false)
  }, [campaign.id])

  useEffect(() => { load() }, [load])

  const addDonation = async () => {
    if (!newDonation.amount) return
    setSaving(true)
    setDonationError(null)
    const amount = parseFloat(newDonation.amount)
    const { data, error } = await supabase.from('fundraising_donations').insert({ campaign_id: campaign.id, org_id: org.id, donor_name: newDonation.donor_name || 'Anonymous', amount, message: newDonation.message || null, gift_aid: newDonation.gift_aid }).select().single()
    if (error) { setDonationError(error.message); setSaving(false); return }
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
    setEditError(null)
    const { data, error } = await supabase.from('fundraising_campaigns').update({
      name: editForm.name,
      description: editForm.description || null,
      target_amount: editForm.target_amount ? parseFloat(editForm.target_amount) : 0,
      end_date: editForm.end_date || null,
    }).eq('id', campaign.id).select().single()
    if (error) { setEditError(error.message); return }
    if (data) { onUpdate(data); setEditing(false) }
  }

  const raised = campaign.raised || 0
  const target = campaign.target_amount || 0
  const pct = target > 0 ? Math.min((raised / target) * 100, 100) : null
  const giftAidTotal = donations.filter(d => d.gift_aid).reduce((s, d) => s + d.amount * 0.25, 0)
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const statusBg = { active: '#E7F6EC', planning: '#F3F2EE', completed: '#F3F2EE' }[status.key]
  const statusColor = { active: '#16803C', planning: '#6B7280', completed: '#6B7280' }[status.key]

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>← Back to fundraising</button>

      {/* Header */}
      <div style={{ paddingBottom: 20, borderBottom: '0.5px solid #e5e7eb', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{campaign.name}</div>
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: statusBg, color: statusColor, fontWeight: 600 }}>{status.label}</span>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>{campaign.description || CAMPAIGN_TYPES.find(t => t.key === campaign.campaign_type)?.label}</div>
          </div>
          <button onClick={() => setEditing(!editing)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>Total raised</div>
        <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 40, lineHeight: 1, color: '#1C2333', marginBottom: 14 }}>£{raised.toLocaleString()}</div>
        {target > 0 && (
          <>
            <Thermometer raised={raised} target={target} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>
              <span>{pct.toFixed(0)}% of £{target.toLocaleString()} goal</span>
              <span>{Math.max(target - raised, 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })} remaining</span>
            </div>
          </>
        )}
        {pct >= 100 && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: '#16A34A' }}>Target reached.</div>}

        <div style={{ display: 'flex', gap: 0, marginTop: 20 }}>
          {[
            { label: 'Donations', value: donations.length },
            { label: 'Gift Aid value', value: giftAidTotal > 0 ? `£${giftAidTotal.toFixed(2)}` : '—' },
            { label: 'Days left', value: daysLeftLabel(campaign, status) },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div style={{ width: '0.5px', background: '#e5e7eb' }} />}
              <div style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, paddingRight: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{s.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Campaign name</label><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Description</label><textarea value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'none' }} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Target amount (£)</label><input type="number" value={editForm.target_amount || ''} onChange={e => setEditForm(f => ({ ...f, target_amount: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>End date</label><input type="date" value={editForm.end_date || ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save changes</button>
            <button onClick={() => setEditing(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
          {editError && <div style={{ marginTop: 10, fontSize: 12, color: '#B91C1C' }}>Couldn't save: {editError}</div>}
        </div>
      )}

      {/* Add donation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9CA3AF' }}>Donations ({donations.length})</div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Record donation</button>
      </div>

      {showAdd && (
        <div style={{ background: '#FAFAF8', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Donor name</label><input value={newDonation.donor_name} onChange={e => setNewDonation(n => ({ ...n, donor_name: e.target.value }))} placeholder="Anonymous" style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Amount (£)</label><input type="number" step="0.01" value={newDonation.amount} onChange={e => setNewDonation(n => ({ ...n, amount: e.target.value }))} placeholder="0.00" style={inp} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Message</label><input value={newDonation.message} onChange={e => setNewDonation(n => ({ ...n, message: e.target.value }))} placeholder="Donation message or reference" style={inp} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={newDonation.gift_aid} onChange={e => setNewDonation(n => ({ ...n, gift_aid: e.target.checked }))} />
            Gift Aid eligible (+25% from HMRC)
          </label>
          {newDonation.gift_aid && newDonation.amount && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#16A34A', fontWeight: 600, marginBottom: 12 }}>
              Gift Aid adds £{(parseFloat(newDonation.amount) * 0.25).toFixed(2)} — total value £{(parseFloat(newDonation.amount) * 1.25).toFixed(2)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addDonation} disabled={saving || !newDonation.amount} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: saving || !newDonation.amount ? '#9CA3AF' : primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Record donation'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
          {donationError && <div style={{ marginTop: 10, fontSize: 12, color: '#B91C1C' }}>Couldn't record donation: {donationError}</div>}
        </div>
      )}

      {/* Donations list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Loading donations...</div>
      ) : donations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, borderRadius: 14, color: '#9CA3AF', border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#374151' }}>No donations recorded yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Start recording donations as they come in.</div>
        </div>
      ) : (
        <div>
          {donations.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < donations.length - 1 ? '0.5px solid #ECEAE4' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{d.donor_name || 'Anonymous'}</span>
                  {d.gift_aid && <span style={{ background: '#E7F6EC', color: '#16803C', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>Gift Aid</span>}
                </div>
                {d.message && <div style={{ fontSize: 12, color: '#6B7280' }}>{d.message}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{format(new Date(d.created_at), 'd MMM yyyy')}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 16, color: '#1C2333' }}>£{d.amount.toFixed(2)}</div>
                {d.gift_aid && <div style={{ fontSize: 10, color: '#16803C' }}>+£{(d.amount * 0.25).toFixed(2)} GA</div>}
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
  const [activeTab, setActiveTab] = useState('overview')
  const [trackerRefresh, setTrackerRefresh] = useState(0)
  const [campaigns, setCampaigns] = useState([])
  const [latestDonationByCampaign, setLatestDonationByCampaign] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', campaign_type: 'general', target_amount: '', start_date: new Date().toISOString().slice(0, 10), end_date: '' })
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: camps }, { data: dons }] = await Promise.all([
      supabase.from('fundraising_campaigns').select('*, fundraising_donations(count)').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('fundraising_donations').select('campaign_id, created_at').eq('org_id', org.id).order('created_at', { ascending: false }),
    ])
    setCampaigns(camps || [])
    const latest = {}
    ;(dons || []).forEach(d => { if (!latest[d.campaign_id]) latest[d.campaign_id] = d.created_at })
    setLatestDonationByCampaign(latest)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const createCampaign = async () => {
    if (!newCampaign.name) return
    setCreating(true)
    setCreateError(null)
    const payload = {
      ...newCampaign,
      org_id: org.id,
      raised: 0,
      target_amount: newCampaign.target_amount ? parseFloat(newCampaign.target_amount) : 0,
      start_date: newCampaign.start_date || null,
      end_date: newCampaign.end_date || null,
    }
    const { data, error } = await supabase.from('fundraising_campaigns').insert(payload).select().single()
    setCreating(false)
    if (error) { setCreateError(error.message); return }
    if (data) { setCampaigns(c => [{ ...data, fundraising_donations: [{ count: 0 }] }, ...c]); setShowCreate(false); setNewCampaign({ name: '', description: '', campaign_type: 'general', target_amount: '', start_date: new Date().toISOString().slice(0, 10), end_date: '' }) }
  }

  const totalRaised = campaigns.reduce((s, c) => s + (c.raised || 0), 0)
  const totalTarget = campaigns.reduce((s, c) => s + (c.target_amount || 0), 0)
  const totalDonations = campaigns.reduce((s, c) => s + (c.fundraising_donations?.[0]?.count || 0), 0)
  const avgDonation = totalDonations > 0 ? totalRaised / totalDonations : null
  const completedCount = campaigns.filter(c => statusOf(c).key === 'completed').length
  const successRate = completedCount > 0 ? Math.round((campaigns.filter(c => statusOf(c).key === 'completed' && (c.raised || 0) >= (c.target_amount || Infinity)).length / completedCount) * 100) : null
  const insights = useMemo(() => buildFundraisingInsights(campaigns, latestDonationByCampaign), [campaigns, latestDonationByCampaign])
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  if (selectedCampaign) return <CampaignDetail campaign={selectedCampaign} org={org} onBack={() => { setSelectedCampaign(null); load() }} onUpdate={updated => { setCampaigns(c => c.map(x => x.id === updated.id ? { ...x, ...updated } : x)); setSelectedCampaign(updated) }} />

  const overviewContent = (
    <>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div>
      ) : (
        <>
          {/* Hero ledger */}
          <div style={{ padding: '20px 0 16px', borderTop: '0.5px solid #e5e7eb', borderBottom: '0.5px solid #e5e7eb', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>Total raised</div>
            <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 48, lineHeight: 1, color: '#1C2333', marginBottom: 14 }}>£{totalRaised.toLocaleString()}</div>
            {totalTarget > 0 ? (
              <>
                <Thermometer raised={totalRaised} target={totalTarget} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{Math.min(Math.round((totalRaised / totalTarget) * 100), 100)}% of £{totalTarget.toLocaleString()} across all campaigns</span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{Math.max(totalTarget - totalRaised, 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })} remaining</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>No campaign targets set yet</div>
            )}
          </div>

          {/* Ledger line items */}
          <div style={{ display: 'flex', marginBottom: 28 }}>
            {[
              { label: 'Campaigns', value: campaigns.length },
              { label: 'Donations', value: totalDonations },
              { label: 'Avg. donation', value: avgDonation !== null ? `£${avgDonation.toFixed(0)}` : '—' },
              { label: 'Success rate', value: successRate !== null ? `${successRate}%` : '—' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div style={{ width: '0.5px', background: '#e5e7eb' }} />}
                <div style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, paddingRight: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{s.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Create campaign */}
          {showCreate && (
            <div style={{ background: '#FAFAF8', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>New fundraising campaign</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Campaign name</label><input value={newCampaign.name} onChange={e => setNewCampaign(n => ({ ...n, name: e.target.value }))} placeholder="e.g. New minibus fund" style={inp} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={newCampaign.campaign_type} onChange={e => setNewCampaign(n => ({ ...n, campaign_type: e.target.value }))} style={inp}>
                    {CAMPAIGN_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Target (£)</label><input type="number" value={newCampaign.target_amount} onChange={e => setNewCampaign(n => ({ ...n, target_amount: e.target.value }))} placeholder="0 = no target" style={inp} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Start date</label><input type="date" value={newCampaign.start_date} onChange={e => setNewCampaign(n => ({ ...n, start_date: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>End date</label><input type="date" value={newCampaign.end_date} onChange={e => setNewCampaign(n => ({ ...n, end_date: e.target.value }))} style={inp} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Description</label><textarea value={newCampaign.description} onChange={e => setNewCampaign(n => ({ ...n, description: e.target.value }))} rows={2} placeholder="What are you raising money for?" style={{ ...inp, resize: 'none' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={createCampaign} disabled={creating || !newCampaign.name} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: creating || !newCampaign.name ? '#9CA3AF' : primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{creating ? 'Creating...' : 'Launch campaign'}</button>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
              {createError && <div style={{ marginTop: 10, fontSize: 12, color: '#B91C1C' }}>Couldn't create the campaign: {createError}</div>}
            </div>
          )}

          {/* Campaigns */}
          {campaigns.length === 0 ? (
            <>
              <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Your first campaign will look like this</div>
              <div style={{ border: '1px dashed #d1d0c8', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, opacity: 0.6, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#6B7280' }}>Summer kit fund</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>Target · 30 days left</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 16, color: '#6B7280' }}>£0</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>raised</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Campaigns</div>
              <div style={{ borderTop: '0.5px solid #e5e7eb', marginBottom: 28 }}>
                {campaigns.map((c, i) => {
                  const status = statusOf(c)
                  const raised = c.raised || 0
                  const target = c.target_amount || 0
                  const pct = target > 0 ? Math.min((raised / target) * 100, 100) : 0
                  const statusBg = { active: '#E7F6EC', planning: '#F3F2EE', completed: '#F3F2EE' }[status.key]
                  const statusColor = { active: '#16803C', planning: '#6B7280', completed: '#6B7280' }[status.key]
                  return (
                    <div key={c.id} onClick={() => setSelectedCampaign(c)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '0.5px solid #e5e7eb', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, color: '#1C2333', fontWeight: 500 }}>{c.name}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: statusBg, color: statusColor, fontWeight: 600 }}>{status.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                          {target > 0 ? `£${raised.toLocaleString()} of £${target.toLocaleString()}` : `£${raised.toLocaleString()} raised`} · {daysLeftLabel(c, status)}
                        </div>
                      </div>
                      {target > 0 && !isMobile && (
                        <div style={{ width: 120, flexShrink: 0 }}><Thermometer raised={raised} target={target} thin /></div>
                      )}
                      <div style={{ fontSize: 13, color: '#6B7280', width: 36, textAlign: 'right', flexShrink: 0 }}>{target > 0 ? `${pct.toFixed(0)}%` : '—'}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Insights */}
          {insights.length > 0 && <InsightsPanel bullets={insights} org={org} primary={primary} />}

          {/* Discover Funding pointer */}
          <button onClick={() => setActiveTab('discover')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, color: '#1C2333' }}>Discover funding for {org?.name}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Real, researched UK funders — search, save and track applications</div>
            </div>
            <span style={{ fontSize: 12, color: primary, flexShrink: 0 }}>Open →</span>
          </button>
        </>
      )}
    </>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Fundraising · {org?.name}</div>
          <div style={{ fontSize: 15, color: '#6B7280' }}>{campaigns.filter(c => statusOf(c).key === 'active').length} active campaign{campaigns.filter(c => statusOf(c).key === 'active').length !== 1 ? 's' : ''}</div>
        </div>
        {activeTab === 'overview' && <button onClick={() => setShowCreate(true)} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New campaign</button>}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: activeTab === t.key ? primary : '#9CA3AF', borderBottom: activeTab === t.key ? `2px solid ${primary}` : '2px solid transparent', whiteSpace: 'nowrap', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: activeTab === 'overview' ? 760 : 820 }}>
        {activeTab === 'overview' && overviewContent}
        {activeTab === 'discover' && <FundingMarketplace org={org} primary={primary} onTrack={() => setTrackerRefresh(k => k + 1)} />}
        {activeTab === 'calendar' && <FundraisingCalendar org={org} />}
        {activeTab === 'documents' && <DocumentVault org={org} />}
        {activeTab === 'applications' && <ApplicationTracker org={org} refreshKey={trackerRefresh} />}
      </div>
    </div>
  )
}
