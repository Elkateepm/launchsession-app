import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { useTerms } from '../../context/OrgContext'
import { getOfficeBranding } from './officeBranding'
import OfficeIllustration from './OfficeIllustration'
import Icon from '../../lib/icons'

const COPY = {
  forms:            'Create forms and keep track of the replies.',
  newsletter:       'Keep families and your team in the loop.',
  hr:               'Look after your team, training and leave.',
  payments:         'Keep fees, invoices and payments organised.',
  resource_booking: 'Find a space, book equipment and plan ahead.',
  templates:        'Save time with ready-to-use emails and registers.',
}

const GROUPS = [
  { title: 'Connect & communicate', description: 'Good communication starts here.', keys: ['forms', 'newsletter', 'templates'] },
  { title: 'People & planning', description: 'The details that keep everything moving.', keys: ['hr', 'payments', 'resource_booking'] },
]

const actionStyle = {
  fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  borderRadius: 16, minHeight: 44, outlineOffset: 4,
}

function OfficeMark({ brand }) {
  const [failedLogo, setFailedLogo] = useState(null)
  return (
    <span style={{ width: 50, height: 50, borderRadius: 15, background: '#fff', border: '1px solid var(--office-border)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden', color: 'var(--office-deep)', fontSize: 21, fontWeight: 800 }}>
      {brand.logo && failedLogo !== brand.logo
        ? <img src={brand.logo} alt="" onError={() => setFailedLogo(brand.logo)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6, boxSizing: 'border-box' }} />
        : <span aria-hidden="true">{brand.name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

const startOfMonthISO = () => {
  // Europe/London, not UTC: between midnight and 1am BST a UTC month boundary
  // is still in last month and the figure would be wrong for an hour.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map(p => [p.type, p.value])
  )
  return `${parts.year}-${parts.month}-01T00:00:00Z`
}

/**
 * One count per card. Each is independent and allowed to fail: a card with no
 * number is a smaller problem than a screen that will not render because one
 * table was unreachable.
 */
async function loadCounts(orgId, tabs) {
  const want = new Set(tabs.map(t => t.tab))
  const out = {}

  const count = async (key, build) => {
    if (!want.has(key)) return
    try {
      const { count: n, error } = await build()
      if (!error && typeof n === 'number') out[key] = n
    } catch (e) { /* leave the card numberless */ }
  }

  await Promise.all([
    count('forms', () => supabase.from('org_forms')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true)),
    count('newsletter', () => supabase.from('newsletters')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'draft')),
    count('payments', () => supabase.from('payment_transactions')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', startOfMonthISO())),
    count('resource_booking', () => supabase.from('resource_bookings')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      .gte('start_time', new Date().toISOString()).neq('status', 'cancelled')),
    count('templates', () => supabase.from('templates')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true)),
  ])

  return out
}

// The sentence under each number. Singular/plural handled here rather than in
// the card, so the card stays a layout and nothing else.
export function statFor(key, counts, newResponses) {
  const n = counts[key]
  switch (key) {
    case 'forms':
      if (newResponses > 0) return { text: `${newResponses} new response${newResponses === 1 ? '' : 's'}`, urgent: true }
      if (n == null) return null
      return { text: n === 0 ? 'No live forms' : `${n} live form${n === 1 ? '' : 's'}` }
    case 'newsletter':
      if (n == null) return null
      return { text: n === 0 ? 'Nothing in draft' : `${n} draft${n === 1 ? '' : 's'}` }
    case 'payments':
      if (n == null) return null
      return { text: n === 0 ? 'Nothing this month' : `${n} this month` }
    case 'resource_booking':
      if (n == null) return null
      return { text: n === 0 ? 'Nothing booked' : `${n} upcoming` }
    case 'templates':
      if (n == null) return null
      return { text: n === 0 ? 'None yet' : `${n} ready to use` }
    case 'parent_portal':
      return { text: 'Coming soon', muted: true }
    default:
      return null
  }
}

export default function OfficeOverview({ org, tabs, onSelect, newResponses = 0 }) {
  const isMobile = useIsMobile()
  const isCompact = useIsMobile(1100)
  const dark = useIsDarkTheme()
  const terms = useTerms()
  const brand = getOfficeBranding(org, dark)
  const [snapshot, setSnapshot] = useState(null)
  const orgId = org?.id
  const tabKeys = JSON.stringify(tabs.map(t => t.tab))
  // Never display the previous organisation's counts, even during the render
  // before the new request starts. Permission changes also invalidate them.
  const loaded = !!orgId && snapshot?.orgId === orgId && snapshot?.tabKeys === tabKeys
  const counts = loaded ? snapshot.counts : {}

  useEffect(() => {
    let cancelled = false
    if (!orgId) return undefined
    loadCounts(orgId, JSON.parse(tabKeys).map(tab => ({ tab }))).then(result => {
      if (!cancelled) setSnapshot({ orgId, tabKeys, counts: result })
    })
    return () => { cancelled = true }
  }, [orgId, tabKeys])

  const canOpen = key => tabs.some(t => t.tab === key)
  const desk = [
    canOpen('forms') && newResponses > 0 && {
      tab: 'forms', icon: 'forms', number: newResponses,
      title: `New response${newResponses === 1 ? '' : 's'}`, action: 'Review replies', urgent: true,
    },
    canOpen('newsletter') && counts.newsletter > 0 && {
      tab: 'newsletter', icon: 'newsletter', number: counts.newsletter,
      title: `Newsletter draft${counts.newsletter === 1 ? '' : 's'}`, action: 'Continue writing',
    },
    canOpen('resource_booking') && counts.resource_booking > 0 && {
      tab: 'resource_booking', icon: 'resources', number: counts.resource_booking,
      title: `Upcoming booking${counts.resource_booking === 1 ? '' : 's'}`, action: 'View bookings',
    },
  ].filter(Boolean)
  const groups = GROUPS.map(group => ({ ...group, items: tabs.filter(t => group.keys.includes(t.tab)) })).filter(group => group.items.length)
  const otherTabs = tabs.filter(t => t.tab !== 'parent_portal' && !GROUPS.some(group => group.keys.includes(t.tab)))
  if (otherTabs.length) groups.push({ title: 'More tools', description: 'Everything else for your working day.', items: otherTabs })
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <div style={{ ...brand.style, width: '100%', maxWidth: 1440, margin: '0 auto', boxSizing: 'border-box', padding: isMobile ? '16px 12px 28px' : '22px 24px 36px' }}>
      <section aria-labelledby="office-welcome" style={{
        position: 'relative', overflow: 'hidden', borderRadius: isMobile ? 22 : 26,
        padding: isMobile ? 22 : '30px 34px', border: '1px solid var(--office-border)',
        background: 'radial-gradient(ellipse at 100% 0%, var(--office-glow), transparent 65%), linear-gradient(120deg, var(--surface), var(--office-tint))',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <OfficeMark brand={brand} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--office-ink)', fontSize: 10, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 5 }}>Your shared workspace</div>
              <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 800, overflowWrap: 'anywhere' }}>{brand.name}</div>
            </div>
          </div>
          <h1 id="office-welcome" style={{ margin: '0 0 10px', fontFamily: brand.font.display, fontSize: isMobile ? 30 : 38, lineHeight: 1.16, fontWeight: 800, letterSpacing: -1.3, color: 'var(--text)' }}>
            A little space to<br />make a big difference.
          </h1>
          <p style={{ margin: 0, maxWidth: 480, fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
            Welcome to your Office. Bring the everyday jobs together,<br style={{ display: isMobile ? 'none' : 'initial' }} /> and make more time for your {terms.people}.
          </p>
          <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', fontSize: 12, color: 'var(--text3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="calendar" size={14} />{date}</span>
            {brand.slogan && <span style={{ color: 'var(--office-ink)', overflowWrap: 'anywhere' }}>{brand.slogan}</span>}
          </div>
        </div>
        {!isCompact && <div style={{ width: '31%', maxWidth: 340, flexShrink: 0, paddingRight: 8 }}><OfficeIllustration /></div>}
      </section>

      <section aria-labelledby="office-desk" style={{ marginTop: 26, marginBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Icon name="today" size={17} style={{ color: 'var(--office-ink)' }} />
          <h2 id="office-desk" style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 800 }}>On your desk</h2>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>A place to pick things up</span>
        </div>
        {desk.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {desk.map(item => (
              <button key={item.tab} type="button" onClick={() => onSelect(item.tab)} style={{ ...actionStyle, padding: '17px 18px', display: 'flex', alignItems: 'center', gap: 13, borderColor: item.urgent ? 'var(--danger-border)' : 'var(--office-border)' }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 22, fontWeight: 800, color: item.urgent ? 'var(--danger-text)' : 'var(--office-ink)', background: item.urgent ? 'var(--danger-bg)' : 'var(--office-tint)' }}>{item.number}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 750, marginBottom: 5 }}>{item.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>{item.action}</span>
                </span>
                <Icon name="→" size={16} style={{ color: 'var(--office-ink)' }} />
              </button>
            ))}
          </div>
        ) : (
          <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 13, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, background: 'var(--office-tint)', color: 'var(--office-ink)', flexShrink: 0 }}><Icon name="☀️" size={20} /></span>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text3)' }}>
              <span style={{ display: 'block', color: 'var(--text)', fontWeight: 750 }}>{loaded ? 'Make yourself at home.' : 'Getting your desk ready…'}</span>
              Choose a tool below to get started. Replies, drafts and upcoming bookings appear here when available.
            </div>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: isCompact || groups.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 24 : 22 }}>
        {groups.map((group, groupIndex) => (
          <section key={group.title} aria-label={group.title} style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 13, paddingLeft: 2 }}>
              <h2 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 17, fontWeight: 800 }}>{group.title}</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text3)' }}>{group.description}</p>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {group.items.map(t => {
                const stat = statFor(t.tab, counts, t.tab === 'forms' ? newResponses : 0)
                return (
                  <button key={t.id} type="button" onClick={() => onSelect(t.tab)} style={{ ...actionStyle, width: '100%', padding: isMobile ? 16 : '19px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--office-border)'; e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', flexShrink: 0, background: groupIndex === 0 ? 'var(--office-tint)' : 'var(--office-secondary-tint)', color: groupIndex === 0 ? 'var(--office-ink)' : 'var(--office-secondary-ink)' }}><Icon name={t.icon} size={21} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 800, marginBottom: 5 }}>{t.label}</span>
                      <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text3)' }}>{COPY[t.tab] || 'Open your workspace tools.'}</span>
                      {stat && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11.5, fontWeight: 700, color: stat.urgent ? 'var(--danger-text)' : 'var(--office-ink)' }}>{stat.urgent && <Icon name="bell" size={12} />}{stat.text}</span>}
                    </span>
                    <Icon name="chevron" size={17} style={{ color: 'var(--text3)' }} />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {canOpen('parent_portal') && (
        <button type="button" onClick={() => onSelect('parent_portal')} style={{ ...actionStyle, width: '100%', marginTop: 24, padding: '17px 20px', background: 'transparent', borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 13 }}>
          <Icon name="parents" size={22} style={{ color: 'var(--office-ink)' }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--text)', fontWeight: 800, display: 'block' }}>Parent Portal <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--office-ink)', background: 'var(--office-tint)', padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>Coming soon</span></span>
            A closer connection with the families you support.
          </span>
          <Icon name="chevron" size={16} style={{ color: 'var(--text3)' }} />
        </button>
      )}
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text3)' }}>
        <Icon name="impact" size={15} /> Less admin. More time to make a difference.
      </div>
    </div>
  )
}
