import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format, isBefore, addDays } from 'date-fns'

const TYPE_STYLE = {
  grant: { label: 'Grant deadline', color: '#92640C', bg: '#FDF6E8' },
  campaign: { label: 'Campaign ends', color: '#16803C', bg: '#E7F6EC' },
  application: { label: 'Application target', color: '#374151', bg: '#F3F2EE' },
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
    const soonCutoff = addDays(now, 14)
    const overdue = events.filter(e => isBefore(new Date(e.date), now))
    const upcoming = events.filter(e => !isBefore(new Date(e.date), now))
    return { overdue, upcoming, soonCutoff }
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, border: '1.5px dashed #e5e7eb', borderRadius: 14, color: '#9CA3AF' }}>
        No deadlines tracked yet. Save a grant with a fixed deadline, set a campaign end date, or add a target date to an application to see it here.
      </div>
    )
  }

  const now = new Date()
  return (
    <div>
      {overdue.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#B91C1C', textTransform: 'uppercase', marginBottom: 8 }}>Overdue</div>
          {overdue.map((e, i) => <EventRow key={i} e={e} />)}
        </div>
      )}
      {Object.entries(grouped).map(([month, evts]) => (
        <div key={month} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>{month}</div>
          {evts.map((e, i) => <EventRow key={i} e={e} now={now} />)}
        </div>
      ))}
    </div>
  )
}

function EventRow({ e, now }) {
  const style = TYPE_STYLE[e.type]
  const daysLeft = now ? Math.ceil((new Date(e.date) - now) / (1000 * 60 * 60 * 24)) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '0.5px solid #e5e7eb' }}>
      <div style={{ width: 56, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#1C2333', lineHeight: 1 }}>{format(new Date(e.date), 'd')}</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{format(new Date(e.date), 'MMM')}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: '#1C2333' }}>{e.title}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF' }}>{e.subtitle}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: style.color, background: style.bg, borderRadius: 20, padding: '3px 9px' }}>{style.label}</span>
        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && <div style={{ fontSize: 11, color: '#B45309', marginTop: 3 }}>{daysLeft === 0 ? 'Today' : `${daysLeft}d left`}</div>}
      </div>
    </div>
  )
}
