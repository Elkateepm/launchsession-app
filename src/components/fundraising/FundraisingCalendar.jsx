import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format, isBefore } from 'date-fns'
import { LS, IconGlyph } from './fundraisingShared'
import FundraisingEmptyState from './hub/FundraisingEmptyState'

const TYPE_STYLE = {
  grant: { label: 'Grant deadline', color: '#92640C', bg: '#FDF6E8', icon: 'doc' },
  campaign: { label: 'Campaign ends', color: '#16803C', bg: '#E7F6EC', icon: 'rocket' },
  application: { label: 'Application target', color: LS.purpleDark, bg: LS.lavender, icon: 'target' },
}

export default function FundraisingCalendar({ org }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: savedGrants }, { data: campaigns }, { data: applications }] = await Promise.all([
      supabase.from('grant_saves').select('grant_id, grants(name, funder_name, deadline_type, deadline_date, website_url)').eq('org_id', org.id),
      supabase.from('fundraising_campaigns').select('id, name, end_date').eq('org_id', org.id).not('end_date', 'is', null),
      supabase.from('grant_applications').select('id, custom_name, target_date, stage, grants(name, funder_name)').eq('org_id', org.id).not('target_date', 'is', null),
    ])

    const evts = []
    ;(savedGrants || []).forEach(row => {
      const g = row.grants
      if (g?.deadline_type === 'fixed' && g.deadline_date) {
        evts.push({ type: 'grant', date: g.deadline_date, title: g.name, subtitle: g.funder_name })
      }
    })
    ;(campaigns || []).forEach(c => {
      evts.push({ type: 'campaign', date: c.end_date, title: c.name, subtitle: 'Campaign end date' })
    })
    ;(applications || []).forEach(a => {
      if (a.stage === 'submitted' || a.stage === 'awarded' || a.stage === 'declined') return
      evts.push({ type: 'application', date: a.target_date, title: a.grants?.name || a.custom_name || 'Application', subtitle: a.grants?.funder_name || 'Your target date' })
    })

    evts.sort((a, b) => new Date(a.date) - new Date(b.date))
    setEvents(evts)
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const { overdue, upcoming } = useMemo(() => {
    const now = new Date()
    const overdue = events.filter(e => isBefore(new Date(e.date), now))
    const upcoming = events.filter(e => !isBefore(new Date(e.date), now))
    return { overdue, upcoming }
  }, [events])

  const grouped = useMemo(() => {
    const groups = {}
    upcoming.forEach(e => {
      const key = format(new Date(e.date), 'MMMM yyyy')
      groups[key] = groups[key] || []
      groups[key].push(e)
    })
    return groups
  }, [upcoming])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: LS.muted }}>Loading…</div>

  if (events.length === 0) {
    return (
      <FundraisingEmptyState icon="clock" title="No deadlines tracked yet"
        subtitle="Save a grant with a fixed deadline, set a campaign end date, or add a target date to an application to see it here." />
    )
  }

  const now = new Date()
  return (
    <div>
      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', color: '#B91C1C', textTransform: 'uppercase', marginBottom: 10 }}>Overdue</div>
          <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16, padding: '4px 18px' }}>
            {overdue.map((e, i) => <EventRow key={i} e={e} last={i === overdue.length - 1} />)}
          </div>
        </div>
      )}
      {Object.entries(grouped).map(([month, evts]) => (
        <div key={month} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.05em', color: LS.muted, textTransform: 'uppercase', marginBottom: 10 }}>{month}</div>
          <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16, padding: '4px 18px' }}>
            {evts.map((e, i) => <EventRow key={i} e={e} now={now} last={i === evts.length - 1} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function EventRow({ e, now, last }) {
  const style = TYPE_STYLE[e.type]
  const daysLeft = now ? Math.ceil((new Date(e.date) - now) / (1000 * 60 * 60 * 24)) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${LS.border}` }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: style.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: style.color, lineHeight: 1 }}>{format(new Date(e.date), 'd')}</div>
        <div style={{ fontSize: 9, color: style.color, textTransform: 'uppercase', fontWeight: 700 }}>{format(new Date(e.date), 'MMM')}</div>
      </div>
      <div style={{ width: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconGlyph name={style.icon} color={style.color} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: LS.text }}>{e.title}</div>
        <div style={{ fontSize: 12, color: LS.muted, marginTop: 1 }}>{e.subtitle}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: style.color, background: style.bg, borderRadius: 20, padding: '3px 10px' }}>{style.label}</span>
        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && <div style={{ fontSize: 11, fontWeight: 700, color: '#B45309', marginTop: 4 }}>{daysLeft === 0 ? 'Today' : `${daysLeft}d left`}</div>}
        {daysLeft !== null && daysLeft < 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', marginTop: 4 }}>{Math.abs(daysLeft)}d overdue</div>}
      </div>
    </div>
  )
}
