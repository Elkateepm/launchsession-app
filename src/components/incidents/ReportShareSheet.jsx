import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { QRCard } from '../shared/QRShareSheet'
import Icon from '../../lib/icons'
import { REPORT_FORMS, RECORD_LABELS } from './reportForms'

// Raise a concern and Log an injury, for someone without an account: a link to
// send, or a code to print for the wall or the first aid kit. As in the
// Solidarity Sports hub, anyone who opens it can report without signing in,
// and the report lands where staff already look (handle_form_creates_record).
//
// One code shows at a time, as in the sign-up QR sheet, so a camera never has
// two codes in frame.
export default function ReportShareSheet({ org, userProfile, onClose }) {
  const isMobile = window.innerWidth < 768
  const canSetUp = ['owner', 'admin'].includes(userProfile?.role)
  const [forms, setForms] = useState(null)
  const [which, setWhich] = useState(null)
  const [settingUp, setSettingUp] = useState(false)
  const [error, setError] = useState('')

  const load = () => supabase.from('org_forms')
    .select('id, name, creates_record')
    .eq('org_id', org.id)
    .in('creates_record', ['injury', 'concern'])
    .eq('status', 'active').eq('visibility', 'public')
    .order('creates_record', { ascending: false })
    .then(({ data, error: err }) => {
      if (err) setError('Could not load the report forms. Check your connection and try again.')
      const list = data || []
      setForms(list)
      setWhich(current => current && list.some(f => f.id === current) ? current : list[0]?.id || null)
    })

  useEffect(() => { if (org?.id) load() }, [org?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Creates whichever of the two standard forms the organisation is missing.
  const setUp = async () => {
    setSettingUp(true)
    setError('')
    const have = new Set((forms || []).map(f => f.creates_record))
    const rows = REPORT_FORMS.filter(f => !have.has(f.creates_record)).map(f => ({
      org_id: org.id, name: f.name, description: f.description, confirmation_message: f.confirmation_message,
      fields: f.fields, creates_record: f.creates_record, visibility: 'public', status: 'active', tag: 'Safety',
      created_by: userProfile?.id || null,
    }))
    const { error: err } = rows.length ? await supabase.from('org_forms').insert(rows) : { error: null }
    setSettingUp(false)
    if (err) { setError('Could not set up the report forms. Only admins can create forms; check your connection and try again.'); return }
    load()
  }

  const urlFor = form => `${window.location.origin}/forms/${org.slug}/${form.id}`
  const current = forms?.find(f => f.id === which)
  const missing = forms ? REPORT_FORMS.filter(f => !forms.some(x => x.creates_record === f.creates_record)) : []

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10700, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ls-report-share-title" style={{
        background: 'var(--surface)', borderRadius: isMobile ? '24px 24px 0 0' : 22, width: '100%', maxWidth: isMobile ? '100%' : 420,
        maxHeight: isMobile ? '92vh' : '90vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        padding: `${isMobile ? 16 : 22}px 20px calc(24px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div>
            <h2 id="ls-report-share-title" style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>Reporting without an account</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 }}>
              Send the link, or print the code for the wall or the first aid kit. Anyone who opens it can report without signing in, and it lands where your team already looks.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface2)', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0, color: 'var(--text2)' }}>×</button>
        </div>

        {error && <div role="alert" style={{ margin: '10px 0', fontSize: 13, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '10px 12px' }}>{error}</div>}

        {forms === null ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : forms.length === 0 ? (
          <div style={{ marginTop: 14, background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 14, padding: '14px 16px', color: 'var(--warn-text)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Nothing to share yet</div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              {canSetUp
                ? 'Set up two public forms, Report an injury and Raise a safeguarding concern. Injuries go into the accident book and concerns into the safeguarding log. You can edit their questions in Forms afterwards.'
                : 'An admin needs to set up the public report forms first. Ask them to press Share here.'}
            </div>
            {canSetUp && (
              <button onClick={setUp} disabled={settingUp} style={{ marginTop: 12, width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: 'var(--org-primary)', color: 'var(--org-on-primary, #fff)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: settingUp ? 0.7 : 1 }}>
                {settingUp ? 'Setting up…' : 'Set up the report forms'}
              </button>
            )}
          </div>
        ) : (
          <>
            {forms.length > 1 && (
              <div role="group" aria-label="Choose a form" style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 12, padding: 4, margin: '14px 0 20px' }}>
                {forms.map(f => (
                  <button key={f.id} aria-pressed={which === f.id} onClick={() => setWhich(f.id)} style={{
                    flex: 1, minHeight: 44, padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: which === f.id ? 'var(--surface)' : 'transparent', color: which === f.id ? 'var(--text)' : 'var(--text3)',
                    boxShadow: which === f.id ? '0 1px 4px rgba(15,23,42,0.12)' : 'none',
                  }}>
                    <Icon name={RECORD_LABELS[f.creates_record].icon} /> {RECORD_LABELS[f.creates_record].short}
                  </button>
                ))}
              </div>
            )}
            {current && (
              <QRCard key={current.id} icon={<Icon name={RECORD_LABELS[current.creates_record].icon} />} title={current.name}
                subtitle={`Each report becomes ${RECORD_LABELS[current.creates_record].verb}`} url={urlFor(current)} primary={org?.primary_color || '#1B9AAA'} />
            )}
            {canSetUp && missing.length > 0 && (
              <button onClick={setUp} disabled={settingUp} style={{ marginTop: 16, width: '100%', minHeight: 44, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {settingUp ? 'Setting up…' : `Add the ${missing.map(m => m.name).join(' and ')} form`}
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
