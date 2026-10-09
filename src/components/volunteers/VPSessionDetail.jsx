import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { activityTheme } from './vp_shared'
import { orgBrand } from '../shared/OrgPageHero'
import { sessionPhase } from '../../lib/sessionPhase'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'

// One session, for a volunteer: when, where, who else is on the team, and
// booking. On the day, "Open register" opens the same live register the staff
// use (in its volunteer mode), where the volunteer's hours tick on the Team
// tab. It used to open a cut-down copy of the register that showed no
// allergies and recorded nothing in the audit trail.

const hhmm = t => String(t || '').slice(0, 5)

export default function VPSessionDetail({ session, org, booking, volunteerCount = 0, saving, onBook, onClose, onNavigateTab, onOpenRegister }) {
  const brand = orgBrand(org)
  const theme = activityTheme(session.session_type)
  const phase = sessionPhase(session)
  const [team, setTeam] = useState([])

  useEffect(() => {
    supabase.from('session_staff').select('id, role, user_profiles(full_name)').eq('session_id', session.id)
      .then(({ data }) => setTeam(data || []))
  }, [session.id])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const names = team.map(t => t.user_profiles?.full_name).filter(Boolean)
  const limit = session.volunteer_limit || null
  const full = !booking && limit && volunteerCount >= limit
  const onTheDay = phase === 'live' || (phase === 'upcoming' && session.register_opened_at)

  const row = (icon, label, value) => value ? (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span aria-hidden="true" style={{ fontSize: 17, width: 24, textAlign: 'center' }}><Icon name={icon} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)' }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 2, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{value}</div>
      </div>
    </div>
  ) : null

  const btn = { minHeight: 48, borderRadius: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', boxSizing: 'border-box' }

  return (
    <motion.div role="dialog" aria-modal="true" aria-label={session.title}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      style={{ position: 'absolute', inset: 0, background: 'var(--surface2)', zIndex: 600, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ background: brand.hero, padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 20px', color: '#fff', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', width: 240, height: 240, right: -100, top: -120, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, '99')}` }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ minHeight: 44, padding: '0 14px 0 10px', borderRadius: 12, background: '#ffffff1f', border: '1px solid #ffffff40', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name="←" /> Back
          </button>
          {phase === 'live' && <span style={{ background: '#fff', color: '#15803D', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 900 }}>● Live now</span>}
        </div>
        <div style={{ position: 'relative', marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffffd9' }}><Icon name={theme.icon} /> {theme.label}</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, lineHeight: 1.15 }}>{session.title}</h2>
          <div style={{ fontSize: 14, color: '#ffffffe6', marginTop: 6 }}>
            {new Date(`${session.session_date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {hhmm(session.start_time)}{session.end_time ? `–${hhmm(session.end_time)}` : ''}
          </div>
        </div>
      </div>

      <div className="ls-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 24px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2px 16px', marginTop: 10 }}>
          {row('📍', 'Where', session.location)}
          {row('👥', 'Team', names.length ? names.join(', ') : 'No one yet')}
          {row('🙋', 'Volunteer places', limit ? `${Math.max(0, limit - volunteerCount)} of ${limit} left` : null)}
          {row('📝', 'About this session', session.description)}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {booking && onTheDay && (
            <button onClick={onOpenRegister} style={{ ...btn, border: 'none', background: 'var(--org-primary, #1B9AAA)', color: 'var(--org-on-primary, #fff)' }}>
              <Icon name="📖" /> Open register
            </button>
          )}
          {!booking?.signed_in_at && phase !== 'completed' && (
            <button onClick={onBook} disabled={saving || full}
              style={{ ...btn, border: booking ? '1.5px solid var(--border)' : 'none', background: booking ? 'var(--surface)' : full ? 'var(--surface)' : 'var(--org-primary, #1B9AAA)', color: booking ? 'var(--text2)' : full ? 'var(--text-faint)' : 'var(--org-on-primary, #fff)' }}>
              {saving ? 'Saving…' : booking ? 'Cancel my booking' : full ? 'Volunteer places full' : 'Book onto this session'}
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: session.location ? '1fr 1fr' : '1fr', gap: 10 }}>
            {session.location && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(session.location)}`} target="_blank" rel="noreferrer"
                style={{ ...btn, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}><Icon name="🧭" /> Directions</a>
            )}
            <button onClick={() => onNavigateTab('messages')} style={{ ...btn, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}><Icon name="💬" /> Message the team</button>
          </div>
          <a href="tel:999" style={{ ...btn, border: '1.5px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}><Icon name="📞" /> Emergency: call 999</a>
        </div>
      </div>
    </motion.div>
  )
}
