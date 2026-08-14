import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

// "What is happening right now" — deliberately thin.
//
// The sidebar redesign introduced this destination; building a full operational
// dashboard here would duplicate Home, the Live Register and the Risk
// Assessments overview, each of which already answers part of the question
// better than a summary could. This shows today's schedule and routes into
// those, and is structured so sections can be added without reshaping it.

const CARD = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 16 }

const londonToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

export default function Today({ org, onNavigate, terms }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const today = londonToday()
    const { data } = await supabase.from('sessions')
      .select('id, title, session_date, start_time, end_time, location, session_type')
      .eq('org_id', org.id).eq('session_date', today)
      .order('start_time')
    setSessions(data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const heading = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
  })

  return (
    <div style={{ padding: isMobile ? '16px 12px 80px' : '20px 24px', minHeight: '100%' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 23, fontWeight: 900, color: '#0F172A' }}>Today</div>
        <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 3 }}>{heading}</div>
      </div>

      {loading && (
        <div style={{ ...CARD, padding: 30, textAlign: 'center', color: '#8B87A3', fontSize: 14 }}>
          Loading…
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ ...CARD, padding: '38px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>☕</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
            Nothing scheduled today
          </div>
          <div style={{ fontSize: 13.5, color: '#8B87A3', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>
            When sessions are running you'll see them here, along with anything that needs attention.
          </div>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {sessions.map(s => (
            <div key={s.id} style={{ ...CARD, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A' }}>
                    {s.title || 'Session'}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
                    {(s.start_time || '').slice(0, 5)}
                    {s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}
                    {s.location ? ` · ${s.location}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.('registers')}
                  style={{
                    padding: '10px 16px', borderRadius: 11, border: 'none',
                    background: primary, color: '#fff', fontSize: 13.5, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    width: isMobile ? '100%' : 'auto',
                  }}
                >Open register</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 18, display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
      }}>
        {[
          ['📅', 'Calendar', 'calendar'],
          ['✅', 'Registers', 'registers'],
          ['⚠️', 'Risk Assessments', 'risk_assessments'],
        ].map(([icon, label, target]) => (
          <button
            key={target}
            onClick={() => onNavigate?.(target)}
            style={{
              ...CARD, padding: '15px 16px', textAlign: 'left', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 11,
            }}
          >
            <span style={{ fontSize: 19 }}>{icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
