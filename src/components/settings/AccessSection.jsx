import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ACCESS_MODULES, TEMPLATABLE_ROLES, LEVEL_OPTIONS, allowedModules } from '../../lib/moduleAccess'

// The organisation's role template: what each role can reach by default.
// Individual people are adjusted from their profile in HR; this is the baseline
// everyone on a role inherits.
//
// Writing no row at all is meaningful — it means "as it has always been", which
// the database resolves through module_access_legacy_default. So the grid shows
// an explicit "Default" option rather than silently pre-selecting Full access
// and writing 20 rows the first time an admin opens this screen.
export default function AccessSection({ org, isAdmin }) {
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')
  const orgModules = allowedModules(org)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const { data, error: e } = await supabase
      .from('module_access_defaults')
      .select('role, module_key, level')
      .eq('org_id', org.id)
    if (e) setError(e.message)
    setRows(Object.fromEntries((data || []).map(r => [`${r.role}:${r.module_key}`, r.level])))
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const setCell = async (role, moduleKey, value) => {
    const cell = `${role}:${moduleKey}`
    setSaving(cell)
    setError('')
    let e
    if (value === 'default') {
      ({ error: e } = await supabase.from('module_access_defaults')
        .delete().eq('org_id', org.id).eq('role', role).eq('module_key', moduleKey))
      if (!e) setRows(r => { const n = { ...r }; delete n[cell]; return n })
    } else {
      ({ error: e } = await supabase.from('module_access_defaults')
        .upsert({ org_id: org.id, role, module_key: moduleKey, level: value },
                { onConflict: 'org_id,role,module_key' }))
      if (!e) setRows(r => ({ ...r, [cell]: value }))
    }
    setSaving(null)
    if (e) setError(e.message)
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', background: '#F8FAFC', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Admins only</div>
        <div style={{ fontSize: 14, color: '#64748B' }}>
          Role access defaults apply to everyone on a role, so only an admin can change them.
          Managers can still adjust one person at a time from their profile in HR.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Role access</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
          What each role can reach by default. Enforced in the database — a hidden menu item is also a blocked query.
          Admins and owners always have full access and do not appear here.
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>Module</th>
                {TEMPLATABLE_ROLES.map(r => (
                  <th key={r.key} style={{ textAlign: 'left', padding: '12px 10px', fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_MODULES.map(m => (
                <tr key={m.key}>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 15, marginRight: 8 }}>{m.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</span>
                    {!orgModules.includes(m.key) && (
                      <span style={{ marginLeft: 8, background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 800 }}>Not on plan</span>
                    )}
                  </td>
                  {TEMPLATABLE_ROLES.map(r => {
                    const cell = `${r.key}:${m.key}`
                    const value = rows[cell] !== undefined ? rows[cell] : 'default'
                    return (
                      <td key={r.key} style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                        <select
                          value={value}
                          disabled={saving === cell}
                          onChange={e => setCell(r.key, m.key, e.target.value)}
                          style={{
                            padding: '6px 8px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                            border: `1px solid ${value === 'none' ? '#FCA5A5' : '#e5e7eb'}`,
                            background: '#fff', cursor: 'pointer', minWidth: 110,
                          }}>
                          <option value="default">Default</option>
                          {LEVEL_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 14, lineHeight: 1.7 }}>
        <strong style={{ color: '#6B7280' }}>Default</strong> leaves the role as it has always behaved — it does not
        grant anything new. Individual people can be pinned above or below their role from their profile in HR,
        and a person-level setting always wins.
      </div>
    </div>
  )
}
