import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { getOfficeBranding } from './officeBranding'
import Icon from '../../lib/icons'
import OrgPageHero, { orgBrand, heroButtons } from '../shared/OrgPageHero'
import { useHrAttention } from '../../lib/hrAccess'
import { buildNeeds, monthTiles, recentActivity, relative } from './officeHub'

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

/**
 * The rows behind "Needs you", "This month" and "Recent". Same rules as the
 * counts: only tools this person can open are queried, and each query may
 * fail on its own, leaving its part of the page out rather than showing 0.
 */
async function loadHub(orgId, tabs) {
  const want = new Set(tabs)
  const monthStart = startOfMonthISO()
  const now = new Date()
  const d = {}
  const get = async (key, tab, build, pick = r => r.data) => {
    if (!want.has(tab)) return
    try {
      const r = await build()
      if (!r.error) d[key] = pick(r)
    } catch (e) { /* that part of the hub stays out */ }
  }
  await Promise.all([
    get('forms', 'forms', () => supabase.from('org_forms').select('id, name, closing_date').eq('org_id', orgId).eq('is_active', true)),
    get('repliesThisMonth', 'forms', () => supabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', monthStart), r => r.count),
    get('recentReplies', 'forms', () => supabase.from('form_submissions').select('id, created_at, submitted_name, org_forms(name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5)),
    get('newsletters', 'newsletter', () => supabase.from('newsletters').select('id, subject, status, sent_at, sent_count, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(30)),
    get('charges', 'payments', () => supabase.from('payment_charge_balances').select('id, due_date, remaining, computed_status').eq('org_id', orgId).in('computed_status', ['unpaid', 'part_paid'])),
    get('transactions', 'payments', () => supabase.from('payment_transactions').select('id, amount, payment_date, created_at').eq('org_id', orgId).gte('created_at', monthStart).order('created_at', { ascending: false }).limit(200)),
    get('bookings', 'resource_booking', () => supabase.from('resource_bookings').select('id, resource_id, start_time, status').eq('org_id', orgId).gte('start_time', new Date(now.getTime() - 86400000).toISOString()).order('start_time').limit(200)),
    get('recentBookings', 'resource_booking', () => supabase.from('resource_bookings').select('id, resource_id, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5)),
    get('checkouts', 'resource_booking', () => supabase.from('resource_checkouts').select('id, expected_return_at, returned_at').eq('org_id', orgId).is('returned_at', null)),
    get('resources', 'resource_booking', () => supabase.from('resources').select('id, name').eq('org_id', orgId)),
  ])
  return d
}

const TONE = {
  urgent: { ink: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)', label: 'Now' },
  soon: { ink: 'var(--warn-text)', bg: 'var(--warn-bg)', border: 'var(--warn-border)', label: 'This week' },
  later: { ink: 'var(--office-ink)', bg: 'var(--office-tint)', border: 'var(--office-border)', label: 'When you can' },
}

const ICONS = { forms: 'forms', newsletter: 'newsletter', payments: 'payments', resources: 'resources', hr: 'hr' }

function SectionTitle({ id, title, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <h2 id={id} style={{ margin: 0, color: 'var(--text)', fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {hint && <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{hint}</span>}
    </div>
  )
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

export default function OfficeOverview({ org, tabs, onSelect, newResponses = 0, unread = [], userRole }) {
  const isMobile = useIsMobile()
  const isCompact = useIsMobile(1100)
  const dark = useIsDarkTheme()
  const brand = getOfficeBranding(org, dark)
  const [snapshot, setSnapshot] = useState(null)
  const orgId = org?.id
  const tabKeys = JSON.stringify(tabs.map(t => t.tab))
  // Never display the previous organisation's counts, even during the render
  // before the new request starts. Permission changes also invalidate them.
  const loaded = !!orgId && snapshot?.orgId === orgId && snapshot?.tabKeys === tabKeys
  const counts = loaded ? snapshot.counts : {}
  const [hubSnap, setHubSnap] = useState(null)
  const hubLoaded = !!orgId && hubSnap?.orgId === orgId && hubSnap?.tabKeys === tabKeys
  const hub = hubLoaded ? hubSnap.data : {}
  const hr = useHrAttention(orgId, userRole)

  useEffect(() => {
    let cancelled = false
    if (!orgId) return undefined
    loadCounts(orgId, JSON.parse(tabKeys).map(tab => ({ tab }))).then(result => {
      if (!cancelled) setSnapshot({ orgId, tabKeys, counts: result })
    })
    loadHub(orgId, JSON.parse(tabKeys)).then(data => {
      if (!cancelled) setHubSnap({ orgId, tabKeys, data })
    })
    return () => { cancelled = true }
  }, [orgId, tabKeys])

  const canOpen = key => tabs.some(t => t.tab === key)
  const groups = GROUPS.map(group => ({ ...group, items: tabs.filter(t => group.keys.includes(t.tab)) })).filter(group => group.items.length)
  const otherTabs = tabs.filter(t => t.tab !== 'parent_portal' && !GROUPS.some(group => group.keys.includes(t.tab)))
  if (otherTabs.length) groups.push({ title: 'More tools', description: 'Everything else for your working day.', items: otherTabs })

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
  // Unread replies come from the dashboard (the bell uses the same list), so
  // they show before the rest of the hub has loaded.
  const needs = buildNeeds({ ...hub, unread: unread.length ? unread : Array.from({ length: newResponses }, () => ({ created_at: new Date().toISOString() })), hr: hr.canView ? hr : null }, { tabs, today })
  const tiles = hubLoaded ? monthTiles(hub, { tabs, monthStart: startOfMonthISO(), today }) : []
  const resourceNames = Object.fromEntries((hub.resources || []).map(r => [r.id, r.name]))
  const recent = hubLoaded ? recentActivity(hub, { tabs, resourceNames }) : []
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', month: 'long' }).format(new Date())
  const heroBase = { minHeight: 46, padding: '0 16px', borderRadius: 13, border: '1.5px solid transparent', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }
  const onHero = heroButtons(orgBrand(org), heroBase)
  const shortcuts = [
    canOpen('newsletter') && { tab: 'newsletter', label: 'Write a newsletter', icon: 'newsletter' },
    canOpen('forms') && { tab: 'forms', label: 'Forms', icon: 'forms' },
    canOpen('payments') && { tab: 'payments', label: 'Payments', icon: 'payments' },
    canOpen('resource_booking') && { tab: 'resource_booking', label: 'Book something', icon: 'resources' },
  ].filter(Boolean).slice(0, 3)
  const urgentCount = needs.filter(n => n.tone !== 'later').length

  return (
    <div style={{ ...brand.style, width: '100%', boxSizing: 'border-box', padding: isMobile ? '14px 12px 28px' : '20px 24px 36px' }}>
      {/* The organisation's banner, as on every other page. */}
      <OrgPageHero org={org} mobile={isMobile} title="Office"
        subtitle={`Forms, newsletters, ${canOpen('hr') ? 'HR, ' : ''}payments and bookings. What needs doing, and every tool one tap away.`}
        label={needs.length ? 'Needs you' : 'All clear'}
        detail={needs.length ? (urgentCount ? `${urgentCount} to do this week` : `${needs.length} when you can`) : 'Nothing waiting'}
        actions={shortcuts.length > 0 && <>
          {shortcuts.map((sc, i) => (
            <button key={sc.tab} type="button" onClick={() => onSelect(sc.tab)} style={{ ...(i === 0 ? onHero.main : onHero.quiet), flex: isMobile ? (i === 0 ? '1 1 100%' : 1) : undefined }}>
              <Icon name={sc.icon} size={16} /> {sc.label}
            </button>
          ))}
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: isMobile ? 22 : 20, marginTop: 22, alignItems: 'start' }}>
        <section aria-labelledby="office-needs" style={{ minWidth: 0 }}>
          <SectionTitle id="office-needs" title="Needs you" hint={needs.length ? 'Most urgent first' : null} />
          {needs.length === 0 ? (
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 13, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: 'var(--ok-bg)', color: 'var(--ok-text)', flexShrink: 0 }}><Icon name="check" size={20} /></span>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text3)' }}>
                <span style={{ display: 'block', color: 'var(--text)', fontWeight: 800 }}>{hubLoaded ? 'Nothing waiting on you.' : 'Checking your tools…'}</span>
                New replies, money owed, late returns, approvals and HR tasks show up here.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {needs.map(n => {
                const tone = TONE[n.tone]
                return (
                  <button key={n.key} type="button" onClick={() => onSelect(n.tab)} aria-label={`${n.title}. ${n.action}`}
                    style={{ ...actionStyle, width: '100%', padding: isMobile ? 14 : '15px 18px', display: 'flex', alignItems: 'center', gap: 14, borderColor: n.tone === 'later' ? 'var(--border)' : tone.border, borderLeft: `4px solid ${tone.ink}` }}>
                    <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0, background: tone.bg, color: tone.ink }}><Icon name={ICONS[n.icon] || n.icon} size={20} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800 }}>{n.title}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: tone.ink, background: tone.bg, borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>{tone.label}</span>
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 }}>{n.detail}</span>
                    </span>
                    {!isMobile && <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--org-ink)', whiteSpace: 'nowrap' }}>{n.action}</span>}
                    <Icon name="chevron" size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="office-month" style={{ minWidth: 0 }}>
          <SectionTitle id="office-month" title={`This month`} hint={month} />
          {tiles.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {tiles.map(t => (
                <button key={t.key} type="button" onClick={() => onSelect(t.tab)} style={{ ...actionStyle, padding: '14px 15px', display: 'block', minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--office-ink)', fontSize: 12, fontWeight: 800 }}><Icon name={ICONS[t.icon] || t.icon} size={15} />{t.label}</span>
                  <span style={{ display: 'block', fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 8, letterSpacing: -0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.value}</span>
                  {t.hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{t.hint}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px 18px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text3)' }}>{hubLoaded ? 'Numbers appear here once your tools are in use.' : 'Adding up this month…'}</div>
          )}

          {recent.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <SectionTitle title="Recent" />
              <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
                {recent.map((r, i) => (
                  <button key={`${r.tab}-${r.at}-${i}`} type="button" onClick={() => onSelect(r.tab)} style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', border: 'none', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <span style={{ color: 'var(--office-ink)', display: 'flex', flexShrink: 0 }}><Icon name={ICONS[r.icon] || r.icon} size={16} /></span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{relative(r.at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div style={{ marginTop: 28, marginBottom: 12 }}>
        <SectionTitle title="Your tools" hint="Every Office tool, with what is in it" />
      </div>
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
