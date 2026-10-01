import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import VPToday from './VPToday'
import Icon from '../../lib/icons'

// What a volunteer sees, shown to the people who run the organisation.
//
// Staff have no way to open the volunteer app: it lives on its own route,
// expects a volunteer profile, and refuses anyone whose role is anything else.
// So the one screen every volunteer lands on was never looked at by the people
// responsible for it — which is how it came to carry a locked trophy case
// above the announcement naming the safeguarding lead.
//
// This is a preview, not a session. It reads the organisation's real sessions
// and announcements so it shows what volunteers will actually see tonight, and
// it writes nothing: every action is inert and says so. Impersonating a
// volunteer for real would mean holding their session, which is not something
// an admin screen should be able to do.

export default function VolunteerPortalPreview({ org, primary }) {
  const isMobile = useIsMobile()
  const [sessions, setSessions] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [volunteer, setVolunteer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!org?.id) return
    let cancelled = false
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())

    Promise.all([
      supabase.from('sessions').select('*').eq('org_id', org.id).gte('session_date', today)
        .order('session_date').limit(10),
      supabase.from('announcements').select('*').eq('org_id', org.id)
        .order('created_at', { ascending: false }).limit(5),
      // A real volunteer if the organisation has one, so the greeting and the
      // DBS prompt reflect a genuine record rather than a placeholder.
      supabase.from('user_profiles').select('id, full_name, first_name, dbs_number')
        .eq('org_id', org.id).eq('role', 'volunteer').limit(1).maybeSingle(),
    ]).then(([s, a, v]) => {
      if (cancelled) return
      setSessions(s.data || [])
      setAnnouncements(a.data || [])
      setVolunteer(v.data || null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [org?.id])

  const inert = (what) => () => setNotice(`${what} is live for volunteers. This is a preview, so nothing was sent.`)

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
  const todaySessions = sessions.filter(s => s.session_date === todayStr)
  const futureSessions = sessions.filter(s => s.session_date > todayStr)

  const profile = volunteer || { full_name: 'A volunteer', first_name: 'there', dbs_number: null }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>What your volunteers see</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
            The home screen of the volunteer app, built from this organisation&rsquo;s real sessions and
            announcements. Nothing here sends or saves.
          </div>
        </div>
        <span style={{
          fontSize: 11.5, fontWeight: 800, padding: '5px 11px', borderRadius: 999, flexShrink: 0,
          background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)',
        }}>Preview</span>
      </div>

      {!loading && !volunteer && (
        <div style={{
          background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 12,
          padding: '11px 13px', fontSize: 13, color: 'var(--warn-text)', marginBottom: 14, lineHeight: 1.5,
        }}>
          No volunteer accounts yet, so this is shown with a placeholder name. Everything else is your real data.
        </div>
      )}

      {notice && (
        <div style={{
          background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 12,
          padding: '11px 13px', fontSize: 13, color: 'var(--info-text)', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1 }}>{notice}</span>
          <button onClick={() => setNotice('')} style={{
            border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer',
            fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
          }} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* A phone, so it reads as someone else's screen rather than part of this
          one. On a phone there is no room for the frame, so it is dropped. */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: 400,
          border: isMobile ? 'none' : '10px solid var(--text)',
          borderRadius: isMobile ? 14 : 36,
          overflow: 'hidden',
          background: 'var(--surface2)',
          boxShadow: isMobile ? 'none' : '0 18px 50px -20px rgba(15,23,42,0.45)',
        }}>
          {loading ? (
            <div style={{ padding: '70px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Loading the volunteer view…
            </div>
          ) : (
            <div style={{ maxHeight: isMobile ? 'none' : 620, overflowY: 'auto' }}>
              <VPToday
                org={org}
                profile={profile}
                todaySessions={todaySessions}
                futureSessions={futureSessions}
                announcements={announcements}
                primary={primary}
                onOpenSession={inert('Opening a session')}
                onNavigate={inert('Moving between tabs')}
                onRaiseConcern={inert('Reporting a concern')}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 14, textAlign: 'center', lineHeight: 1.6 }}>
        <Icon name="🛡️" /> Volunteers can report a concern from this screen without scrolling, on every
        session day.
      </div>
    </div>
  )
}
