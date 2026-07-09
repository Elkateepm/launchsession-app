import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const DAY_MS = 1000 * 60 * 60 * 24
const RECENT_KEY = 'ls_grant_recent_searches'

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
  { bg: '#EEF2F1', fg: '#2F6F63' },
  { bg: '#EFEEF6', fg: '#4C4A8C' },
  { bg: '#F6EFEA', fg: '#8C5A3C' },
  { bg: '#EEF3EA', fg: '#4E7A3A' },
  { bg: '#EAEEF4', fg: '#375A82' },
  { bg: '#F4EEF2', fg: '#7A4066' },
  { bg: '#F6F1E6', fg: '#92640C' },
  { bg: '#EFEFEC', fg: '#54524A' },
]

const FUNDING_TYPE_META = {
  grant: 'Grant', lottery: 'Lottery', trust: 'Trust', corporate: 'Corporate', local_authority: 'Local Authority',
}

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

function CategoryIcon({ category, color, size = 12 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (category === 'sport') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>
  if (category === 'youth') return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
  if (category === 'community') return <svg {...common}><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2 19c0-3 2.5-5 6-5s6 2 6 5M12 19c0-3 2.5-5 6-5s4 2 4 5" /></svg>
  if (category === 'education') return <svg {...common}><path d="M3 8l9-4 9 4-9 4-9-4Z" /><path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" /></svg>
  if (category === 'environment') return <svg {...common}><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
  return <svg {...common}><path d="M12 2l2.4 6.6L21 10l-5.5 4.3L17 21l-5-3.6L7 21l1.5-6.7L3 10l6.6-1.4L12 2Z" /></svg>
}

function SearchIcon({ color = '#9CA3AF' }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
}

function ClockIcon({ color }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
}

function CheckIcon({ color }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" /></svg>
}

function ShareIcon({ color }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" /></svg>
}

function formatAmount(min, max) {
  const fmt = n => `£${Number(n).toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (max) return `Up to ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return 'Amount varies'
}

// Best-effort reformat of free-text eligibility into scannable bullets.
// This is a text-splitting convenience, not a structured or matched checklist.
function eligibilityBullets(text) {
  if (!text) return []
  return text.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(Boolean).slice(0, 5)
}

function DeadlineBadge({ grant }) {
  if (grant.deadline_type !== 'fixed' || !grant.deadline_date) {
    return <span style={{ fontSize: 13, color: '#1C2333', fontWeight: 500 }}>Rolling</span>
  }
  const daysLeft = Math.ceil((new Date(grant.deadline_date) - new Date()) / DAY_MS)
  if (daysLeft < 0) return <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>Closed</span>
  const color = daysLeft <= 7 ? '#B91C1C' : daysLeft <= 30 ? '#B45309' : '#1C2333'
  return (
    <span style={{ fontSize: 13, color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
      {daysLeft <= 30 && <ClockIcon color={color} />}
      {daysLeft === 0 ? 'Today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
    </span>
  )
}

const cardVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export default function FundingMarketplace({ org, primary, onTrack }) {
  const [grants, setGrants] = useState([])
  const [saves, setSaves] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])
  const [category, setCategory] = useState('all')
  const [savedOnly, setSavedOnly] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [trackedFeedback, setTrackedFeedback] = useState(null)
  const [shareFeedback, setShareFeedback] = useState(null)
  const [tipDismissed, setTipDismissed] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    try { setRecentSearches(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')) } catch { /* ignore */ }
    try { setTipDismissed(localStorage.getItem('ls_grant_tip_dismissed') === '1') } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const onKeyDown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const commitSearch = (term) => {
    if (!term) return
    setRecentSearches(prev => {
      const next = [term, ...prev.filter(t => t !== term)].slice(0, 5)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const dismissTip = () => {
    setTipDismissed(true)
    try { localStorage.setItem('ls_grant_tip_dismissed', '1') } catch { /* ignore */ }
  }

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

  const shareGrant = async (grant) => {
    const shareData = { title: grant.name, text: `${grant.name} — ${grant.funder_name}`, url: grant.website_url }
    if (navigator.share) {
      try { await navigator.share(shareData); return } catch { /* user cancelled or unsupported, fall through */ }
    }
    try {
      await navigator.clipboard.writeText(grant.website_url)
      setShareFeedback(grant.id)
      setTimeout(() => setShareFeedback(null), 1800)
    } catch { /* clipboard unavailable */ }
  }

  const categoryCounts = useMemo(() => {
    const counts = { all: grants.length }
    CATEGORIES.forEach(c => { if (c.key !== 'all') counts[c.key] = grants.filter(g => g.category === c.key).length })
    return counts
  }, [grants])

  const mostRecentUpdate = useMemo(() => {
    if (grants.length === 0) return null
    const latest = grants.reduce((max, g) => new Date(g.created_at) > new Date(max) ? g.created_at : max, grants[0].created_at)
    return format(new Date(latest), 'd MMM yyyy')
  }, [grants])

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

  const inp = { padding: '11px 14px 11px 38px', borderRadius: 12, border: '1.5px solid #E5E3DC', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const blobColors = [primary, '#8C5A3C', '#4C4A8C', '#4E7A3A', '#92640C']

  return (
    <div style={{ position: 'relative' }}>
      {/* Decorative blurred colour field behind the glass cards */}
      <div style={{ position: 'absolute', inset: '-40px -20px', overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        {blobColors.map((c, i) => (
          <div key={i} style={{
            position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: c,
            opacity: 0.10, filter: 'blur(70px)',
            left: `${(i * 23 + 5) % 90}%`, top: `${(i * 37 + 8) % 70}%`,
          }} />
        ))}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header strip */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>
          <strong style={{ color: '#1C2333', fontVariantNumeric: 'tabular-nums' }}>{grants.length}</strong> funder{grants.length === 1 ? '' : 's'}
        </span>
        {mostRecentUpdate && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Last added {mostRecentUpdate}</span>}
      </div>

      {!tipDismissed && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FDF6E8', border: '1px solid #F3E3BC', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>💡</span>
          <span style={{ fontSize: 12.5, color: '#8A6A2E', lineHeight: 1.5, flex: 1 }}>
            This is a manually researched directory, not a live-matched feed — always confirm current criteria on the funder's own site before applying.
          </span>
          <button onClick={dismissTip} style={{ background: 'none', border: 'none', color: '#B08B3F', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
        </motion.div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><SearchIcon /></div>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => { setSearchFocused(false); commitSearch(search) }}
            onKeyDown={e => { if (e.key === 'Enter') commitSearch(search) }}
            placeholder="Search grants, funders or keywords…" style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#B0AFA8', border: '1px solid #E5E3DC', borderRadius: 6, padding: '2px 6px', pointerEvents: 'none' }}>⌘K</div>
          <AnimatePresence>
            {searchFocused && !search && recentSearches.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E3DC', borderRadius: 12, boxShadow: '0 8px 20px rgba(28,35,51,0.08)', padding: 8, zIndex: 5 }}>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px' }}>Recent searches</div>
                {recentSearches.map(term => (
                  <div key={term} onMouseDown={() => setSearch(term)} style={{ padding: '7px 8px', borderRadius: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {term}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: category === c.key ? `1.5px solid ${primary}` : '1.5px solid #E5E3DC', background: category === c.key ? `${primary}10` : '#fff', color: category === c.key ? primary : '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}>
              {c.icon && <CategoryIcon category={c.icon} color={category === c.key ? primary : '#9CA3AF'} />}
              {c.label}
              <span style={{ opacity: 0.55, fontWeight: 500 }}>({categoryCounts[c.key] || 0})</span>
            </button>
          ))}
          <button onClick={() => setSavedOnly(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 20, border: savedOnly ? '1.5px solid #BA7517' : '1.5px solid #E5E3DC', background: savedOnly ? '#FDF6E8' : '#fff', color: savedOnly ? '#92640C' : '#6B7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
            {savedOnly ? '★ Saved only' : '☆ Saved only'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, border: '1.5px dashed #E5E3DC', borderRadius: 14, color: '#9CA3AF' }}>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>No funders match your filters</div>
          <div style={{ fontSize: 13 }}>Try a broader category or clear your search.</div>
        </div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 14 }}>
          <AnimatePresence>
            {filtered.map(g => {
              const meta = CATEGORY_META[g.category] || CATEGORY_META.general
              const bullets = eligibilityBullets(g.eligibility)
              return (
                <motion.div key={g.id} layout variants={cardVariants}
                  onMouseMove={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    e.currentTarget.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
                    e.currentTarget.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`)
                  }}
                  onMouseEnter={e => e.currentTarget.style.setProperty('--sO', '1')}
                  onMouseLeave={e => e.currentTarget.style.setProperty('--sO', '0')}
                  whileHover={{ y: -6, boxShadow: `0 18px 40px ${primary}20, 0 4px 14px rgba(28,35,51,0.08)` }}
                  style={{
                    position: 'relative', overflow: 'hidden',
                    background: `linear-gradient(135deg, ${meta.color}1f, rgba(255,255,255,0.62))`,
                    backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                    border: `1px solid ${meta.color}33`, borderRadius: 18, padding: '20px 22px',
                    transition: 'box-shadow 0.25s', '--sO': 0,
                  }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <FunderAvatar name={g.funder_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1C2333', lineHeight: 1.25 }}>{g.name}</div>
                      <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{g.funder_name}</div>
                    </div>
                    <motion.button onClick={() => toggleSave(g.id)} disabled={busyId === g.id} title={saves[g.id] ? 'Unsave' : 'Save'}
                      whileTap={{ scale: 0.8 }}
                      style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', color: saves[g.id] ? '#BA7517' : '#D1D5DB', flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -8 }}>
                      {saves[g.id] ? '★' : '☆'}
                    </motion.button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600 }}>
                      <CategoryIcon category={g.category} color={meta.color} />{meta.label}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: '#F3F2EE', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>{g.scope === 'local' ? 'Local' : 'National'}</span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: '#F3F2EE', color: '#6B7280', fontSize: 11, fontWeight: 600 }}>{FUNDING_TYPE_META[g.funding_type] || g.funding_type}</span>
                  </div>

                  <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description}</div>

                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14, paddingTop: 14, paddingBottom: 14, borderTop: '0.5px solid #ECEAE4', borderBottom: '0.5px solid #ECEAE4' }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Funding</div>
                      <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 18, color: '#92640C', fontWeight: 600 }}>{formatAmount(g.amount_min, g.amount_max)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Deadline</div>
                      <DeadlineBadge grant={g} />
                    </div>
                  </div>

                  {g.amount_note && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 12, marginTop: -6 }}>{g.amount_note}</div>}

                  {bullets.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Eligibility</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {bullets.map((b, i) => (
                          <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: '#4B5563', lineHeight: 1.4 }}>
                            <CheckIcon color="#16A34A" /><span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => trackApplication(g)} disabled={busyId === g.id}
                      style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: primary, color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                      {trackedFeedback === g.id ? 'Added ✓' : 'Track application'}
                    </button>
                    <a href={g.website_url} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #E5E3DC', color: '#374151', fontWeight: 600, fontSize: 12.5, textDecoration: 'none' }}>Visit site</a>
                    <button onClick={() => shareGrant(g)} title="Share"
                      style={{ marginLeft: 'auto', background: 'none', border: '1.5px solid #E5E3DC', borderRadius: 9, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}>
                      {shareFeedback === g.id ? <CheckIcon color="#16A34A" /> : <ShareIcon color="#6B7280" />}
                    </button>
                  </div>
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at var(--mx, 50%) var(--my, 50%), ${primary}55, transparent 55%)`, opacity: 'var(--sO, 0)', transition: 'opacity 0.3s', mixBlendMode: 'overlay', pointerEvents: 'none' }} />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
      </div>
    </div>
  )
}
