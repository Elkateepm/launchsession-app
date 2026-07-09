import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const CATEGORIES = [
  { key: 'all', label: 'All', icon: null },
  { key: 'sport', label: 'Sport', icon: 'sport' },
  { key: 'youth', label: 'Youth', icon: 'youth' },
  { key: 'community', label: 'Community', icon: 'community' },
  { key: 'education', label: 'Education', icon: 'education' },
  { key: 'environment', label: 'Environment', icon: 'environment' },
  { key: 'general', label: 'General', icon: 'general' },
]

// Muted, professional palette — no bright/garish hues, cycles deterministically per funder
const AVATAR_PALETTE = [
  { bg: '#EEF2F1', fg: '#2F6F63' }, // teal
  { bg: '#EFEEF6', fg: '#4C4A8C' }, // indigo
  { bg: '#F6EFEA', fg: '#8C5A3C' }, // terracotta
  { bg: '#EEF3EA', fg: '#4E7A3A' }, // forest
  { bg: '#EAEEF4', fg: '#375A82' }, // navy
  { bg: '#F4EEF2', fg: '#7A4066' }, // plum
  { bg: '#F6F1E6', fg: '#92640C' }, // amber (gold family, consistent with money accent elsewhere)
  { bg: '#EFEFEC', fg: '#54524A' }, // slate
]

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function initialsOf(name) {
  const words = name.replace(/^The\s+/i, '').split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function FunderAvatar({ name, size = 44 }) {
  const palette = AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length]
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: palette.bg, color: palette.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, fontFamily: 'Georgia, "Times New Roman", serif', flexShrink: 0, letterSpacing: '0.02em' }}>
      {initialsOf(name)}
    </div>
  )
}

const CATEGORY_META = {
  sport: { label: 'Sport', color: '#2F6F63', bg: '#EEF2F1' },
  youth: { label: 'Youth', color: '#4C4A8C', bg: '#EFEEF6' },
  community: { label: 'Community', color: '#375A82', bg: '#EAEEF4' },
  education: { label: 'Education', color: '#8C5A3C', bg: '#F6EFEA' },
  environment: { label: 'Environment', color: '#4E7A3A', bg: '#EEF3EA' },
  general: { label: 'General', color: '#54524A', bg: '#EFEFEC' },
}

function CategoryIcon({ category, color }) {
  const common = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (category === 'sport') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>
  if (category === 'youth') return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
  if (category === 'community') return <svg {...common}><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2 19c0-3 2.5-5 6-5s6 2 6 5M12 19c0-3 2.5-5 6-5s4 2 4 5" /></svg>
  if (category === 'education') return <svg {...common}><path d="M3 8l9-4 9 4-9 4-9-4Z" /><path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" /></svg>
  if (category === 'environment') return <svg {...common}><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
  return <svg {...common}><path d="M12 2l2.4 6.6L21 10l-5.5 4.3L17 21l-5-3.6L7 21l1.5-6.7L3 10l6.6-1.4L12 2Z" /></svg>
}

function formatAmount(min, max) {
  const fmt = n => `£${Number(n).toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (max) return `Up to ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return 'Amount varies'
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function FundingMarketplace({ org, primary, onTrack }) {
  const [grants, setGrants] = useState([])
  const [saves, setSaves] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [savedOnly, setSavedOnly] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [trackedFeedback, setTrackedFeedback] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from('grants').select('*').eq('active', true).order('funder_name'),
      supabase.from('grant_saves').select('id, grant_id').eq('org_id', org.id),
    ])
    setGrants(g || [])
    const saveMap = {}
    ;(s || []).forEach(row => { saveMap[row.grant_id] = row.id })
    setSaves(saveMap)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const toggleSave = async (grantId) => {
    setBusyId(grantId)
    if (saves[grantId]) {
      await supabase.from('grant_saves').delete().eq('id', saves[grantId])
      setSaves(s => { const n = { ...s }; delete n[grantId]; return n })
    } else {
      const { data } = await supabase.from('grant_saves').insert({ org_id: org.id, grant_id: grantId }).select().single()
      if (data) setSaves(s => ({ ...s, [grantId]: data.id }))
    }
    setBusyId(null)
  }

  const trackApplication = async (grant) => {
    setBusyId(grant.id)
    const { error } = await supabase.from('grant_applications').insert({ org_id: org.id, grant_id: grant.id, stage: 'researching' })
    setBusyId(null)
    if (!error) {
      setTrackedFeedback(grant.id)
      setTimeout(() => setTrackedFeedback(null), 2000)
      if (onTrack) onTrack()
    }
  }

  const filtered = useMemo(() => {
    return grants.filter(g => {
      if (category !== 'all' && g.category !== category) return false
      if (savedOnly && !saves[g.id]) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(g.name.toLowerCase().includes(q) || g.funder_name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [grants, category, savedOnly, saves, search])

  const inp = { padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E3DC', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search grants, funders, or keywords…" style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: category === c.key ? `1.5px solid ${primary}` : '1.5px solid #E5E3DC', background: category === c.key ? `${primary}10` : '#fff', color: category === c.key ? primary : '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              {c.icon && <CategoryIcon category={c.icon} color={category === c.key ? primary : '#9CA3AF'} />}
              {c.label}
            </button>
          ))}
          <button onClick={() => setSavedOnly(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 20, border: savedOnly ? '1.5px solid #BA7517' : '1.5px solid #E5E3DC', background: savedOnly ? '#FDF6E8' : '#fff', color: savedOnly ? '#92640C' : '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
            {savedOnly ? '★ Saved only' : '☆ Saved only'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
        {loading ? 'Loading…' : `${filtered.length} funder${filtered.length === 1 ? '' : 's'}`} · A curated, manually researched list — not a live-matched or auto-scraped feed. Always confirm current criteria on the funder's own site before applying.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, border: '1.5px dashed #E5E3DC', borderRadius: 14, color: '#9CA3AF' }}>No funders match your filters.</div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          <AnimatePresence>
            {filtered.map(g => {
              const meta = CATEGORY_META[g.category] || CATEGORY_META.general
              return (
                <motion.div key={g.id} layout variants={cardVariants} whileHover={{ y: -3, boxShadow: '0 10px 24px rgba(28,35,51,0.08)' }}
                  style={{ border: '1px solid #E5E3DC', borderRadius: 16, padding: '18px 20px', background: '#fff', transition: 'box-shadow 0.2s' }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <FunderAvatar name={g.funder_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: '#1C2333', lineHeight: 1.25 }}>{g.name}</div>
                      <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{g.funder_name}</div>
                    </div>
                    <button onClick={() => toggleSave(g.id)} disabled={busyId === g.id} title={saves[g.id] ? 'Unsave' : 'Save'}
                      style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: saves[g.id] ? '#BA7517' : '#D1D5DB', flexShrink: 0, padding: 0, alignSelf: 'flex-start' }}>
                      {saves[g.id] ? '★' : '☆'}
                    </button>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
                    <CategoryIcon category={g.category} color={meta.color} />
                    {meta.label}
                    <span style={{ opacity: 0.6, fontWeight: 500 }}>· {g.scope === 'local' ? 'Local' : 'National'}</span>
                  </div>

                  <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.55, marginBottom: 14, minHeight: 40 }}>{g.description}</div>

                  <div style={{ display: 'flex', gap: 20, marginBottom: 14, paddingTop: 12, borderTop: '0.5px solid #ECEAE4' }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</div>
                      <div style={{ fontSize: 13, color: '#92640C', fontWeight: 600, marginTop: 2 }}>{formatAmount(g.amount_min, g.amount_max)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deadline</div>
                      <div style={{ fontSize: 13, color: '#1C2333', fontWeight: 500, marginTop: 2 }}>{g.deadline_type === 'fixed' && g.deadline_date ? format(new Date(g.deadline_date), 'd MMM yyyy') : 'Rolling'}</div>
                    </div>
                  </div>

                  {g.amount_note && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 10, marginTop: -6 }}>{g.amount_note}</div>}
                  {g.eligibility && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, background: '#FAFAF8', border: '1px solid #ECEAE4', borderRadius: 8, padding: '8px 10px' }}><strong style={{ color: '#4B5563' }}>Eligibility: </strong>{g.eligibility}</div>}

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <a href={g.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: primary, fontWeight: 600, textDecoration: 'none' }}>Visit website →</a>
                    <button onClick={() => trackApplication(g)} disabled={busyId === g.id}
                      style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 9, border: '1.5px solid #E5E3DC', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      {trackedFeedback === g.id ? 'Added ✓' : '+ Track application'}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
