import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'

// Overview and response inbox.
//
// The old landing page led with four large statistic cards. Counts are not work:
// knowing there are two live forms tells a youth worker nothing they can act on.
// This leads with what needs doing and shows the numbers as one quiet line.

const CARD = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }

const FLAG_LABELS = {
  medical: { label: 'Medical information', tone: 'var(--danger-text)', bg: 'var(--danger-bg)' },
  medication: { label: 'Medication', tone: 'var(--danger-text)', bg: 'var(--danger-bg)' },
  consent_withdrawn: { label: 'Consent withdrawn', tone: 'var(--warn-text)', bg: 'var(--warn-bg)' },
}

const timeAgo = iso => {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function AttentionRow({ tone, title, detail, cta, onAction, primary, isMobile }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderBottom: '1px solid var(--border)', flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: tone, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{detail}</div>
      </div>
      <button onClick={onAction} style={{
        minHeight: 44, padding: '9px 15px', borderRadius: 10, border: 'none', background: primary,
        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        flexShrink: 0, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0,
      }}>{cta}</button>
    </div>
  )
}

export function FormsOverview({ forms = [], submissions = [], primary, onOpenForm, onGoResponses, onCreate, onEdit, onShare, onTemplates, isAdmin, canViewSubmissions, loading, copiedId }) {
  const isMobile = useIsMobile()
  const compact = useIsMobile(1180)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const statusOf = f => f.status || (f.is_active ? 'active' : 'draft')
  const live = forms.filter(f => statusOf(f) === 'active').length
  const drafts = forms.filter(f => statusOf(f) === 'draft').length
  const fresh = submissions.filter(s => s.review_status === 'new').length
  const flagged = submissions.filter(s => s.review_status === 'needs_review').length
  const visible = forms.filter(f => (status === 'all' || statusOf(f) === status) && `${f.name} ${f.description || ''} ${f.tag || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const button = { minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface, #fff)', color: 'var(--text2, #334155)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
  const heading = { margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text, #172033)' }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const closing = forms.filter(f => {
    const days = (new Date(f.closing_date) - new Date(today)) / 86400000
    return statusOf(f) === 'active' && f.closing_date && days >= 0 && days <= 3
  })
  if (loading) return <div role="status" style={{ ...CARD, padding: 40, color: 'var(--text3, #64748B)' }}>Loading your forms…</div>

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[
          ['Live forms', live, 'Ready to collect responses', () => setStatus('active'), primary],
          ['Drafts', drafts, 'Work in progress', () => setStatus('draft'), 'var(--text3, #64748B)'],
          ['New responses', fresh, 'Waiting to be read', () => onGoResponses('new'), primary],
          ['Needs review', flagged, 'Flagged information', () => onGoResponses('needs_review'), 'var(--warn-text)'],
        ].map(([label, count, detail, action, tone]) => <button key={label} onClick={action} style={{ ...CARD, padding: isMobile ? 16 : 20, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderTop: `3px solid ${tone}` }}>
          <div style={{ color: 'var(--text2, #526075)', fontSize: 12, fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text, #172033)', margin: '8px 0', letterSpacing: -1 }}>{count}</div>
          <div style={{ fontSize: 12, color: 'var(--text3, #64748B)' }}>{detail} <span aria-hidden="true">↗</span></div>
        </button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', alignItems: 'start', gap: 22 }}>
        <section style={{ ...CARD, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: isMobile ? 16 : 22, borderBottom: '1px solid #E8EDF3' }}>
            <h2 style={heading}>Your form library</h2>
            <p style={{ fontSize: 13, color: 'var(--text3, #64748B)', margin: '6px 0 18px' }}>Everything you collect, organised in one place.</p>
            <input aria-label="Search form library" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, description or type…" style={{ width: '100%', minHeight: 46, padding: '12px 14px', border: '1px solid #DCE3EB', borderRadius: 10, background: 'var(--surface2, #F8FAFC)', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {[['all', 'All forms', forms.length], ['active', 'Live', live], ['draft', 'Drafts', drafts], ['archived', 'Archived', forms.filter(f => statusOf(f) === 'archived').length]].map(([key, label, count]) => <button key={key} aria-pressed={status === key} onClick={() => setStatus(key)} style={{ ...button, borderColor: status === key ? primary : 'transparent', color: status === key ? primary : 'var(--text3, #64748B)', background: status === key ? 'var(--org-a05, #F8FAFC)' : '#fff' }}>{label} <span style={{ marginLeft: 5, fontSize: 11 }}>{count}</span></button>)}
            </div>
          </div>
          {visible.map(f => {
            const state = statusOf(f)
            const count = submissions.filter(s => s.form_id === f.id).length
            const review = submissions.filter(s => s.form_id === f.id && s.review_status === 'needs_review').length
            const tone = state === 'active' ? '#047857' : state === 'draft' ? 'var(--warn-text)' : 'var(--text3, #64748B)'
            return <article key={f.id} style={{ padding: isMobile ? 16 : 22, borderBottom: '1px solid #EDF0F5' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {!isMobile && <div style={{ width: 44, height: 50, borderRadius: 10, background: 'var(--surface2, #F1F5F9)', color: primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="📝" /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}><h3 style={{ ...heading, fontSize: 15, overflowWrap: 'anywhere' }}>{f.name}</h3><span style={{ color: tone, fontWeight: 700, fontSize: 11, background: 'var(--surface2, #F8FAFC)', borderRadius: 6, padding: '4px 7px' }}>{state === 'active' ? '● Live' : state === 'draft' ? 'Draft' : 'Archived'}</span></div>
                  <p style={{ fontSize: 13, color: 'var(--text3, #64748B)', margin: '7px 0 12px', lineHeight: 1.5 }}>{f.description || `${f.tag || 'General'} form · ${(f.fields || []).length} fields`}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--text3, #64748B)' }}><span><strong style={{ color: 'var(--text, #172033)' }}>{count}</strong> loaded responses</span>{review > 0 && <span style={{ color: 'var(--warn-text)', fontWeight: 700 }}>{review} need review</span>}{f.closing_date && <span>Closes {new Date(f.closing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}</span>}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingLeft: isMobile ? 0 : 58 }}>
                {canViewSubmissions(f) && <button onClick={() => onOpenForm(f)} style={{ ...button, color: primary }}>View responses ↗</button>}
                {state === 'active' && <button onClick={() => onShare(f)} style={button}>{copiedId === f.id ? 'Link copied ✓' : 'Copy link'}</button>}
                {isAdmin && <button onClick={() => onEdit(f)} style={{ ...button, borderColor: 'transparent' }}>{state === 'draft' ? 'Continue editing' : 'Edit form'}</button>}
              </div>
            </article>
          })}
          {!visible.length && <div style={{ padding: '38px 22px', textAlign: 'center' }}><h3 style={heading}>{forms.length ? 'No matching forms' : 'Your first form starts here'}</h3><p style={{ color: 'var(--text3, #64748B)', fontSize: 13 }}>{forms.length ? 'Try another search or choose a different status.' : 'Collect registrations, consent and feedback with a simple link.'}</p>{!forms.length && isAdmin && <button style={{ ...button, background: primary, color: '#fff' }} onClick={onCreate}>Create a form</button>}</div>}
          <div style={{ padding: '14px 22px', fontSize: 12, color: 'var(--text3, #64748B)', background: 'var(--surface2, #FAFBFD)' }}>{visible.length} of {forms.length} forms · Response counts reflect the latest loaded submissions.</div>
        </section>
        <aside style={{ display: 'grid', gap: 18 }}>
          <section style={{ ...CARD, overflow: 'hidden' }}>
            <h2 style={{ ...heading, padding: '20px 18px 12px' }}>Action centre</h2>
            {flagged > 0 && <AttentionRow tone="var(--warn-text)" title={`${flagged} need review`} detail="Check flagged information" cta="Review" onAction={() => onGoResponses('needs_review')} primary={primary} isMobile />}
            {fresh > 0 && <AttentionRow tone={primary} title={`${fresh} new responses`} detail="Ready for your team" cta="Open inbox" onAction={() => onGoResponses('new')} primary={primary} isMobile />}
            {closing.filter(f => isAdmin || canViewSubmissions(f)).map(f => <AttentionRow key={f.id} tone="var(--warn-text)" title={f.name} detail="Closing within 3 days" cta={isAdmin ? 'Manage form' : 'View responses'} onAction={() => isAdmin ? onEdit(f) : onOpenForm(f)} primary={primary} isMobile />)}
            {!flagged && !fresh && !closing.length && <div style={{ margin: '0 18px 18px', borderRadius: 10, padding: 14, background: 'var(--ok-bg)', color: 'var(--ok-text)', fontSize: 13, lineHeight: 1.6 }}><strong>✓ Nothing waiting for review</strong><br />New responses and upcoming deadlines will appear here.</div>}
          </section>
          {isAdmin && <section style={{ ...CARD, padding: 20, background: '#172033', color: '#fff' }}><div style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text-faint)', fontWeight: 700 }}>LESS ADMIN, MORE IMPACT</div><h2 style={{ fontSize: 21, margin: '12px 0 8px', letterSpacing: -0.5 }}>Start with a head start.</h2><p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.7 }}>Ready-made forms for consent, registrations, feedback and everyday admin.</p><button onClick={onTemplates} style={{ ...button, width: '100%', marginTop: 8 }}>Explore templates →</button></section>}
          <section style={{ ...CARD, padding: 18 }}><h2 style={heading}>Latest responses</h2>{submissions.length ? submissions.slice(0, 4).map(s => <button key={s.id} onClick={() => onGoResponses('all')} style={{ display: 'block', width: '100%', padding: '14px 0', border: 0, borderBottom: '1px solid #EDF0F5', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}><div style={{ color: 'var(--text, #172033)', fontWeight: 700, fontSize: 13 }}>{s.submitted_name || 'Anonymous'}</div><div style={{ color: 'var(--text3, #64748B)', fontSize: 12, marginTop: 5 }}>{forms.find(f => f.id === s.form_id)?.name || 'Form'} · {timeAgo(s.created_at)}</div></button>) : <p style={{ fontSize: 13, color: 'var(--text3, #64748B)', lineHeight: 1.7, marginBottom: 0 }}>No responses yet. Share a live form to start collecting answers.</p>}</section>
        </aside>
      </div>
    </div>
  )
}

export function ResponseInbox({ org, forms = [], primary, initialFilter = 'all', onChanged }) {
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState(initialFilter)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const { data } = await supabase.from('form_submissions')
      .select('*').eq('org_id', org.id)
      .order('created_at', { ascending: false }).limit(300)
    setRows(data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setFilter(initialFilter) }, [initialFilter])

  const counts = useMemo(() => ({
    all: rows.length,
    new: rows.filter(r => r.review_status === 'new').length,
    needs_review: rows.filter(r => r.review_status === 'needs_review').length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filter !== 'all' && r.review_status !== filter) return false
      if (!q) return true
      const form = forms.find(f => f.id === r.form_id)
      return [r.submitted_name || '', form?.name || '', JSON.stringify(r.data || {})]
        .join(' ').toLowerCase().includes(q)
    })
  }, [rows, filter, search, forms])

  async function markReviewed(row) {
    const { error } = await supabase.from('form_submissions')
      .update({ review_status: 'reviewed', reviewed_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return
    setRows(list => list.map(r => r.id === row.id ? { ...r, review_status: 'reviewed' } : r))
    setOpen(null)
    onChanged?.()
  }

  if (open) {
    const form = forms.find(f => f.id === open.form_id)
    const answers = Object.entries(open.data || {})
    return (
      <div>
        <button onClick={() => setOpen(null)} style={{
          padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text3)', fontSize: 12.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14,
        }}><Icon name="←" /> Responses</button>

        <div style={{ ...CARD, padding: isMobile ? 18 : 24 }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: 'var(--text)' }}>
            {open.submitted_name || 'Anonymous'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 3 }}>
            {form?.name} · {new Date(open.created_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
            })}
          </div>

          {open.flags?.length > 0 && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
              {open.flags.map(fl => {
                const meta = FLAG_LABELS[fl] || { label: fl, tone: 'var(--warn-text)', bg: 'var(--warn-bg)' }
                return (
                  <span key={fl} style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
                    background: meta.bg, color: meta.tone,
                  }}><Icon name="⚠" /> {meta.label}</span>
                )
              })}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'grid', gap: 14 }}>
            {answers.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (String(v || '—'))}
                </div>
              </div>
            ))}
          </div>

          {open.review_status !== 'reviewed' && (
            <button onClick={() => markReviewed(open)} style={{
              marginTop: 22, padding: '12px 20px', borderRadius: 12, border: 'none',
              background: primary, color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Mark reviewed</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['new', 'New'], ['needs_review', 'Needs review']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '8px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700,
            border: `1px solid ${filter === key ? 'transparent' : 'var(--border)'}`,
            background: filter === key ? primary : '#fff',
            color: filter === key ? '#fff' : 'var(--text3)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {label}{counts[key] ? ` ${counts[key]}` : ''}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search responses…"
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 11, fontSize: 14,
          border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14,
        }}
      />

      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '38px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>
            {rows.length === 0 ? 'No responses yet' : 'Nothing matches that'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)' }}>
            {rows.length === 0
              ? "When someone completes a form, you'll see it here."
              : 'Try a different search or filter.'}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map((r, i) => {
          const form = forms.find(f => f.id === r.form_id)
          const flagged = r.review_status === 'needs_review'
          const fresh = r.review_status === 'new'
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(i * 0.015, 0.2) }}
              onClick={() => setOpen(r)}
              style={{
                ...CARD, padding: 14, textAlign: 'left', cursor: 'pointer',
                fontFamily: 'inherit', width: '100%',
                borderLeft: `3px solid ${flagged ? 'var(--danger-text)' : fresh ? 'var(--org-primary)' : 'var(--border)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
                    {r.submitted_name || 'Anonymous'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                    {form?.name || 'Form'} · {timeAgo(r.created_at)}
                  </div>
                </div>
                {flagged && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                    background: 'var(--danger-bg)', color: 'var(--danger-text)', flexShrink: 0,
                  }}>Needs review</span>
                )}
                {fresh && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                    background: 'var(--violet-bg)', color: 'var(--violet-text)', flexShrink: 0,
                  }}>New</span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
