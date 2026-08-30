import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'

// Audience builder.
//
// Four fixed role toggles became: roles, narrowing filters, a resolved list you
// can untick person by person, hand-added outside addresses, and saved lists to
// reuse all of it.
//
// The resolved list comes from resolve_newsletter_audience, the same function
// the send route calls. That is the point -- what you see ticked here is
// literally what will be mailed, rather than two pieces of code that agree
// until one of them changes.

const ROLES = [
  { key: 'parent', label: 'Parents' },
  { key: 'volunteer', label: 'Volunteers' },
  { key: 'staff', label: 'Staff' },
  { key: 'admin', label: 'Admins' },
]

const miniLabel = {
  fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: 0.7, marginBottom: 7, display: 'block',
}
const inp = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
  border: '1.5px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', color: 'var(--text)',
}

function Chip({ active, onClick, children, primary, title }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={active} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5,
      fontWeight: 800, fontFamily: 'inherit', transition: 'all 0.15s',
      border: `1.5px solid ${active ? primary : 'var(--border)'}`,
      background: active ? primary : 'transparent',
      color: active ? '#fff' : 'var(--text3)',
    }}>
      <span aria-hidden="true" style={{ fontSize: 11, opacity: active ? 1 : 0.35 }}>{active ? '✓' : '+'}</span>
      {children}
    </button>
  )
}

export default function AudienceBuilder({
  org, primary,
  roles, setRoles,
  groupNames, setGroupNames,
  projectIds, setProjectIds,
  manualEmails, setManualEmails,
  excludedEmails, setExcludedEmails,
  onResolved,
}) {
  const [options, setOptions] = useState({ group: [], project: [] })
  const [people, setPeople] = useState(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [lists, setLists] = useState([])
  const [savingList, setSavingList] = useState(false)

  const loadLists = useCallback(async () => {
    const { data } = await supabase.from('newsletter_lists').select('*')
      .eq('org_id', org?.id).order('name')
    setLists(data || [])
  }, [org?.id])

  useEffect(() => {
    supabase.rpc('newsletter_filter_options').then(({ data }) => {
      const groups = (data || []).filter(d => d.kind === 'group')
      const projects = (data || []).filter(d => d.kind === 'project')
      setOptions({ group: groups, project: projects })
    })
    loadLists()
  }, [loadLists])

  // Filters describe young people, so they cannot narrow volunteers or staff.
  // The resolver drops those roles entirely when a filter is on; saying so here
  // is better than letting the count quietly shrink.
  const filtersOn = groupNames.length > 0 || projectIds.length > 0
  const filteredOutRoles = filtersOn && roles.some(r => r !== 'parent')

  useEffect(() => {
    let cancelled = false
    if (!org?.id || roles.length === 0) { setPeople([]); return undefined }
    setPeople(null); setError('')
    supabase.rpc('resolve_newsletter_audience', {
      p_org_id: org.id,
      p_roles: roles,
      p_group_names: groupNames,
      p_project_ids: projectIds,
      p_manual_emails: manualEmails,
      p_excluded_emails: excludedEmails,
    }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) { setError(err.message); setPeople([]); return }
      setPeople(data || [])
      if (onResolved) onResolved(data || [])
    })
    return () => { cancelled = true }
  }, [org?.id, roles, groupNames, projectIds, manualEmails, excludedEmails, onResolved])

  const toggle = (arr, setArr, v) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  const addManual = () => {
    const e = newEmail.trim().toLowerCase()
    if (!e || !e.includes('@')) return
    if (!manualEmails.includes(e)) setManualEmails([...manualEmails, e])
    setNewEmail('')
  }

  const sendable = (people || []).filter(p => !p.suppressed)
  const suppressedCount = (people || []).length - sendable.length

  const saveAsList = async () => {
    const name = window.prompt('Name this list (e.g. "Autumn 2026 parents")')
    if (!name || !name.trim()) return
    setSavingList(true)
    const { error: err } = await supabase.from('newsletter_lists').insert([{
      org_id: org?.id,
      name: name.trim(),
      audience: { group_names: groupNames, project_ids: projectIds, roles },
      manual_emails: manualEmails,
      excluded_emails: excludedEmails,
    }])
    setSavingList(false)
    if (err) { setError(err.message); return }
    loadLists()
  }

  const applyList = (l) => {
    const a = l.audience || {}
    setRoles(a.roles || ['parent'])
    setGroupNames(a.group_names || [])
    setProjectIds(a.project_ids || [])
    setManualEmails(l.manual_emails || [])
    setExcludedEmails(l.excluded_emails || [])
  }

  const deleteList = async (l, e) => {
    e.stopPropagation()
    if (!window.confirm(`Delete the list "${l.name}"? This doesn't affect anyone's subscription.`)) return
    await supabase.from('newsletter_lists').delete().eq('id', l.id)
    loadLists()
  }

  return (
    <div>
      {lists.length > 0 && (
        <>
          <label style={miniLabel}>Saved lists</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            {lists.map(l => (
              <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button type="button" onClick={() => applyList(l)} style={{
                  padding: '7px 11px', borderRadius: '99px 0 0 99px', cursor: 'pointer',
                  border: '1.5px solid var(--border)', borderRight: 'none', background: 'transparent',
                  color: 'var(--text)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                }}>{l.name}</button>
                <button type="button" onClick={e => deleteList(l, e)} aria-label={`Delete ${l.name}`} style={{
                  padding: '7px 9px', borderRadius: '0 99px 99px 0', cursor: 'pointer',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text3)', fontSize: 11, fontFamily: 'inherit',
                }}><Icon name="✕" /></button>
              </span>
            ))}
          </div>
        </>
      )}

      <label style={miniLabel}>Who gets it</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {ROLES.map(r => (
          <Chip key={r.key} active={roles.includes(r.key)} primary={primary}
            onClick={() => toggle(roles, setRoles, r.key)}>{r.label}</Chip>
        ))}
      </div>

      {(options.group.length > 0 || options.project.length > 0) && (
        <>
          <label style={miniLabel}>Narrow it down <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· optional</span></label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
            {options.group.map(g => (
              <Chip key={`g-${g.id}`} active={groupNames.includes(g.id)} primary={primary}
                title={`${g.n} young ${g.n === 1 ? 'person' : 'people'}`}
                onClick={() => toggle(groupNames, setGroupNames, g.id)}>{g.label}</Chip>
            ))}
            {options.project.map(pr => (
              <Chip key={`p-${pr.id}`} active={projectIds.includes(pr.id)} primary={primary}
                title="Anyone who attended this project"
                onClick={() => toggle(projectIds, setProjectIds, pr.id)}>{pr.label}</Chip>
            ))}
          </div>
          {filteredOutRoles && (
            <div style={{ fontSize: 12, color: '#B45309', marginBottom: 12, lineHeight: 1.5 }}>
              Groups and projects only describe young people, so while a filter is on this goes to parents only.
            </div>
          )}
        </>
      )}

      <label style={{ ...miniLabel, marginTop: 6 }}>Also send to</label>
      <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
        <input style={inp} value={newEmail} placeholder="someone@example.org"
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }} />
        <button type="button" onClick={addManual} style={{
          padding: '10px 16px', borderRadius: 9, border: `1.5px solid ${primary}`,
          background: 'transparent', color: primary, fontWeight: 800, fontSize: 12.5,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>Add</button>
      </div>
      {manualEmails.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {manualEmails.map(e => (
            <span key={e} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 99, background: 'var(--border)', fontSize: 12, color: 'var(--text)',
            }}>
              {e}
              <button type="button" onClick={() => setManualEmails(manualEmails.filter(x => x !== e))}
                aria-label={`Remove ${e}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 11, padding: 0 }}><Icon name="✕" /></button>
            </span>
          ))}
        </div>
      )}

      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4,
      }}>
        {error && <div style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 8 }}>{error}</div>}

        {roles.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#B45309' }}>Nobody selected yet — choose at least one group above.</div>
        ) : people === null ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Working out who that is…</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                {sendable.length} {sendable.length === 1 ? 'person' : 'people'} will receive this
              </div>
              {people.length > 0 && (
                <button type="button" onClick={() => setExpanded(x => !x)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: primary, fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                }}>{expanded ? 'Hide the list' : 'Show and edit the list'}</button>
              )}
              {excludedEmails.length > 0 && (
                <button type="button" onClick={() => setExcludedEmails([])} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'var(--text3)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}>Re-add {excludedEmails.length} removed</button>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
              Someone in two groups still only gets one email.
              {suppressedCount > 0 && ` ${suppressedCount} ${suppressedCount === 1 ? 'person has' : 'people have'} unsubscribed and will be skipped.`}
            </div>

            {expanded && (
              <div style={{
                marginTop: 10, maxHeight: 260, overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: 10,
              }}>
                {people.map(p => (
                  <div key={p.email} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px',
                    borderBottom: '1px solid var(--border)', fontSize: 12.5,
                    opacity: p.suppressed ? 0.5 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={!p.suppressed}
                      disabled={p.suppressed}
                      onChange={() => setExcludedEmails([...excludedEmails, p.email])}
                      aria-label={`Remove ${p.email}`}
                    />
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.first_name ? `${p.first_name} · ` : ''}{p.email}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {p.suppressed ? 'Unsubscribed' : p.source}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {sendable.length > 0 && (
              <button type="button" onClick={saveAsList} disabled={savingList} style={{
                marginTop: 12, padding: '7px 13px', borderRadius: 99, cursor: 'pointer',
                border: '1.5px dashed var(--border)', background: 'transparent',
                color: 'var(--text3)', fontSize: 11.5, fontWeight: 800, fontFamily: 'inherit',
              }}>{savingList ? 'Saving…' : '+ Save this as a list'}</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
