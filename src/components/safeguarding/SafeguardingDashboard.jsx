import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_COLORS = {
  open:        { bg: 'rgba(239,68,68,0.1)',   color: '#EF4444', label: 'Open' },
  in_progress: { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B', label: 'In Progress' },
  resolved:    { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E', label: 'Resolved' },
  closed:      { bg: 'rgba(100,116,139,0.1)', color: '#64748B', label: 'Closed' },
}

function CaseDetailModal({ c, onClose, onStatusChange }) {
  const [status, setStatus] = useState(c.status)
  const [notes, setNotes] = useState(c.resolution_notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const update = { status, resolution_notes: notes, updated_at: new Date().toISOString() }
    if (status === 'resolved' && c.status !== 'resolved') update.resolved_at = new Date().toISOString()
    const { error } = await supabase.from('cause_for_concern').update(update).eq('id', c.id)
    setSaving(false)
    if (!error) { onStatusChange(); onClose() }
  }

  const Row = ({ label, value }) => value ? (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{value}</div>
    </div>
  ) : null

  const Badge = ({ show, label }) => show ? (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 999, marginRight: 6 }}>{label}</span>
  ) : null

  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(680px,94vw)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: sc.color, background: sc.bg, padding: '3px 10px', borderRadius: 999 }}>{sc.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Case #{c.id.slice(-6).toUpperCase()}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Submitted {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <Row label="Submitted by" value={c.submitter_name} />
          <Row label="Date of incident" value={c.date_of_incident ? new Date(c.date_of_incident).toLocaleDateString('en-GB') : null} />
          <Row label="People involved" value={c.child_name} />
          <Row label="Location" value={c.location} />
        </div>
        <Row label="Description" value={c.description} />
        {c.witnesses && <Row label="Witnesses / CP co-ordinator" value={c.witnesses} />}
        {c.action_taken && <Row label="Immediate action taken" value={c.action_taken} />}

        <div style={{ background: 'rgba(245,208,0,0.06)', borderRadius: 12, padding: 16, border: '1px solid rgba(245,208,0,0.2)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#856404', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Action Plan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <Badge show={c.dsl_notified} label={'DSL Notified' + (c.dsl_notified_name ? ': ' + c.dsl_notified_name : '')} />
            <Badge show={c.parents_notified} label="Parents Notified" />
            <Badge show={c.police_notified} label={'Police/Agency' + (c.police_reference ? ': ' + c.police_reference : '')} />
            <Badge show={c.follow_up_required} label="Follow-up Required" />
            {!c.dsl_notified && !c.parents_notified && !c.police_notified && !c.follow_up_required && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>No actions recorded at time of submission.</span>
            )}
          </div>
          {c.follow_up_details && <Row label="Follow-up details" value={c.follow_up_details} />}
          {c.action_plan_notes && <Row label="Additional DSL notes" value={c.action_plan_notes} />}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Update Status</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {Object.entries(STATUS_COLORS).map(([key, val]) => (
              <button key={key} onClick={() => setStatus(key)} style={{ padding: '7px 14px', borderRadius: 999, border: status === key ? '2px solid ' + val.color : '1px solid var(--border)', background: status === key ? val.bg : 'transparent', color: status === key ? val.color : 'var(--text3)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{val.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Resolution / Case Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add resolution notes, outcomes, or case updates..." style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 90, boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? 'rgba(37,99,235,0.4)' : 'linear-gradient(90deg,#2563EB,#7C3AED)', color: '#fff', fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </>
  )
}

export default function SafeguardingDashboard({ org }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cause_for_concern').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? cases : cases.filter(c => c.status === filter)

  const stats = {
    open: cases.filter(c => c.status === 'open').length,
    in_progress: cases.filter(c => c.status === 'in_progress').length,
    resolved: cases.filter(c => c.status === 'resolved').length,
    total: cases.length,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Safeguarding Cases</div>
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>DSL view — all causes for concern submitted by your team.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Cases', value: stats.total, color: '#64748B' },
          { label: 'Open', value: stats.open, color: '#EF4444' },
          { label: 'In Progress', value: stats.in_progress, color: '#F59E0B' },
          { label: 'Resolved', value: stats.resolved, color: '#22C55E' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all','All Cases'],['open','Open'],['in_progress','In Progress'],['resolved','Resolved'],['closed','Closed']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ padding: '7px 16px', borderRadius: 999, border: filter === key ? '1px solid #2563EB' : '1px solid var(--border)', background: filter === key ? 'rgba(37,99,235,0.1)' : 'transparent', color: filter === key ? '#3B82F6' : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading cases...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No {filter !== 'all' ? filter + ' ' : ''}cases yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>All submitted concerns will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.open
            return (
              <button key={c.id} onClick={() => setSelected(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s', width: '100%' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🚨</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>Case #{c.id.slice(-6).toUpperCase()}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 999 }}>{sc.label}</span>
                    {c.follow_up_required && <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 999 }}>Follow-up needed</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 2 }}>Re: {c.child_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Submitted by {c.submitter_name} · {new Date(c.created_at).toLocaleDateString('en-GB')}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{c.date_of_incident ? new Date(c.date_of_incident).toLocaleDateString('en-GB') : ''}</div>
                <div style={{ color: 'var(--text3)', fontSize: 16 }}>›</div>
              </button>
            )
          })}
        </div>
      )}

      {selected && <CaseDetailModal c={selected} onClose={() => setSelected(null)} onStatusChange={load} />}
    </div>
  )
}
