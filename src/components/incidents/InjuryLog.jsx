import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'

// ─── ACCIDENT BOOK ───────────────────────────────────────────
// The reading side of the injury log, ported from the Solidarity Sports hub.
//
// Ordered newest first, because the question being asked is almost always "what
// happened recently", and the two things that need chasing -- a parent who has
// not been told, and an open follow-up -- are visible without opening anything.
//
// RLS decides what comes back: an org admin sees every injury in their
// organisation, anyone else sees only the ones they logged. This screen does no
// filtering of its own, and must not start doing any: a list that looks
// complete but is quietly filtered in the client is worse than one that is
// obviously partial.

const card = { background: '#fff', border: '1px solid #E9EDF2', borderRadius: 14, padding: '13px 15px', marginBottom: 10 }
const flag = (bg, fg) => ({ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: bg, color: fg })

export default function InjuryLog({ org }) {
  const terms = useTerms()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: err } = await supabase
      .from('child_injuries')
      .select('*, child:children(first_name, last_name, group_name), session:sessions(title)')
      .order('occurred_at', { ascending: false })
      .limit(200)
    if (err) setError(err.message)
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, org?.id])

  const needsParent = rows.filter(r => !r.parent_notified)
  const needsFollowUp = rows.filter(r => r.follow_up_needed)
  const shown = filter === 'parent' ? needsParent : filter === 'follow_up' ? needsFollowUp : rows

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['all', `All (${rows.length})`], ['parent', `Parent not told (${needsParent.length})`],
          ['follow_up', `Follow-up open (${needsFollowUp.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            minHeight: 38, padding: '7px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
            border: `1.5px solid ${filter === k ? '#0F172A' : '#E2E8F0'}`,
            background: filter === k ? '#0F172A' : '#fff',
            color: filter === k ? '#fff' : '#64748B',
            fontSize: 12.5, fontWeight: 800,
          }}>{l}</button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FDEEEC', border: '1.5px solid #F3C2C2', color: '#8C2A20', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>{error}</div>
      )}

      {shown.length === 0 && (
        <div style={{ textAlign: 'center', padding: '34px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}><Icon name="🩹" /></div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>
            {filter === 'all' ? 'Nothing in the accident book yet.' : 'Nothing outstanding here.'}
          </div>
        </div>
      )}

      {shown.map(r => {
        const name = r.child ? `${r.child.first_name} ${r.child.last_name}` : `Unknown ${terms.person}`
        const isOpen = openId === r.id
        return (
          <div key={r.id} style={card}>
            <button onClick={() => setOpenId(isOpen ? null : r.id)} style={{
              width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <div style={{ fontSize: 14.5, fontWeight: 900, color: '#0F172A', flex: 1 }}>{name}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>
                  {format(new Date(r.occurred_at), 'd MMM yyyy, HH:mm')}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', lineHeight: 1.5, marginBottom: 7 }}>
                {isOpen ? r.what_happened : (r.what_happened || '').slice(0, 120) + ((r.what_happened || '').length > 120 ? '…' : '')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {r.injury_type && <span style={flag('#F1F5F9', '#64748B')}>{r.injury_type}</span>}
                {r.body_part && <span style={flag('#F1F5F9', '#64748B')}>{r.body_part}</span>}
                {r.sent_to_hospital && <span style={flag('#FDE7E7', '#A11')}>Hospital or doctor</span>}
                <span style={r.parent_notified ? flag('#E4F5E8', '#1B7A34') : flag('#FDE7E7', '#A11')}>
                  {r.parent_notified ? 'Parent told' : 'Parent not told'}
                </span>
                {r.follow_up_needed && <span style={flag('#FDF0D5', '#8A5A00')}>Follow-up open</span>}
              </div>
            </button>

            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E9EDF2', display: 'grid', gap: 9 }}>
                {[['Where', r.location], ['Session', r.session?.title],
                  ['First aid given', r.first_aid_given], ['Treated by', r.treated_by],
                  ['Anyone who saw it', r.witnesses],
                  ['Parent told how', r.parent_notified ? (r.parent_notified_method || 'Not recorded') : null],
                  ['Parent told when', r.parent_notified && r.parent_notified_at ? format(new Date(r.parent_notified_at), 'd MMM yyyy, HH:mm') : null],
                  ['Follow-up', r.follow_up_needed ? (r.follow_up_notes || 'No detail recorded') : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', lineHeight: 1.5 }}>{v}</div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                  Logged {format(new Date(r.created_at), 'd MMM yyyy, HH:mm')}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
