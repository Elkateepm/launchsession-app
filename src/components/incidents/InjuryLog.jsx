import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format, differenceInDays } from 'date-fns'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'

// ─── ACCIDENT BOOK ───────────────────────────────────────────
// The reading and chasing side of the injury log.
//
// The first version listed injuries and nothing else, which made it a record
// you could write to and never finish. An injury logged at five o'clock with
// "parent not told yet" -- the honest thing to record at the time -- stayed
// that way for ever, because there was no way to say they had since been told.
// Everything outstanding now leads somewhere.
//
// Ordering is by what still needs doing rather than by date: an insurer asks
// what happened, but a manager on Monday morning asks what is unfinished.
//
// RLS decides what comes back: an org admin sees every injury in the
// organisation, anyone else sees only the ones they logged. This screen does no
// filtering of its own and must not start: a list that looks complete but is
// quietly filtered in the client is worse than one that is obviously partial.

const NOTIFY_METHODS = ['In person at collection', 'Phone call', 'Text message', 'Email']

const card = { background: '#fff', border: '1px solid #E9EDF2', borderRadius: 14, padding: '13px 15px' }
const flag = (bg, fg) => ({ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: bg, color: fg })
const btn = (bg, fg, border) => ({
  minHeight: 38, padding: '0 13px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12, fontWeight: 800, background: bg, color: fg, border: border || 'none',
})

export default function InjuryLog({ org, session, isAdmin }) {
  const terms = useTerms()
  const myId = session?.user?.id
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('outstanding')
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notifyFor, setNotifyFor] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: err } = await supabase
      .from('child_injuries')
      .select('*, child:children(first_name, last_name, group_name), session:sessions(title, session_date)')
      .order('occurred_at', { ascending: false })
      .limit(300)
    if (err) setError(err.message)
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, org?.id])

  // Only the person who logged it or an org admin may change it, which is what
  // the policies allow. Offering a button that the database will refuse is
  // worse than not offering it.
  const canEdit = useCallback((r) => isAdmin || r.reported_by === myId, [isAdmin, myId])

  const outstanding = useMemo(
    () => rows.filter(r => !r.parent_notified || r.follow_up_needed), [rows])
  const hospital = useMemo(() => rows.filter(r => r.sent_to_hospital), [rows])

  const shown = useMemo(() => {
    const list = filter === 'outstanding' ? outstanding
      : filter === 'hospital' ? hospital
        : rows
    // What is unfinished first, then the most recent. Within that, a child who
    // went to hospital and whose parent has not been told outranks a graze.
    return [...list].sort((a, b) => {
      const score = (r) => (r.parent_notified ? 0 : 2) + (r.follow_up_needed ? 1 : 0)
      const d = score(b) - score(a)
      if (d) return d
      return new Date(b.occurred_at) - new Date(a.occurred_at)
    })
  }, [filter, rows, outstanding, hospital])

  const patch = async (row, values) => {
    setBusyId(row.id); setError('')
    const { error: err } = await supabase.from('child_injuries').update(values).eq('id', row.id)
    setBusyId(null)
    if (err) { setError(err.message); return false }
    await load()
    return true
  }

  const markParentTold = async (row, method) => {
    const ok = await patch(row, {
      parent_notified: true,
      parent_notified_at: new Date().toISOString(),
      parent_notified_by: myId || null,
      parent_notified_method: method || null,
    })
    if (ok) setNotifyFor(null)
  }

  const closeFollowUp = (row) => patch(row, { follow_up_needed: false })

  const FILTERS = [
    ['outstanding', `Needs doing (${outstanding.length})`],
    ['hospital', `Hospital or doctor (${hospital.length})`],
    ['all', `Everything (${rows.length})`],
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>Loading…</div>

  return (
    <div>
      {outstanding.length > 0 && (
        <div style={{
          background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: 12,
          padding: '11px 14px', marginBottom: 14, fontSize: 12.5, fontWeight: 700, color: '#92400E', lineHeight: 1.5,
        }}>
          <strong>{outstanding.length} {outstanding.length === 1 ? 'entry needs' : 'entries need'} finishing.</strong>{' '}
          {rows.filter(r => !r.parent_notified).length > 0 && `${rows.filter(r => !r.parent_notified).length} where a parent or carer has not been told. `}
          {rows.filter(r => r.follow_up_needed).length > 0 && `${rows.filter(r => r.follow_up_needed).length} with something still to do.`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTERS.map(([k, l]) => (
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
            {rows.length === 0 ? 'Nothing in the accident book yet.'
              : filter === 'outstanding' ? 'Everything is finished — parents told, follow-ups closed.'
                : 'Nothing here.'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(r => {
          const name = r.child ? `${r.child.first_name} ${r.child.last_name}` : `Unknown ${terms.person}`
          const isOpen = openId === r.id
          const editable = canEdit(r)
          const days = differenceInDays(new Date(), new Date(r.occurred_at))
          return (
            <div key={r.id} style={{
              ...card,
              borderLeft: `4px solid ${r.sent_to_hospital ? '#B91C1C' : !r.parent_notified ? '#D97706' : r.follow_up_needed ? '#B45309' : '#E9EDF2'}`,
            }}>
              <button onClick={() => setOpenId(isOpen ? null : r.id)} style={{
                width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: '#0F172A', flex: 1, minWidth: 120 }}>{name}</div>
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
                    {r.parent_notified ? 'Parent told' : `Parent not told${days > 0 ? ` · ${days}d` : ''}`}
                  </span>
                  {r.follow_up_needed && <span style={flag('#FDF0D5', '#8A5A00')}>Follow-up open</span>}
                  {r.session?.title && <span style={flag('#EEF2FF', '#4338CA')}>{r.session.title}</span>}
                </div>
              </button>

              {/* The two things that get left undone, actionable from the list
                  itself. Buried inside a detail view they stay undone. */}
              {editable && (!r.parent_notified || r.follow_up_needed) && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 11, paddingTop: 11, borderTop: '1px solid #F1F5F9' }}>
                  {!r.parent_notified && (
                    <button disabled={busyId === r.id} onClick={() => setNotifyFor(notifyFor === r.id ? null : r.id)}
                      style={btn('#166534', '#fff')}>
                      {busyId === r.id ? 'Saving…' : 'Parent has been told'}
                    </button>
                  )}
                  {r.follow_up_needed && (
                    <button disabled={busyId === r.id} onClick={() => closeFollowUp(r)}
                      style={btn('#fff', '#8A5A00', '1.5px solid #FDE68A')}>
                      Follow-up done
                    </button>
                  )}
                </div>
              )}

              {notifyFor === r.id && (
                <div style={{ marginTop: 10, padding: '11px 12px', background: '#F8FAFC', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                    How were they told?
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {NOTIFY_METHODS.map(m => (
                      <button key={m} onClick={() => markParentTold(r, m)} disabled={busyId === r.id}
                        style={btn('#fff', '#334155', '1.5px solid #E2E8F0')}>{m}</button>
                    ))}
                  </div>
                </div>
              )}

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
                    {!editable && ' · only the person who logged this or an admin can change it'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
