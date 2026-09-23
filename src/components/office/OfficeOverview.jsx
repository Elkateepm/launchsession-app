// What you see when you open Office.
//
// Office used to drop you straight into Forms: the sidebar said Office, the
// header said Office, and you were looking at a form builder. There was no
// moment where Office was a place, which made the tab row read as six
// unrelated screens that happened to share a strip.
//
// So: one card per desk job, each answering "is there anything for me here?"
// before you click. The counts are the point -- a grid of six links with no
// numbers would be a worse menu, not a better one.
import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'

// What each card says when it has nothing to report, and how to describe the
// screen behind it. Descriptions name what is actually in there -- "Templates"
// alone is ambiguous in this app, since Forms has templates of its own.
const COPY = {
  forms:            { blurb: 'Build a form, send it out, read what comes back.' },
  newsletter:       { blurb: 'Write and send the round-up to parents and volunteers.' },
  payments:         { blurb: 'Fees, invoices and what has actually been paid.' },
  resource_booking: { blurb: 'Rooms, kit and vehicles — who has what, and when.' },
  templates:        { blurb: 'Reusable email and register templates.' },
  parent_portal:    { blurb: 'A window for parents into their child’s journey.' },
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
  const [counts, setCounts] = useState({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!org?.id) return undefined
    ;(async () => {
      const result = await loadCounts(org.id, tabs)
      if (cancelled) return
      setCounts(result)
      setLoaded(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, tabs.length])

  return (
    <div style={{ padding: isMobile ? '18px 12px 28px' : '22px 16px 32px' }}>
      <div style={{ marginBottom: isMobile ? 16 : 22 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: isMobile ? 22 : 26, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>
          Office
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text3)', maxWidth: 520 }}>
          The jobs that happen between sessions — paperwork, money, bookings and
          the words you send out.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(268px, 1fr))',
        gap: 12,
      }}>
        {tabs.map(t => {
          const stat = loaded || t.tab === 'parent_portal' ? statFor(t.tab, counts, t.tab === 'forms' ? newResponses : 0) : null
          const blurb = (COPY[t.tab] || {}).blurb
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.tab)}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 10, minHeight: 132,
                padding: '16px 16px 14px', borderRadius: 16,
                border: '1px solid var(--border)', background: 'var(--surface)',
                transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--org-a35)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 10px 26px -14px rgba(15,23,42,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--org-a10)', color: 'var(--org-primary, #6D5DF6)',
                }} aria-hidden="true"><Icon name={t.icon} /></span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t.label}</span>
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', flex: 1 }}>{blurb}</div>

              <div style={{ minHeight: 18, display: 'flex', alignItems: 'center', gap: 7 }}>
                {stat && (
                  <>
                    {stat.urgent && <span style={{ width: 7, height: 7, borderRadius: 99, background: '#DC2626', flexShrink: 0 }} />}
                    <span style={{
                      fontSize: 12.5, fontWeight: stat.urgent ? 800 : 600,
                      color: stat.urgent ? '#DC2626' : stat.muted ? 'var(--text3)' : 'var(--text2, #475569)',
                    }}>{stat.text}</span>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
