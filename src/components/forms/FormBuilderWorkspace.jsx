import React, { useState } from 'react'
import Icon from '../../lib/icons'
import { QUESTION_TYPES } from './FormQuestionRenderer'
import { FORM_TEMPLATES } from './formTemplates'
import { useIsMobile } from '../../hooks/useIsMobile'

export const PANEL = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }
export const BUTTON = { minHeight: 44, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
const glyphs = { text: 'edit', textarea: 'forms', select: 'registers', checkbox: 'check', date: 'calendar', number: 'insights', email: 'newsletter', phone: '📞' }

export function QuestionToolbox({ onAdd, primary }) {
  return <section aria-label="Question library" style={{ ...PANEL, padding: 20 }}>
    <div style={{ fontSize: 11, color: 'var(--org-ink)', letterSpacing: 1.1, fontWeight: 800, marginBottom: 8 }}>MAKE IT YOURS</div>
    <h2 style={{ fontSize: 17, margin: '0 0 6px', color: 'var(--text)' }}>Add a question</h2>
    <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 17px', lineHeight: 1.6 }}>Choose the kind of answer you need.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {QUESTION_TYPES.map(type => <button key={type.key} onClick={() => onAdd(type.key)} title={type.hint} style={{ ...BUTTON, minHeight: 80, padding: '12px 6px', flexDirection: 'column', fontSize: 12, background: 'var(--surface2)' }}>
        <span style={{ color: primary }}><Icon name={glyphs[type.key]} size={20} /></span>{type.label}
      </button>)}
    </div>
    <div style={{ marginTop: 18, padding: 13, borderRadius: 12, background: 'var(--org-a05)', fontSize: 12, lineHeight: 1.7, color: 'var(--text3)' }}><strong style={{ color: 'var(--text)' }}>Keep it simple.</strong> Ask only what you need. Shorter forms are easier to finish.</div>
  </section>
}

export function TemplateStarter({ onUse, onBlank, primary, actionColour = primary }) {
  const [browsing, setBrowsing] = useState(false)
  const [query, setQuery] = useState('')
  const isMobile = useIsMobile()
  const recommended = ['trip-consent', 'parent-feedback', 'volunteer-application']
  const picks = FORM_TEMPLATES.filter(t => recommended.includes(t.id))
  const templates = browsing ? FORM_TEMPLATES.filter(t => `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase())) : picks
  return <section style={{ margin: '4px 0 20px' }}>
    <div style={{ padding: isMobile ? 20 : 26, borderRadius: 14, background: 'var(--org-a05)', border: '1px solid var(--org-a15)', marginBottom: 18 }}>
      <span style={{ display: 'inline-flex', padding: 10, borderRadius: 12, background: 'var(--surface)', color: primary, marginBottom: 12 }}><Icon name="forms" size={24} /></span>
      <h2 style={{ fontSize: 23, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.6, color: 'var(--text)' }}>A good form starts here.</h2>
      <p style={{ color: 'var(--text3)', fontSize: 14, lineHeight: 1.65, maxWidth: 440, margin: '0 0 18px' }}>Start with a ready-made template, or add your first question. You can change every word.</p>
      <button onClick={() => setBrowsing(v => !v)} aria-expanded={browsing} style={{ ...BUTTON, background: actionColour, borderColor: actionColour, color: '#fff' }}><Icon name="templates" />{browsing ? 'Show suggestions' : 'Browse templates'}</button>
      <button onClick={onBlank} style={{ ...BUTTON, marginLeft: isMobile ? 0 : 8, marginTop: isMobile ? 8 : 0, background: 'transparent', borderColor: 'transparent' }}>Start from scratch <Icon name="→" /></button>
    </div>
    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>{browsing ? 'TEMPLATE LIBRARY' : 'A LITTLE HEAD START'}</div>
    {browsing && <input aria-label="Search starter templates" placeholder="Search consent, feedback, registration…" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, fontSize: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', marginBottom: 12 }} />}
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10, maxHeight: browsing ? 420 : undefined, overflowY: browsing ? 'auto' : undefined }}>
      {templates.map(template => <button key={template.id} onClick={() => onUse(template)} style={{ ...PANEL, padding: 16, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 }}>
        <span style={{ color: primary }}><Icon name={template.categories.includes('people') ? 'team' : template.categories.includes('feedback') ? 'messaging' : template.categories.includes('consent') ? 'check' : template.categories.includes('health') ? 'medical' : 'templates'} size={22} /></span>
        <strong style={{ display: 'block', fontSize: 13, color: 'var(--text)', margin: '12px 0 6px' }}>{template.title}</strong>
        <span style={{ display: 'block', color: 'var(--text3)', fontSize: 12, lineHeight: 1.5 }}>{template.fields.length} questions · Fully editable</span>
      </button>)}
    </div>
    {!templates.length && <p style={{ color: 'var(--text3)', fontSize: 13 }}>No templates match. Try another word or start from scratch.</p>}
  </section>
}

export function ReviewChecklist({ form, issues, onFix, primary, actionColour = primary, onPublish, publishing, isDraft }) {
  return <section style={{ ...PANEL, padding: 22 }} aria-label="Publishing checks">
    <span style={{ display: 'inline-flex', padding: 10, borderRadius: 12, color: issues.length ? 'var(--warn-text)' : primary, background: 'var(--org-a05)' }}><Icon name={issues.length ? 'edit' : 'check'} size={24} /></span>
    <h2 style={{ fontSize: 20, letterSpacing: -0.5, color: 'var(--text)', margin: '14px 0 8px' }}>{issues.length ? 'A few finishing touches' : isDraft ? 'Ready when you are.' : 'Your form is live.'}</h2>
    <p style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, margin: '0 0 18px' }}>Try your form, check the details, then {isDraft ? 'publish' : 'save'}.</p>
    {issues.length > 0 ? <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>{issues.map((issue, i) => <button key={i} onClick={() => onFix(issue)} style={{ ...BUTTON, textAlign: 'left', justifyContent: 'space-between', color: 'var(--warn-text)', background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}><span>{issue.message}</span><Icon name="→" /></button>)}</div> : <div style={{ color: 'var(--ok-text)', background: 'var(--ok-bg)', padding: 13, borderRadius: 10, fontSize: 13, marginBottom: 18 }}>✓ All questions are ready</div>}
    <dl style={{ margin: 0, display: 'grid', gap: 14, color: 'var(--text3)', fontSize: 13 }}>
      {[['Questions', `${form.fields.length} · ${form.fields.filter(f => f.required).length} required`], ['Who can respond', form.visibility === 'private' ? 'Staff only' : 'Anyone with the link'], ['Closes', form.closing_date ? new Date(`${form.closing_date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }) : 'No closing date']].map(([label, value]) => <div key={label}><dt style={{ fontSize: 11, marginBottom: 4 }}>{label}</dt><dd style={{ margin: 0, color: 'var(--text)', fontWeight: 700 }}>{value}</dd></div>)}
    </dl>
    <button onClick={onPublish} disabled={issues.length > 0 || publishing} style={{ ...BUTTON, width: '100%', marginTop: 22, background: actionColour, borderColor: actionColour, color: '#fff', opacity: issues.length || publishing ? 0.5 : 1, cursor: issues.length || publishing ? 'not-allowed' : 'pointer' }}>{publishing ? 'Saving…' : isDraft ? 'Publish form' : 'Save changes'} <Icon name="→" /></button>
    <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text3)', marginBottom: 0 }}>{form.visibility === 'private' ? 'Publishing makes this form available to staff in your workspace.' : 'Publishing enables responses. It does not send an email. Share your link from the Forms workspace.'}</p>
  </section>
}
