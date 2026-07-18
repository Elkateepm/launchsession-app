import React from 'react'

// LaunchSession purple "space" identity, consistent with the Fundraising Hub redesign.
export const LS = {
  purple: '#7C5CFC',
  purpleDark: '#5B3DF0',
  purpleDeep: '#4B2FC4',
  gradient: 'linear-gradient(135deg, #8B6CFF 0%, #6647F0 100%)',
  heroGradient: 'linear-gradient(135deg, rgba(30,15,70,0.15) 0%, rgba(20,10,50,0.85) 100%)',
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

// Existing category taxonomy — kept exactly as-is so existing photos keep working.
export const CATEGORIES = [
  { key: 'All', label: 'All', icon: 'grid' },
  { key: 'Sessions', label: 'Sessions', icon: 'run' },
  { key: 'Trips', label: 'Trips', icon: 'bus' },
  { key: 'Milestones', label: 'Milestones', icon: 'star' },
  { key: 'Volunteers', label: 'Volunteers', icon: 'people' },
  { key: 'Celebrations', label: 'Celebrations', icon: 'party' },
  { key: 'Other', label: 'Other', icon: 'dots' },
]

// Accent colour per category — drives the category badge, "View Album" button and
// date-circle tinting on the redesigned Latest Memories timeline cards.
export const CATEGORY_COLORS = {
  Sessions:     { solid: '#7C5CFC', bg: '#F1EDFF', gradient: 'linear-gradient(135deg,#8B6CFF,#6647F0)' },
  Trips:        { solid: '#2F6FE0', bg: '#E9F0FA', gradient: 'linear-gradient(135deg,#4E9EFF,#2F6FE0)' },
  Milestones:   { solid: '#B45309', bg: '#FDF3E4', gradient: 'linear-gradient(135deg,#F2B84B,#D9860A)' },
  Volunteers:   { solid: '#EA580C', bg: '#FDECE1', gradient: 'linear-gradient(135deg,#FF9E6C,#E0692F)' },
  Celebrations: { solid: '#DB2777', bg: '#FCE7F0', gradient: 'linear-gradient(135deg,#F472B6,#DB2777)' },
  Other:        { solid: '#6B7280', bg: '#F3F2F7', gradient: 'linear-gradient(135deg,#9CA3AF,#6B7280)' },
}
export function categoryColor(category) { return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other }

export const CONSENT_META = {
  approved: { label: 'Approved to publish', color: '#16803C', bg: '#E7F6EC', icon: 'check' },
  internal_only: { label: 'Internal only', color: '#375A82', bg: '#E9F0F7', icon: 'lock' },
  consent_required: { label: 'Consent required', color: '#B45309', bg: '#FDF3E4', icon: 'alert' },
  do_not_publish: { label: 'Do not publish', color: '#B91C1C', bg: '#FCEAEA', icon: 'cross' },
  pending_review: { label: 'Pending review', color: '#6B7280', bg: '#F3F2F7', icon: 'clock' },
}

export function DAY_MS() { return 1000 * 60 * 60 * 24 }

export function timelineGroupLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Minimal inline icon set — no external icon font dependency.
export function IconGlyph({ name, color = 'currentColor', size = 16 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'camera': return <svg {...c}><path d="M4 8h3l2-3h6l2 3h3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" /><circle cx="12" cy="13" r="4" /></svg>
    case 'video': return <svg {...c}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3Z" /></svg>
    case 'calendar': return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
    case 'heart': return <svg {...c}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
    case 'heart-fill': return <svg {...c} fill={color}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
    case 'star': return <svg {...c}><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1L6.6 19l1.3-6-4.6-4.1 6.1-.6L12 3Z" /></svg>
    case 'people': return <svg {...c}><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2 19c0-3 2.5-5 6-5s6 2 6 5M12 19c0-3 2.5-5 6-5s4 2 4 5" /></svg>
    case 'run': return <svg {...c}><circle cx="14" cy="5" r="2" /><path d="M9 21l2-6 3 2 3 5M6 13l3-3 3 1 3-4" /></svg>
    case 'bus': return <svg {...c}><rect x="3" y="5" width="18" height="12" rx="2" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="16.5" cy="19" r="1.5" /><path d="M3 11h18" /></svg>
    case 'party': return <svg {...c}><path d="M4 21l4-13 13 4-13 9Z" /><path d="M14 3l1 3M19 6l2 2M9 2l1 2" /></svg>
    case 'dots': return <svg {...c}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
    case 'grid': return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
    case 'filter': return <svg {...c}><path d="M4 5h16M7 12h10M10 19h4" /></svg>
    case 'check': return <svg {...c}><path d="M20 6L9 17l-5-5" /></svg>
    case 'lock': return <svg {...c}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
    case 'alert': return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    case 'cross': return <svg {...c}><path d="M18 6L6 18M6 6l12 12" /></svg>
    case 'clock': return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
    case 'plus': return <svg {...c}><path d="M12 5v14M5 12h14" /></svg>
    case 'search': return <svg {...c}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
    case 'download': return <svg {...c}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
    case 'share': return <svg {...c}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" /></svg>
    case 'tag': return <svg {...c}><path d="M20.6 12.6 12 21.2 2.8 12 2 3l9 .8 8.6 8.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
    case 'trash': return <svg {...c}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6" /></svg>
    case 'chevron-left': return <svg {...c}><path d="M15 18l-6-6 6-6" /></svg>
    case 'chevron-right': return <svg {...c}><path d="M9 18l6-6-6-6" /></svg>
    case 'close': return <svg {...c}><path d="M18 6L6 18M6 6l12 12" /></svg>
    case 'sparkle': return <svg {...c}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /></svg>
    case 'move': return <svg {...c}><path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3" /><path d="M2 12h20M12 2v20" /></svg>
    case 'archive': return <svg {...c}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" /></svg>
    case 'edit': return <svg {...c}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
    default: return null
  }
}

export function ConsentBadge({ status, size = 'sm' }) {
  const meta = CONSENT_META[status] || CONSENT_META.pending_review
  const pad = size === 'sm' ? '3px 8px' : '5px 12px'
  const fontSize = size === 'sm' ? 10 : 12
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize, fontWeight: 700,
      color: meta.color, background: meta.bg, borderRadius: 20, padding: pad, whiteSpace: 'nowrap',
    }}>
      <IconGlyph name={meta.icon} color={meta.color} size={size === 'sm' ? 10 : 12} /> {meta.label}
    </span>
  )
}

