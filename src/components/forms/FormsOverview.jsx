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

const CARD = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 16 }

const FLAG_LABELS = {
  medical: { label: 'Medical information', tone: '#B42318', bg: '#FEF2F2' },
  medication: { label: 'Medication', tone: '#B42318', bg: '#FEF2F2' },
  consent_withdrawn: { label: 'Consent withdrawn', tone: '#93500A', bg: '#FEF6E7' },
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
      borderBottom: '1px solid #F5F3FA', flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: tone, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 2 }}>{detail}</div>
      </div>
      <button onClick={onAction} style={{
        padding: '9px 15px', borderRadius: 10, border: 'none', background: primary,
        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        flexShrink: 0, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0,
      }}>{cta}</button>
    </div>
  )
}

export function FormsOverview({ org, forms = [], submissions = [], primary, onOpenForm, onGoResponses, onCreate }) {
  const isMobile = useIsMobile()

  const stats = useMemo(() => ({
    total: forms.length,
    live: forms.filter(f => (f.status || (f.is_active ? 'active' : 'draft')) === 'active').length,
    draft: forms.filter(f => (f.status || (f.is_active ? 'active' : 'draft')) === 'draft').length,
    unread: submissions.filter(s => s.review_status === 'new').length,
  }), [forms, submissions])

  const attention = useMemo(() => {
    const items = []

    // Anything flagged comes first regardless of age. A new allergy sitting
    // behind four ordinary registrations is exactly what this exists to stop.
    const flagged = submissions.filter(s => s.review_status === 'needs_review')
    if (flagged.length) {
      items.push({
        id: 'flagged',
        tone: '#E5484D',
        title: `${flagged.length} response${flagged.length === 1 ? '' : 's'} need${flagged.length === 1 ? 's' : ''} review`,
        detail: 'Contains medical, medication or consent changes',
        cta: 'Review',
        onAction: () => onGoResponses('needs_review'),
      })
    }

    const fresh = submissions.filter(s => s.review_status === 'new')
    if (fresh.length) {
      items.push({
        id: 'new',
        tone: '#7C5CFC',
        title: `${fresh.length} new response${fresh.length === 1 ? '' : 's'}`,
        detail: 'Not yet looked at',
        cta: 'Review',
        onAction: () => onGoResponses('new'),
      })
    }

    // A form that closes soon and a form left in draft are both quiet failures
    // -- nobody is chasing them, so surface them here.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    forms.forEach(f => {
      if (!f.closing_date) return
      const days = Math.round((new Date(f.closing_date) - new Date(today)) / 86400000)
      if (days >= 0 && days <= 3 && (f.status || (f.is_active ? 'active' : 'draft')) === 'active') {
        items.push({
          id: `closing-${f.id}`,
          tone: '#F79009',
          title: f.name,
          detail: days === 0 ? 'Closes today' : `Closes in ${days} day${days === 1 ? '' : 's'}`,
          cta: 'Open',
          onAction: () => onOpenForm(f),
        })
      }
    })

    return items
  }, [forms, submissions, onGoResponses, onOpenForm])

  const liveForms = forms.filter(f => (f.status || (f.is_active ? 'active' : 'draft')) === 'active')
  const recent = submissions.slice(0, 6)

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#8B87A3', marginBottom: 14 }}>
        {stats.total} form{stats.total === 1 ? '' : 's'} &nbsp;·&nbsp; {stats.live} live
        &nbsp;·&nbsp; {stats.draft} draft &nbsp;·&nbsp; {stats.unread} new response{stats.unread === 1 ? '' : 's'}
      </div>

      {attention.length > 0 ? (
        <div style={{ ...CARD, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #ECE9F5', fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
            Needs attention
          </div>
          {attention.map(item => (
            <AttentionRow key={item.id} {...item} primary={primary} isMobile={isMobile} />
          ))}
        </div>
      ) : (
        <div style={{ ...CARD, padding: '26px 20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}><Icon name="✅" /></div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            You're all caught up
          </div>
          <div style={{ fontSize: 13.5, color: '#8B87A3' }}>There are no outstanding form actions.</div>
        </div>
      )}

      {liveForms.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Live forms</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 10,
          }}>
            {liveForms.slice(0, 6).map(f => {
              const count = submissions.filter(s => s.form_id === f.id).length
              return (
                <button key={f.id} onClick={() => onOpenForm(f)} style={{
                  ...CARD, padding: 15, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 7, background: '#12B76A' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: '#04713C', letterSpacing: 0.5 }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>{f.name}</div>
                  <div style={{ fontSize: 12.5, color: '#8B87A3' }}>
                    {count} response{count === 1 ? '' : 's'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Recent responses</div>
          <div style={{ ...CARD, overflow: 'hidden' }}>
            {recent.map((s, i) => {
              const form = forms.find(f => f.id === s.form_id)
              return (
                <button key={s.id} onClick={() => onGoResponses('all')} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '12px 15px', border: 'none', background: 'transparent',
                  borderBottom: i < recent.length - 1 ? '1px solid #F5F3FA' : 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                      {s.submitted_name || 'Anonymous'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#8B87A3' }}>{form?.name || 'Form'}</div>
                  </div>
                  {s.flags?.length > 0 && (
                    <span style={{ width: 7, height: 7, borderRadius: 7, background: '#E5484D', flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>{timeAgo(s.created_at)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {forms.length === 0 && (
        <div style={{ ...CARD, padding: '44px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}><Icon name="📝" /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
            Collect what you need without chasing paperwork
          </div>
          <div style={{ fontSize: 14, color: '#8B87A3', maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.55 }}>
            Registrations, consent, medical updates and feedback — sent as a link,
            answered on a phone, and back with you in minutes.
          </div>
          <button onClick={onCreate} style={{
            padding: '12px 22px', borderRadius: 12, border: 'none', background: primary,
            color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}>Create your first form</button>
        </div>
      )}
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
          padding: '7px 13px', borderRadius: 9, border: '1px solid #ECE9F5',
          background: '#fff', color: '#64748B', fontSize: 12.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14,
        }}><Icon name="←" /> Responses</button>

        <div style={{ ...CARD, padding: isMobile ? 18 : 24 }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#0F172A' }}>
            {open.submitted_name || 'Anonymous'}
          </div>
          <div style={{ fontSize: 13.5, color: '#8B87A3', marginTop: 3 }}>
            {form?.name} · {new Date(open.created_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
            })}
          </div>

          {open.flags?.length > 0 && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
              {open.flags.map(fl => {
                const meta = FLAG_LABELS[fl] || { label: fl, tone: '#93500A', bg: '#FEF6E7' }
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
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8B87A3', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 14.5, color: '#0F172A', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
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
            border: `1px solid ${filter === key ? 'transparent' : '#ECE9F5'}`,
            background: filter === key ? primary : '#fff',
            color: filter === key ? '#fff' : '#64748B',
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
          border: '1px solid #ECE9F5', background: '#fff', color: '#0F172A',
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14,
        }}
      />

      {loading && <div style={{ padding: 30, textAlign: 'center', color: '#8B87A3', fontSize: 14 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '38px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
            {rows.length === 0 ? 'No responses yet' : 'Nothing matches that'}
          </div>
          <div style={{ fontSize: 13.5, color: '#8B87A3' }}>
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
                borderLeft: `3px solid ${flagged ? '#E5484D' : fresh ? '#7C5CFC' : '#ECE9F5'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                    {r.submitted_name || 'Anonymous'}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 2 }}>
                    {form?.name || 'Form'} · {timeAgo(r.created_at)}
                  </div>
                </div>
                {flagged && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                    background: '#FEF2F2', color: '#B42318', flexShrink: 0,
                  }}>Needs review</span>
                )}
                {fresh && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                    background: '#F1EDFF', color: '#5B21B6', flexShrink: 0,
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
