import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ACCESS_MODULES, LEVEL_OPTIONS, allowedModules, UNGOVERNED_ROLES } from '../../lib/moduleAccess'

// Per-member module access, shown in the staff drawer.
//
// Three states per module, and the difference between two of them matters:
//   - "Inherit"  = no grant row; the person follows their role's template
//   - "No access" = a grant row with level 'none'; an explicit revoke that
//                   survives a later change to the role template
// Collapsing those two into one control would mean an admin could not revoke
// one person without also changing everyone on that role.
export default function MemberAccess({ member, org, viewerRole }) {
  const [grants, setGrants] = useState({})
  const [defaults, setDefaults] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  // Roles this layer does not govern at all -- admins (always full access) and
  // the portal roles (never reach the dashboard). The database refuses grants
  // for all four, so showing the editor would only produce a failed save.
  const ungovernedReason = UNGOVERNED_ROLES[member?.role]
  // Mirrors the database trigger. Enforced there; reflected here so the
  // control is disabled rather than failing on save.
  const viewerMayEdit = viewerRole === 'admin' || viewerRole === 'owner'
    || (viewerRole === 'manager' && !ungovernedReason && member?.role !== 'manager')

  const orgModules = allowedModules(org)

  const load = useCallback(async () => {
    if (!member?.id) return
    setLoading(true)
    const [g, d] = await Promise.all([
      supabase.from('module_access_grants').select('module_key, level').eq('user_id', member.id),
      supabase.from('module_access_defaults').select('module_key, level').eq('org_id', org.id).eq('role', member.role || 'staff'),
    ])
    setGrants(Object.fromEntries((g.data || []).map(r => [r.module_key, r.level])))
    setDefaults(Object.fromEntries((d.data || []).map(r => [r.module_key, r.level])))
    setLoading(false)
  }, [member?.id, member?.role, org?.id])

  useEffect(() => { load() }, [load])

  const setLevel = async (moduleKey, value) => {
    setSaving(moduleKey)
    setError('')
    let e
    if (value === 'inherit') {
      ({ error: e } = await supabase.from('module_access_grants')
        .delete().eq('user_id', member.id).eq('module_key', moduleKey))
      if (!e) setGrants(g => { const n = { ...g }; delete n[moduleKey]; return n })
    } else {
      ({ error: e } = await supabase.from('module_access_grants')
        .upsert({ org_id: org.id, user_id: member.id, module_key: moduleKey, level: value, granted_by: (await supabase.auth.getUser()).data.user?.id },
                { onConflict: 'org_id,user_id,module_key' }))
      if (!e) setGrants(g => ({ ...g, [moduleKey]: value }))
    }
    setSaving(null)
    // The trigger raises a readable message for every refusal ("you cannot
    // grant a higher level than you have yourself", and so on), so surface it
    // verbatim rather than replacing it with a generic failure.
    setError(e ? e.message : '')
  }

  if (ungovernedReason) {
    const isAdminTarget = member?.role === 'admin' || member?.role === 'owner'
    return (
      <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 18, fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 800, color: '#111827', marginBottom: 6 }}>
          {isAdminTarget ? 'Full access' : 'Not applicable'}
        </div>
        {ungovernedReason}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 20, color: '#9CA3AF', fontSize: 13 }}>Loading access…</div>

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
        Controls what {member.full_name || 'this person'} can reach. Enforced in the database, not just hidden in the menu.
        {!viewerMayEdit && <div style={{ color: '#B45309', marginTop: 8, fontWeight: 700 }}>Only an admin can change this person's access.</div>}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACCESS_MODULES.map(m => {
          const inherited = defaults[m.key]
          const current = grants[m.key] !== undefined ? grants[m.key] : 'inherit'
          const orgHas = orgModules.includes(m.key)
          return (
            <div key={m.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '11px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 17 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{m.label}</div>
                  {m.hint && <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{m.hint}</div>}
                </div>
                {!orgHas && (
                  <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '3px 8px', fontSize: 10.5, fontWeight: 800 }}>
                    Not on your plan
                  </span>
                )}
              </div>
              <select
                value={current}
                disabled={!viewerMayEdit || saving === m.key}
                onChange={e => setLevel(m.key, e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 9,
                  border: `1px solid ${current === 'none' ? '#FCA5A5' : '#e5e7eb'}`,
                  background: viewerMayEdit ? '#fff' : '#F9FAFB',
                  fontSize: 13, fontWeight: 600, color: '#111827',
                  cursor: viewerMayEdit ? 'pointer' : 'not-allowed',
                }}>
                <option value="inherit">
                  Inherit from role{inherited ? ` (${LEVEL_OPTIONS.find(o => o.key === inherited)?.label})` : ''}
                </option>
                {LEVEL_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 14, lineHeight: 1.6 }}>
        “Inherit” follows whatever the role template says, and changes with it. Setting a level here pins this
        person to it regardless.{' '}
        <span style={{ color: '#6B7280' }}>Set the role template in Settings → Access.</span>
      </div>
    </div>
  )
}
