import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Lottie from 'lottie-react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'
import FundingMarketplace from './FundingMarketplace'
import FundingMixChart from './FundingMixChart'
import CampaignComparisonChart from './CampaignComparisonChart'
import GivingHeatmap from './GivingHeatmap'
import FundraisingCalendar from './FundraisingCalendar'
import DocumentVault from './DocumentVault'
import ApplicationTracker from './ApplicationTracker'
import successCheckAnimation from '../../assets/lottie/success-check.json'
import { LS } from './fundraisingShared'
import FundraisingHeader from './hub/FundraisingHeader'
import FundraisingHero from './hub/FundraisingHero'
import FundraisingQuickActions from './hub/FundraisingQuickActions'
import FundraisingKpis from './hub/FundraisingKpis'
import ActiveCampaignsPanel from './hub/ActiveCampaignsPanel'
import FundingOpportunitiesPanel from './hub/FundingOpportunitiesPanel'
import FundingPipelinePanel from './hub/FundingPipelinePanel'
import UpcomingDeadlinesStrip from './hub/UpcomingDeadlinesStrip'
import ImpactSnapshotPanel from './hub/ImpactSnapshotPanel'
import FundraisingAssistantCard from './hub/FundraisingAssistantCard'

const CAMPAIGN_TYPES = [
  { key: 'general',    label: 'General fundraiser' },
  { key: 'equipment',  label: 'Equipment fund' },
  { key: 'trips',      label: 'Trips and events' },
  { key: 'bursary',    label: 'Bursary fund' },
  { key: 'emergency',  label: 'Emergency appeal' },
  { key: 'annual',     label: 'Annual appeal' },
]

const CAMPAIGN_TEMPLATES = [
  { label: 'Sponsored walk', name: 'Sponsored Walk', type: 'general', description: 'Supporters get sponsored to complete a walk, with all proceeds going toward the cause.' },
  { label: 'Fun run', name: 'Fun Run', type: 'general', description: 'A community fun run with entry fees and sponsorship going toward the cause.' },
  { label: 'Quiz night', name: 'Quiz Night', type: 'general', description: 'A ticketed quiz night — entry fees and a raffle raise funds for the cause.' },
  { label: 'Bake sale', name: 'Bake Sale', type: 'general', description: 'A community bake sale raising funds through cake and treat sales.' },
  { label: 'Equipment appeal', name: 'Equipment Appeal', type: 'equipment', description: 'Raising funds for new equipment to support our sessions and activities.' },
  { label: 'Trip fund', name: 'Trip Fund', type: 'trips', description: 'Helping cover the cost of an upcoming trip or outing for our young people.' },
]

const GOLD = '#BA7517'
const DAY_MS = 1000 * 60 * 60 * 24

function AnimatedNumber({ value, prefix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const duration = 700
    const to = Number(value) || 0
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(to * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{prefix}{display.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>
}

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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => setShowInfo(v => !v)} title="What data does this use?"
            style={{ background: 'none', cursor: 'pointer', border: 'none', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 16, height: 16, fontSize: 11, color: '#B08B3F', borderRadius: 999, border: '1px solid #E2C77E', lineHeight: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>i</span>
          </button>
          <motion.button onClick={() => fetchAI(true)} disabled={aiLoading} whileTap={{ scale: 0.85, rotate: 20 }}
            title="Refresh insights" style={{ background: 'none', border: 'none', cursor: aiLoading ? 'default' : 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.span animate={aiLoading ? { rotate: 360 } : { rotate: 0 }} transition={aiLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
              style={{ fontSize: 14, color: '#B08B3F', display: 'inline-block' }}>↻</motion.span>
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

function CampaignDetail({ campaign, org, onBack, onUpdate, isAdmin }) {
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
          {isAdmin && (
            <button onClick={() => setEditing(!editing)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
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
        {pct >= 100 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 34, height: 34, flexShrink: 0 }}>
              <Lottie animationData={successCheckAnimation} loop={false} autoplay />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#16A34A' }}>Target reached.</span>
          </div>
        )}

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
        {isAdmin && <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Record donation</button>}
      </div>

      {isAdmin && showAdd && (
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

export default function Fundraising({ org, isAdmin }) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('overview')
  const [trackerRefresh, setTrackerRefresh] = useState(0)
  const [campaigns, setCampaigns] = useState([])
  const [latestDonationByCampaign, setLatestDonationByCampaign] = useState({})
  const [donationHistory, setDonationHistory] = useState([])
  const [previewGrants, setPreviewGrants] = useState([])
  const [deadlineEvents, setDeadlineEvents] = useState([])
  const [deadlinesLoading, setDeadlinesLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', campaign_type: 'general', target_amount: '', start_date: new Date().toISOString().slice(0, 10), end_date: '' })
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: camps }, { data: dons }, { data: grantPreview }] = await Promise.all([
      supabase.from('fundraising_campaigns').select('*, fundraising_donations(count)').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('fundraising_donations').select('campaign_id, donor_name, amount, gift_aid, created_at').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('grants').select('id, name, funder_name, amount_min, amount_max, category').eq('active', true).order('funder_name').limit(2),
    ])
    setCampaigns(camps || [])
    const latest = {}
    ;(dons || []).forEach(d => { if (!latest[d.campaign_id]) latest[d.campaign_id] = d.created_at })
    setLatestDonationByCampaign(latest)
    setDonationHistory(dons || [])
    setPreviewGrants(grantPreview || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  // Powers both the KPI/hero "next deadline" figures and the Upcoming Deadlines
  // strip — fetched once here and passed down, rather than re-queried per card.
  const loadDeadlines = useCallback(async () => {
    setDeadlinesLoading(true)
    const [{ data: savedGrants }, { data: campaignsWithEnd }, { data: applications }] = await Promise.all([
      supabase.from('grant_saves').select('grant_id, grants(name, funder_name, deadline_type, deadline_date)').eq('org_id', org.id),
      supabase.from('fundraising_campaigns').select('id, name, end_date').eq('org_id', org.id).not('end_date', 'is', null),
      supabase.from('grant_applications').select('id, custom_name, target_date, stage, grants(name, funder_name)').eq('org_id', org.id).not('target_date', 'is', null),
    ])
    const evts = []
    ;(savedGrants || []).forEach(row => {
      const g = row.grants
      if (g?.deadline_type === 'fixed' && g.deadline_date) evts.push({ type: 'grant', date: g.deadline_date, title: g.name, subtitle: g.funder_name })
    })
    ;(campaignsWithEnd || []).forEach(c => evts.push({ type: 'campaign', date: c.end_date, title: c.name, subtitle: 'Campaign ends' }))
    ;(applications || []).forEach(a => {
      if (a.stage === 'submitted' || a.stage === 'awarded' || a.stage === 'declined') return
      evts.push({ type: 'application', date: a.target_date, title: a.grants?.name || a.custom_name || 'Application', subtitle: 'Your target date' })
    })
    const now = new Date()
    const future = evts.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date))
    setDeadlineEvents(future)
    setDeadlinesLoading(false)
  }, [org.id])

  useEffect(() => { loadDeadlines() }, [loadDeadlines])

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

  const totalTarget = campaigns.reduce((s, c) => s + (c.target_amount || 0), 0)
  const completedCount = campaigns.filter(c => statusOf(c).key === 'completed').length
  const successRate = completedCount > 0 ? Math.round((campaigns.filter(c => statusOf(c).key === 'completed' && (c.raised || 0) >= (c.target_amount || Infinity)).length / completedCount) * 100) : null
  const insights = useMemo(() => buildFundraisingInsights(campaigns, latestDonationByCampaign), [campaigns, latestDonationByCampaign])

  const recentActivity = useMemo(() => {
    const campaignName = id => campaigns.find(c => c.id === id)?.name || 'a campaign'
    const donationEvents = donationHistory.slice(0, 6).map(d => ({
      type: 'donation', date: d.created_at,
      text: `${d.donor_name || 'Anonymous'} donated £${Number(d.amount).toLocaleString()} to ${campaignName(d.campaign_id)}${d.gift_aid ? ' (Gift Aid)' : ''}`,
    }))
    const milestoneEvents = campaigns.filter(c => c.target_amount > 0 && (c.raised || 0) >= c.target_amount).map(c => ({
      type: 'milestone', date: c.created_at, text: `🎉 ${c.name} reached its £${Number(c.target_amount).toLocaleString()} target!`,
    }))
    return [...donationEvents, ...milestoneEvents].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)
  }, [donationHistory, campaigns])

  // ── Fundraising Hub redesign: derived stats for the hero/KPI/focus cards ──
  const raisedThisYear = useMemo(() => {
    const y = new Date().getFullYear()
    return donationHistory.filter(d => new Date(d.created_at).getFullYear() === y).reduce((s, d) => s + (Number(d.amount) || 0), 0)
  }, [donationHistory])

  const yearDelta = useMemo(() => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const dayOfYear = Math.floor((now - new Date(thisYear, 0, 1)) / DAY_MS)
    let thisYearTotal = 0, lastYearToDateTotal = 0
    donationHistory.forEach(d => {
      const dt = new Date(d.created_at)
      if (dt.getFullYear() === thisYear) thisYearTotal += Number(d.amount) || 0
      else if (dt.getFullYear() === thisYear - 1) {
        const doy = Math.floor((dt - new Date(thisYear - 1, 0, 1)) / DAY_MS)
        if (doy <= dayOfYear) lastYearToDateTotal += Number(d.amount) || 0
      }
    })
    if (lastYearToDateTotal > 0) return Math.round(((thisYearTotal - lastYearToDateTotal) / lastYearToDateTotal) * 100)
    if (thisYearTotal > 0) return 'new'
    return null
  }, [donationHistory])

  const endingSoonCount = useMemo(() => campaigns.filter(c => {
    const status = statusOf(c)
    if (status.key !== 'active' || !c.end_date) return false
    const days = Math.ceil((new Date(c.end_date) - new Date()) / DAY_MS)
    return days >= 0 && days <= 7
  }).length, [campaigns])

  const upcomingDeadlinesCount = deadlineEvents.length
  const nextDeadlineDays = deadlineEvents.length > 0 ? Math.max(0, Math.ceil((new Date(deadlineEvents[0].date) - new Date()) / DAY_MS)) : null

  const focusItems = useMemo(() => {
    const items = []
    if (deadlineEvents.length > 0) {
      const first = deadlineEvents[0]
      const days = Math.max(0, Math.ceil((new Date(first.date) - new Date()) / DAY_MS))
      if (days <= 14) items.push({ icon: 'clock', text: `${first.title} closes in ${days} day${days === 1 ? '' : 's'}.` })
    }
    insights.filter(b => b.tone === 'warning').forEach(b => items.push({ icon: 'alert-triangle', text: b.text }))
    return items.slice(0, 3)
  }, [deadlineEvents, insights])

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const reportsRef = React.useRef(null)
  const scrollToReports = () => reportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const [shareFeedback, setShareFeedback] = useState(false)

  const shareCampaign = async () => {
    const target = campaigns.find(c => statusOf(c).key === 'active') || campaigns[0]
    if (!target) { setShowCreate(true); return }
    const raised = target.raised || 0
    const targetAmt = target.target_amount || 0
    const text = `Help us reach our goal for "${target.name}"! We've raised £${raised.toLocaleString()}${targetAmt ? ` of £${targetAmt.toLocaleString()}` : ''} so far.`
    try {
      if (navigator.share) {
        await navigator.share({ title: target.name, text })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setShareFeedback(true)
        setTimeout(() => setShareFeedback(false), 2500)
      }
    } catch (err) { /* user cancelled the native share sheet */ }
  }

  if (selectedCampaign) return <CampaignDetail campaign={selectedCampaign} org={org} isAdmin={isAdmin} onBack={() => { setSelectedCampaign(null); load() }} onUpdate={updated => { setCampaigns(c => c.map(x => x.id === updated.id ? { ...x, ...updated } : x)); setSelectedCampaign(updated) }} />

  const overviewContent = (
    <>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: LS.muted }}>Loading...</div>
      ) : (
        <>
          {shareFeedback && (
            <div style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: LS.text, color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 12.5, fontWeight: 600, boxShadow: '0 10px 26px rgba(0,0,0,0.25)' }}>
              Campaign summary copied — paste it anywhere to share
            </div>
          )}

          <FundraisingHero
            campaigns={campaigns}
            donationHistory={donationHistory}
            totalTarget={totalTarget}
            focusItems={focusItems}
            onReviewFocus={() => { deadlineEvents.length > 0 ? setActiveTab('calendar') : scrollToReports() }}
          />

          <FundraisingQuickActions
            isAdmin={isAdmin}
            onNewCampaign={() => setShowCreate(true)}
            onFindFunding={() => setActiveTab('discover')}
            onNewApplication={() => setActiveTab('applications')}
            onDocuments={() => setActiveTab('documents')}
            onShareCampaign={shareCampaign}
            onReports={scrollToReports}
          />

          <FundraisingKpis
            raisedThisYear={raisedThisYear}
            monthDelta={yearDelta}
            activeCount={campaigns.filter(c => statusOf(c).key === 'active').length}
            endingSoonCount={endingSoonCount}
            upcomingDeadlinesCount={upcomingDeadlinesCount}
            nextDeadlineDays={nextDeadlineDays}
            successRate={successRate}
            successRateSampleSize={completedCount}
          />

          {/* Create campaign */}
          {isAdmin && showCreate && (
            <div style={{ background: '#FAFAF8', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>New fundraising campaign</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Quick start</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {CAMPAIGN_TEMPLATES.map(t => (
                  <button key={t.label} type="button" onClick={() => setNewCampaign(n => ({ ...n, name: n.name || t.name, description: n.description || t.description, campaign_type: t.type }))}
                    style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', color: '#6B7280', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
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
                <button onClick={createCampaign} disabled={creating || !newCampaign.name} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: creating || !newCampaign.name ? '#9CA3AF' : LS.purple, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{creating ? 'Creating...' : 'Launch campaign'}</button>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
              {createError && <div style={{ marginTop: 10, fontSize: 12, color: '#B91C1C' }}>Couldn't create the campaign: {createError}</div>}
            </div>
          )}

          {/* Main content grid: campaigns / opportunities / pipeline */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <ActiveCampaignsPanel campaigns={campaigns} isMobile={isMobile} isAdmin={isAdmin}
              onSelect={setSelectedCampaign} onNewCampaign={() => setShowCreate(true)} />
            <FundingOpportunitiesPanel org={org} campaigns={campaigns}
              onOpen={() => setActiveTab('discover')} onViewAll={() => setActiveTab('discover')} />
            <FundingPipelinePanel org={org} onViewPipeline={() => setActiveTab('applications')} />
          </div>

          {/* Lower row: deadlines / impact / assistant */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            <UpcomingDeadlinesStrip events={deadlineEvents} loading={deadlinesLoading} onViewCalendar={() => setActiveTab('calendar')} />
            <ImpactSnapshotPanel org={org} />
            <FundraisingAssistantCard bullets={insights} onViewAll={scrollToReports} />
          </div>

          {/* Reports & Insights — existing analytics, activity feed, full insights panel and a Discover Funding preview, preserved from the previous layout */}
          <div ref={reportsRef} style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10, paddingTop: 4 }}>Reports &amp; Insights</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <FundingMixChart campaigns={campaigns} />
            <CampaignComparisonChart campaigns={campaigns} />
          </div>
          <GivingHeatmap donations={donationHistory} />

          {/* Recent activity */}
          {recentActivity.length > 0 && (
            <>
              <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Recent activity</div>
              <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }} style={{ borderTop: '0.5px solid #e5e7eb', marginBottom: 28 }}>
                {recentActivity.map((e, i) => (
                  <motion.div key={i} variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #e5e7eb' }}>
                    <span style={{ fontSize: 13, color: '#4B5563', flex: 1 }}>{e.text}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{format(new Date(e.date), 'd MMM')}</span>
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}

          {/* Insights */}
          {insights.length > 0 && <InsightsPanel bullets={insights} org={org} primary={primary} />}

          {/* Discover Funding preview */}
          <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Discover funding</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {previewGrants.map(g => (
              <div key={g.id} onClick={() => setActiveTab('discover')} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', background: '#fff' }}>
                <div style={{ fontSize: 13.5, color: '#1C2333', fontWeight: 500, marginBottom: 2 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>{g.funder_name}</div>
                <div style={{ fontSize: 12.5, color: GOLD, fontWeight: 600 }}>
                  {g.amount_min && g.amount_max ? `£${Number(g.amount_min).toLocaleString()} – £${Number(g.amount_max).toLocaleString()}` : g.amount_max ? `Up to £${Number(g.amount_max).toLocaleString()}` : 'Amount varies'}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setActiveTab('discover')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 14, background: '#FAFAF8', cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: '#6B7280' }}>Real, researched UK funders for {org?.name} — search, save and track applications</div>
            </div>
            <span style={{ fontSize: 12, color: primary, flexShrink: 0, fontWeight: 600 }}>View all →</span>
          </button>
        </>
      )}
    </>
  )

  return (
    <div>
      <FundraisingHeader isAdmin={isAdmin} onNewCampaign={() => setShowCreate(true)} onOpenAssistant={scrollToReports} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: LS.bg, border: `1px solid ${LS.border}`, borderRadius: 13, padding: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              position: 'relative', padding: '9px 16px', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              color: activeTab === t.key ? '#fff' : LS.muted, background: activeTab === t.key ? LS.gradient : 'transparent',
              whiteSpace: 'nowrap', transition: 'background 0.2s, color 0.2s', flexShrink: 0,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {activeTab === 'overview' && overviewContent}
        {activeTab === 'discover' && <FundingMarketplace org={org} primary={primary} onTrack={() => setTrackerRefresh(k => k + 1)} />}
        {activeTab === 'calendar' && <FundraisingCalendar org={org} />}
        {activeTab === 'documents' && <DocumentVault org={org} isAdmin={isAdmin} />}
        {activeTab === 'applications' && <ApplicationTracker org={org} refreshKey={trackerRefresh} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

