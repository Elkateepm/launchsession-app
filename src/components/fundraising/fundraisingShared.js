import { useState, useEffect } from 'react'

export const DAY_MS = 1000 * 60 * 60 * 24
export const GOLD = '#BA7517'

// ─── LaunchSession purple "space" identity for this page's chrome.
// (Distinct from org.primary_color, which still drives small org-branded
// accents like the active tab underline — see Fundraising.jsx.)
export const LS = {
  purple: '#7C5CFC',
  purpleDark: '#5B3DF0',
  purpleDeep: '#4B2FC4',
  gradient: 'linear-gradient(135deg, #8B6CFF 0%, #6647F0 100%)',
  softGradient: 'linear-gradient(135deg, #F1EDFF 0%, #FBFAFF 100%)',
  lavender: '#F1EDFF',
  lavenderBorder: '#E4DCFB',
  border: '#ECE9F5',
  bg: '#FAF9FE',
  text: '#1C1B2E',
  muted: '#8B87A3',
  success: '#16A34A',
  warning: '#B45309',
  danger: '#DC2626',
}

export const CAMPAIGN_TYPES = [
  { key: 'general',    label: 'General fundraiser' },
  { key: 'equipment',  label: 'Equipment fund' },
  { key: 'trips',      label: 'Trips and events' },
  { key: 'bursary',    label: 'Bursary fund' },
  { key: 'emergency',  label: 'Emergency appeal' },
  { key: 'annual',     label: 'Annual appeal' },
]

export const CAMPAIGN_TEMPLATES = [
  { label: 'Sponsored walk', name: 'Sponsored Walk', type: 'general', description: 'Supporters get sponsored to complete a walk, with all proceeds going toward the cause.' },
  { label: 'Fun run', name: 'Fun Run', type: 'general', description: 'A community fun run with entry fees and sponsorship going toward the cause.' },
  { label: 'Quiz night', name: 'Quiz Night', type: 'general', description: 'A ticketed quiz night — entry fees and a raffle raise funds for the cause.' },
  { label: 'Bake sale', name: 'Bake Sale', type: 'general', description: 'A community bake sale raising funds through cake and treat sales.' },
  { label: 'Equipment appeal', name: 'Equipment Appeal', type: 'equipment', description: 'Raising funds for new equipment to support our sessions and activities.' },
  { label: 'Trip fund', name: 'Trip Fund', type: 'trips', description: 'Helping cover the cost of an upcoming trip or outing for our young people.' },
]

export function statusOf(c) {
  const today = new Date().toISOString().slice(0, 10)
  if (c.start_date && c.start_date > today) return { key: 'planning', label: 'Planning' }
  if (c.end_date && c.end_date < today) return { key: 'completed', label: 'Completed' }
  return { key: 'active', label: 'Active' }
}

export function daysLeftLabel(c, status) {
  if (status.key === 'planning') return `Starts ${new Date(c.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  if (status.key === 'completed') return `Ended ${new Date(c.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  if (c.end_date) {
    const days = Math.ceil((new Date(c.end_date) - new Date()) / DAY_MS)
    return days >= 0 ? `${days} day${days === 1 ? '' : 's'} left` : 'Ended'
  }
  return 'Ongoing'
}

export function daysLeftNumber(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / DAY_MS)
}

export function AnimatedNumber({ value, prefix = '', decimals = 0 }) {
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
  return `${prefix}${display.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`
}

// Purple-tinted progress bar — never visually exceeds 100% even when raised > target.
export function PurpleProgress({ raised, target, height = 8 }) {
  const pct = target > 0 ? Math.min((raised / target) * 100, 100) : 0
  return (
    <div style={{ height, background: LS.lavender, borderRadius: height, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: LS.gradient, borderRadius: height, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  )
}

export function matchScoreBand(score) {
  if (score >= 90) return { label: 'High match', color: LS.success, bg: '#E7F8ED' }
  if (score >= 75) return { label: 'Good match', color: LS.purpleDark, bg: LS.lavender }
  return { label: 'Possible match', color: LS.muted, bg: '#F3F2F7' }
}

// Heuristic match score — no per-org matching data exists yet (grants has no
// org-relevance column), so this is a transparent, explainable estimate:
// favours grants in a category the org already fundraises for, funding still
// open, and amount ranges near what the org's campaigns typically target.
// Documented here rather than presented as a precise/authoritative score.
export function computeMatchScore(grant, campaigns) {
  let score = 62
  const usedTypes = new Set(campaigns.map(c => c.campaign_type).filter(Boolean))
  const categoryHints = { equipment: 'sport', trips: 'youth', bursary: 'community', annual: 'community', emergency: 'community', general: 'general' }
  if (grant.category && [...usedTypes].some(t => categoryHints[t] === grant.category)) score += 18
  if (grant.deadline_type !== 'fixed' || !grant.deadline_date) score += 6
  else {
    const days = daysLeftNumber(grant.deadline_date)
    if (days !== null && days > 21) score += 8
    else if (days !== null && days < 0) score -= 30
  }
  const avgTarget = campaigns.length ? campaigns.reduce((s, c) => s + (c.target_amount || 0), 0) / campaigns.length : 0
  if (avgTarget > 0 && grant.amount_max) {
    const ratio = grant.amount_max / avgTarget
    if (ratio >= 0.4 && ratio <= 4) score += 10
  }
  return Math.max(20, Math.min(97, Math.round(score)))
}

// ---------------------------------------------------------------------------
// Heuristic insights — pace-to-target, stalled campaigns, missing story.
// No external AI call.
// ---------------------------------------------------------------------------
export function buildFundraisingInsights(campaigns, latestDonationByCampaign) {
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

// Minimal inline icon set (no external icon font dependency in the app bundle)
export function IconGlyph({ name, color, size = 14 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'trending-up') return <svg {...common}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>
  if (name === 'alert-triangle') return <svg {...common}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  if (name === 'clock-pause') return <svg {...common}><circle cx="12" cy="12" r="9" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></svg>
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
  if (name === 'doc') return <svg {...common}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" /></svg>
  if (name === 'heart') return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  if (name === 'file-plus') return <svg {...common}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" /><path d="M12 11v6M9 14h6" /></svg>
  if (name === 'folder') return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
  if (name === 'share') return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" /></svg>
  if (name === 'chart') return <svg {...common}><path d="M3 3v18h18" /><path d="M18 8l-5 5-3-3-4 4" /></svg>
  if (name === 'rocket') return <svg {...common}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>
  if (name === 'sparkle') return <svg {...common}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /></svg>
  if (name === 'gauge') return <svg {...common}><path d="M12 14l3-3" /><circle cx="12" cy="14" r="8" /><path d="M6.3 19.3A8 8 0 0 1 4 14" /></svg>
  if (name === 'check') return <svg {...common}><path d="M20 6L9 17l-5-5" /></svg>
  if (name === 'coin') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5c0-1.5 1.5-2 3-2s3 .8 3 2-1.5 1.8-3 2-3 .8-3 2 1.5 2 3 2 3-.5 3-2" /></svg>
  if (name === 'people') return <svg {...common}><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2 19c0-3 2.5-5 6-5s6 2 6 5M12 19c0-3 2.5-5 6-5s4 2 4 5" /></svg>
  if (name === 'target') return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
  if (name === 'trophy') return <svg {...common}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3a3 3 0 0 1-3 5M7 5H4a3 3 0 0 0 3 5" /></svg>
  return <svg {...common}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a6 6 0 0 0-4 10.5c.5.5.9 1.2 1 2.5h6c.1-1.3.5-2 1-2.5A6 6 0 0 0 12 2Z" /></svg>
}
