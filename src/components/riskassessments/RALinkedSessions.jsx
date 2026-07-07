import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { btnPrimary, btnGhost } from '../volunteers/vh_shared'
import { riskScore, riskRating, LIKELIHOOD_LABELS, SEVERITY_LABELS, RA_STATUS_LABELS } from './ra_shared'

// ── Session linking tab ──
export default function RALinkedSessions({ assessment, org, session: authSession }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [linked, setLinked] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: links }, { data: sessions }] = await Promise.all([
      supabase.from('risk_assessment_sessions').select('*, sessions(*)').eq('assessment_id', assessment.id),
      supabase.from('sessions').select('id, title, session_date, start_time, end_time, location, session_type').eq('org_id', org.id).gte('session_date', today).order('session_date').limit(100),
    ])
    setLinked(links || [])
    setAllSessions(sessions || [])
    setLoading(false)
  }, [assessment.id, org.id])

  useEffect(() => { load() }, [load])

  const linkedIds = new Set(linked.map(l => l.session_id))

  const attach = async (s) => {
    const { data } = await supabase.from('risk_assessment_sessions').insert({ assessment_id: assessment.id, session_id: s.id, org_id: org.id }).select('*, sessions(*)').single()
    if (data) setLinked(l => [...l, data])
    await supabase.from('risk_assessment_audit').insert({ assessment_id: assessment.id, org_id: org.id, action: 'attached', detail: `Attached to ${s.title}`, actor_id: authSession?.user?.id })
  }

  const detach = async (link) => {
    setLinked(l => l.filter(x => x.id !== link.id))
    await supabase.from('risk_assessment_sessions').delete().eq('id', link.id)
    await supabase.from('risk_assessment_audit').insert({ assessment_id: assessment.id, org_id: org.id, action: 'detached', detail: `Detached from session`, actor_id: authSession?.user?.id })
  }

  const filtered = allSessions.filter(s => !linkedIds.has(s.id) && (!search.trim() || s.title?.toLowerCase().includes(search.toLowerCase())))

  if (loading) return <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>Loading linked sessions…</div>

  return (
    <div>
      {linked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8', fontSize: 13 }}>Not attached to any sessions yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {linked.map(link => {
            const s = link.sessions
            if (!s) return null
            return (
              <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.08)', background: '#fff' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>📅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{s.session_date ? new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}{s.start_time ? ` · ${s.start_time}` : ''}{s.location ? ` · ${s.location}` : ''}</div>
                </div>
                <button onClick={() => detach(link)} style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: 15 }}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {picker ? (
        <div style={{ border: '1.5px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: 12, background: '#F8FAFC' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search upcoming sessions…" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13, outline: 'none', marginBottom: 8 }} />
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 14, color: '#94A3B8', fontSize: 12.5 }}>No matching upcoming sessions.</div>
            ) : filtered.map(s => (
              <button key={s.id} onClick={() => attach(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(15,23,42,0.06)', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 15 }}>📅</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.session_date ? new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}{s.location ? ` · ${s.location}` : ''}</div>
                </div>
                <span style={{ color: primary, fontWeight: 800, fontSize: 12 }}>+ Attach</span>
              </button>
            ))}
          </div>
          <button onClick={() => setPicker(false)} style={{ ...btnGhost, marginTop: 8, width: '100%' }}>Done</button>
        </div>
      ) : (
        <button onClick={() => setPicker(true)} style={btnPrimary(primary)}>+ Attach to Session</button>
      )}
    </div>
  )
}

// ── PDF / print export ──
export function printRiskAssessment(assessment, hazards, org, staff = []) {
  const reviewerName = staff.find(s => s.id === assessment.assigned_reviewer_id)?.full_name || '—'
  const creatorName = staff.find(s => s.id === assessment.created_by)?.full_name || '—'
  const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const hazardRows = (hazards || []).map((h, i) => {
    const score = riskScore(h.likelihood, h.severity)
    const rScore = riskScore(h.residual_likelihood, h.residual_severity)
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(h.hazard)}</td>
      <td>${esc(h.who_at_risk)}</td>
      <td style="text-align:center">${LIKELIHOOD_LABELS[h.likelihood - 1] || ''}<br>×<br>${SEVERITY_LABELS[h.severity - 1] || ''}<br><strong>= ${score} (${riskRating(score)})</strong></td>
      <td>${esc(h.control_measures)}</td>
      <td style="text-align:center"><strong>${rScore}</strong><br>${riskRating(rScore)}</td>
    </tr>`
  }).join('')

  const emergencyBlocks = [
    ['Emergency Contacts', assessment.emergency_contacts],
    ['Meeting Point', assessment.meeting_point],
    ['Nearest Hospital', assessment.nearest_hospital],
    ['First Aid Equipment', assessment.first_aid_equipment],
    ['Emergency Procedures', assessment.emergency_procedures],
    ['Evacuation Plan', assessment.evacuation_plan],
    ['Missing Child Procedure', assessment.missing_child_procedure],
    ['Safeguarding Escalation', assessment.safeguarding_escalation],
    ['Weather Contingency', assessment.weather_contingency],
  ].filter(([, v]) => v).map(([label, v]) => `<p><strong>${label}:</strong> ${esc(v)}</p>`).join('')

  const html = `<!DOCTYPE html><html><head><title>Risk Assessment — ${esc(assessment.name)}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, sans-serif; color: #1e293b; padding: 32px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-top: 28px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
    .foot { margin-top: 32px; font-size: 11px; color: #94a3b8; }
  </style></head><body>
    <h1>${esc(assessment.name)}</h1>
    <div style="font-size:13px;color:#64748b">${esc(org?.name || '')} · Risk Assessment</div>
    <div class="meta">
      <div><strong>Activity Type:</strong> ${esc(assessment.activity_type)}</div>
      <div><strong>Location:</strong> ${esc(assessment.location)}</div>
      <div><strong>Status:</strong> ${RA_STATUS_LABELS[assessment.status] || assessment.status}</div>
      <div><strong>Overall Rating:</strong> ${assessment.risk_rating || '—'} (score ${assessment.risk_score || 0}/25)</div>
      <div><strong>Created by:</strong> ${esc(creatorName)}</div>
      <div><strong>Assigned reviewer:</strong> ${esc(reviewerName)}</div>
      <div><strong>Review due:</strong> ${assessment.next_review_date ? new Date(assessment.next_review_date).toLocaleDateString('en-GB') : '—'}</div>
      <div><strong>Last reviewed:</strong> ${assessment.last_reviewed_at ? new Date(assessment.last_reviewed_at).toLocaleDateString('en-GB') : '—'}</div>
    </div>
    ${assessment.summary ? `<p>${esc(assessment.summary)}</p>` : ''}
    <h2>Hazards &amp; Control Measures</h2>
    <table><thead><tr><th>#</th><th>Hazard</th><th>Who's at risk</th><th>Initial risk</th><th>Control measures</th><th>Residual</th></tr></thead>
    <tbody>${hazardRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No hazards recorded</td></tr>'}</tbody></table>
    ${emergencyBlocks ? `<h2>Emergency Plan</h2>${emergencyBlocks}` : ''}
    <div class="foot">Generated ${new Date().toLocaleString('en-GB')} · ${esc(org?.name || '')} · Powered by LaunchSession</div>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 300)
}
