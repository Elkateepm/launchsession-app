import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ukDate } from '../../lib/hrAccess'

// Onboarding: the bridge between an approved account and a working staff
// record.
//
// The checklist is generated from the person's employment type rather than
// being one fixed list, because a volunteer does not sign a contract and a
// sessional worker rarely has a probation period. Offering those as unticked
// work is how a checklist teaches people to ignore it.
//
// Where an item has a real home elsewhere in HR -- DBS, references,
// safeguarding training, probation dates -- ticking it here is a note that the
// task is done, not the record of it. The record lives in Compliance,
// Training or Employment, and this says so rather than pretending to be the
// system of record for everything.

const card = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
  padding: 16, marginBottom: 12,
}

// Which tab actually owns each item, so a half-finished checklist points
// somewhere useful instead of being a dead tick-box.
const OWNED_BY = {
  dbs: ['compliance', 'Recorded in Compliance'],
  references: ['compliance', 'Recorded in Compliance'],
  right_to_work: ['compliance', 'Recorded in Compliance'],
  code_of_conduct: ['compliance', 'Recorded in Compliance'],
  policies: ['compliance', 'Recorded in Compliance'],
  emergency_contact: ['compliance', 'Recorded in Compliance'],
  safeguarding: ['training', 'Booked in Training'],
  role_training: ['training', 'Booked in Training'],
  contract_signed: ['documents', 'Filed in Documents'],
  job_description: ['documents', 'Filed in Documents'],
  probation_dates: ['employment', 'Set in Employment'],
}

export default function StaffOnboarding({ org, staff, primary, canEdit, onJumpToTab }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('staff_onboarding_items')
      .select('*').eq('staff_id', staff.id).order('sort_order')
    if (e) { setError(e.message); setItems([]); return }
    setItems(data || [])
  }, [staff.id])

  useEffect(() => { load() }, [load])

  const seed = async () => {
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('hr_seed_onboarding', { p_staff_id: staff.id })
    setBusy(false)
    if (e) { setError(e.message); return }
    load()
  }

  const toggle = async (item) => {
    setBusy(true); setError('')
    const now = !item.completed
    const { data: me } = await supabase.auth.getUser()
    const { error: e } = await supabase.from('staff_onboarding_items').update({
      completed: now,
      completed_at: now ? new Date().toISOString() : null,
      completed_by: now ? (me?.user?.id || null) : null,
    }).eq('id', item.id)
    setBusy(false)
    if (e) { setError(e.message); return }
    // Optimistic locally, then reload -- the progress bar should not lag a tap.
    setItems(list => list.map(i => i.id === item.id ? { ...i, completed: now } : i))
    load()
  }

  if (items === null) {
    return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading onboarding…</div>
  }

  if (items.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
          No onboarding checklist yet
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.55, marginBottom: 16 }}>
          Build one from {staff.full_name}&apos;s employment type
          {staff.employment_type ? ` (${staff.employment_type})` : ''}. A volunteer gets a
          shorter list than an employee — no contract, no Right to Work check.
        </div>
        {error && <div style={{ fontSize: 13, color: '#B42318', marginBottom: 12 }}>{error}</div>}
        {canEdit && (
          <button onClick={seed} disabled={busy} style={{
            minHeight: 46, padding: '0 20px', borderRadius: 12, border: 'none',
            background: primary, color: '#fff', fontSize: 14.5, fontWeight: 800,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>{busy ? 'Setting up…' : 'Start onboarding'}</button>
        )}
      </div>
    )
  }

  const done = items.filter(i => i.completed).length
  const requiredLeft = items.filter(i => i.required && !i.completed).length
  const percent = Math.round((done / items.length) * 100)
  const complete = requiredLeft === 0

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#0F172A', letterSpacing: -1 }}>{percent}%</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>{done} of {items.length} done</div>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
          <div style={{
            width: `${percent}%`, height: '100%', borderRadius: 99,
            background: complete ? '#22C55E' : primary, transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ fontSize: 12.5, color: complete ? '#04713C' : '#64748B', marginTop: 10, fontWeight: complete ? 700 : 400 }}>
          {complete
            ? 'Everything required is done. Compliance and probation take it from here.'
            : `${requiredLeft} required item${requiredLeft === 1 ? '' : 's'} still to do`}
        </div>
      </div>

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={card}>
        {items.map(i => {
          const owner = OWNED_BY[i.item_key]
          return (
            <div key={i.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 11,
              padding: '10px 0', borderTop: '1px solid #F1F5F9',
            }}>
              <input
                type="checkbox" checked={i.completed} disabled={!canEdit || busy}
                onChange={() => toggle(i)}
                style={{ width: 19, height: 19, accentColor: primary, flexShrink: 0, marginTop: 2, cursor: canEdit ? 'pointer' : 'default' }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: i.completed ? '#94A3B8' : '#0F172A',
                  textDecoration: i.completed ? 'line-through' : 'none',
                }}>
                  {i.label}
                  {!i.required && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginLeft: 8 }}>optional</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                  {i.completed && i.completed_at ? `Done ${ukDate(i.completed_at)}` : owner ? owner[1] : 'Tracked here'}
                </div>
              </div>
              {owner && onJumpToTab && (
                <button onClick={() => onJumpToTab(owner[0])} style={{
                  border: '1px solid #E2E8F0', background: '#fff', borderRadius: 9,
                  padding: '6px 10px', minHeight: 40, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, color: '#64748B', flexShrink: 0, whiteSpace: 'nowrap',
                }}>Open</button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
