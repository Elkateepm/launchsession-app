import React, { useCallback, useEffect, useRef, useState } from 'react'
import OverlayPortal from '../shared/OverlayPortal'
import { supabase } from '../../lib/supabase'
import { useTerms } from '../../context/OrgContext'

export const attendanceToResolve = rows => ({
  onsite: rows.filter(row => row.status === 'signed_in').length,
  unmarked: rows.filter(row => !['signed_in', 'signed_out', 'absent'].includes(row.status)).length,
})

const button = { minHeight: 44, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border, #E5E7EB)', background: 'var(--surface, #fff)', color: 'var(--text, #111827)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

// All entry points use the same finish check. Read attendance again at the
// point of closing; the list that opened this dialog may be stale.
export default function EndSessionFlow({ session, org, authUserId, canCloseRegister, onClose, onReview, onClosed, onReflect }) {
  const terms = useTerms()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState(null)
  const [confirmAbsent, setConfirmAbsent] = useState(false)
  const working = useRef(false)
  const panel = useRef(null)
  const summary = attendanceToResolve(rows || [])

  const readAttendance = useCallback(async () => {
    const { data, error: readError } = await supabase.from('attendance').select('id, status')
      .eq('org_id', org.id).eq('session_id', session.id)
    if (readError) throw new Error('Could not check attendance. Please retry before closing.')
    setRows(data || [])
    return data || []
  }, [org.id, session.id])

  useEffect(() => { readAttendance().catch(e => setError(e.message)) }, [readAttendance])
  useEffect(() => {
    const previous = document.activeElement
    panel.current?.focus()
    return () => previous?.focus?.()
  }, [])

  const run = async action => {
    if (working.current || !canCloseRegister) return
    working.current = true
    setBusy(true)
    setError('')
    try { await action() } catch (e) { setError(e.message || 'Could not save. Please try again.') }
    finally { working.current = false; setBusy(false) }
  }

  const markAbsent = () => run(async () => {
    if (!confirmAbsent) return
    // Only change unresolved rows. Another device may have signed someone in.
    const fresh = await readAttendance()
    const ids = fresh.filter(row => !['signed_in', 'signed_out', 'absent'].includes(row.status)).map(row => row.id)
    if (ids.length) {
      const { error: saveError } = await supabase.from('attendance')
        .update({ status: 'absent', absence_reason: 'No reason provided' })
        .eq('org_id', org.id).eq('session_id', session.id).in('id', ids)
        .or('status.is.null,status.eq.expected')
      if (saveError) throw new Error('Absences could not be saved. Review attendance and retry.')
    }
    setConfirmAbsent(false)
    await readAttendance()
  })

  const finish = () => run(async () => {
    const fresh = attendanceToResolve(await readAttendance())
    if (fresh.onsite || fresh.unmarked) throw new Error('Attendance needs attention. Resolve the items below before closing.')
    const { data, error: saveError } = await supabase.from('sessions')
      .update({ closed_at: new Date().toISOString(), closed_by: authUserId, register_status: 'closed' })
      .eq('org_id', org.id).eq('id', session.id).is('closed_at', null).select('*').single()
    if (saveError || !data) throw new Error('The register could not be closed. It may have changed on another device. Return to the register and retry.')
    setClosed(data)
  })

  const dismiss = () => { if (!working.current) { if (closed) onClosed(closed); else onClose() } }
  const keyDown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); dismiss() }
    if (e.key !== 'Tab') return
    const items = panel.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')
    if (!items?.length) { e.preventDefault(); return }
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return <OverlayPortal><div onClick={dismiss} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 10400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="finish-title" aria-busy={busy} onKeyDown={keyDown} onClick={e => e.stopPropagation()}
      style={{ background: 'var(--surface, #fff)', color: 'var(--text, #111827)', borderRadius: 20, padding: 24, width: 460, maxWidth: '100%', boxSizing: 'border-box', maxHeight: '85dvh', overflowY: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--org-primary, #2563EB)', letterSpacing: 1 }}>ATTENDANCE → CLOSE → REFLECT</div>
      <h2 id="finish-title" style={{ fontSize: 21, margin: '10px 0 6px' }}>{closed ? `${terms.Session} closed` : `Finish ${terms.session}`}</h2>
      <p style={{ color: 'var(--text2, #64748B)', marginTop: 0 }}>{session.title}</p>
      {error && <p role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', padding: 12, borderRadius: 10 }}>{error}</p>}
      {closed ? <>
        <p role="status">Attendance is saved and the register is closed.</p>
        <p style={{ color: 'var(--text2, #64748B)', lineHeight: 1.6 }}>Capture outcomes and follow-up actions while they are fresh. You can also return to the reflection from the planner.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onReflect && <button style={{ ...button, background: 'var(--org-primary, #2563EB)', color: 'var(--org-on-primary, #fff)' }} onClick={() => { onClosed(closed); onReflect(session.id) }}>Continue to reflection →</button>}
          <button style={button} onClick={dismiss}>Done for now</button>
        </div>
      </> : <>
        <p style={{ lineHeight: 1.6, color: 'var(--text2, #64748B)' }}>Check departures and absences, then close the register. Reflection comes next.</p>
        {rows === null ? <p role="status">{error ? 'Attendance has not been verified.' : 'Checking attendance…'}</p> : <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <button disabled={busy} style={{ ...button, textAlign: 'left' }} onClick={() => onReview('signed_in')}>
            {summary.onsite ? `${summary.onsite} still on site — record departures →` : '✓ Everyone has left or is marked absent'}
          </button>
          <button disabled={busy} style={{ ...button, textAlign: 'left' }} onClick={() => onReview('expected')}>
            {summary.unmarked ? `${summary.unmarked} unmarked — review attendance →` : '✓ All attendance accounted for'}
          </button>
          {summary.unmarked > 0 && canCloseRegister && <>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: 13, lineHeight: 1.5 }}>
              <input type="checkbox" checked={confirmAbsent} disabled={busy} onChange={e => setConfirmAbsent(e.target.checked)} />
              I have checked that all remaining unmarked {terms.people} did not attend.
            </label>
            <button disabled={busy || !confirmAbsent} style={{ ...button, opacity: confirmAbsent ? 1 : .5 }} onClick={markAbsent}>Mark remaining absent</button>
          </>}
        </div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <button disabled={busy} style={button} onClick={() => run(readAttendance)}>Refresh attendance</button>}
          <button disabled={busy || rows === null || !!summary.onsite || !!summary.unmarked || !canCloseRegister} onClick={finish}
            style={{ ...button, background: 'var(--org-primary, #2563EB)', color: 'var(--org-on-primary, #fff)', opacity: busy || rows === null || summary.onsite || summary.unmarked || !canCloseRegister ? .5 : 1 }}>
            {busy ? 'Saving…' : 'Close register'}
          </button>
          <button disabled={busy} style={button} onClick={dismiss}>Keep delivering</button>
        </div>
      </>}
    </section>
  </div></OverlayPortal>
}
