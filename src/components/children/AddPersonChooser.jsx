import React from 'react'
import OverlayPortal from '../shared/OverlayPortal'
import Icon from '../../lib/icons'

// ─── ADD A YOUNG PERSON: WHO FILLS IT IN ─────────────────────
// Three ways the details reach the roster, depending on who is holding them:
//   * staff already have them, so type them in now (straight onto the roster)
//   * the parent is elsewhere, so send them the registration link
//   * the parent is standing right here, so hand them this phone
// The last two are the same parent form and arrive in Registration Requests
// for approval, which the cards say so nobody looks for them on the roster.

export default function AddPersonChooser({ terms, onPick, onClose }) {
  const options = [
    { key: 'form', icon: '✏️', title: 'Fill it in now', body: `You have the details. Adds the ${terms.person} straight to the directory.` },
    { key: 'link', icon: '✉️', title: 'Send a link', body: 'Email the parent or carer, or copy the link. Goes to Registration Requests for approval.' },
    { key: 'handover', icon: '📱', title: 'Hand the phone over', body: 'The parent fills in the form on this device. Goes to Registration Requests for approval.' },
  ]
  return (
    <OverlayPortal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 10700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-labelledby="add-person-title" onClick={e => e.stopPropagation()}
          style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <div id="add-person-title" style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', flex: 1 }}>Add {terms.person}</div>
            <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--surface-hover)', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}><Icon name="✕" /></button>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 16 }}>Who is filling in the details?</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {options.map(o => (
              <button key={o.key} onClick={() => onPick(o.key)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', width: '100%',
                padding: '14px 14px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: 'var(--org-a10)', color: 'var(--org-ink)' }}><Icon name={o.icon} /></span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{o.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', lineHeight: 1.45 }}>{o.body}</span>
                </span>
                <span style={{ color: 'var(--text-faint)', alignSelf: 'center' }}><Icon name="→" /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </OverlayPortal>
  )
}
