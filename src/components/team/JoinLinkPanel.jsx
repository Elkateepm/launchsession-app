import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { QRCard } from '../shared/QRShareSheet'
import Icon from '../../lib/icons'
import { joinLinkUrl } from './teamJoin'

// The "Share a link or QR" side of Invite someone. One link per organisation
// (team_join_links). Whoever opens it can only ask to join; nobody is let in
// until someone approves the request on the Team page and picks a role.
export default function JoinLinkPanel({ org, primary }) {
  const [link, setLink] = useState(undefined) // undefined loading, null off
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('team_join_links').select('code').eq('org_id', org.id).maybeSingle()
    if (err) { setError(err.message); setLink(null); return }
    setLink(data || null)
  }, [org.id])
  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true); setError(null)
    const { data, error: err } = await supabase.from('team_join_links').insert({ org_id: org.id }).select('code').single()
    setBusy(false)
    if (err) { setError(err.message); return }
    setLink(data)
  }
  const turnOff = async () => {
    setBusy(true); setError(null)
    const { error: err } = await supabase.from('team_join_links').delete().eq('org_id', org.id)
    setBusy(false)
    if (err) { setError(err.message); return }
    setLink(null)
  }
  // A new code, so the old link and any printed QR code stop working.
  const replace = async () => {
    if (!window.confirm('Make a new link? The current link and QR code will stop working.')) return
    setBusy(true); setError(null)
    const del = await supabase.from('team_join_links').delete().eq('org_id', org.id)
    const ins = del.error ? del : await supabase.from('team_join_links').insert({ org_id: org.id }).select('code').single()
    setBusy(false)
    if (ins.error) { setError(ins.error.message); load(); return }
    setLink(ins.data)
  }

  const note = { fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }
  const ghost = {
    minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
  }

  if (link === undefined) return <div style={{ ...note, padding: '20px 0', textAlign: 'center' }}>Loading…</div>

  return (
    <div>
      <div style={{ ...note, marginBottom: 14 }}>
        Anyone with this link can ask to join {org.name}. Nobody gets in until you approve them on the Team page and choose their role.
      </div>
      {error && <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {link ? (
        <>
          <QRCard icon={<Icon name="👥" />} title={`Join ${org.name}`} subtitle="Scan to ask to join the team" url={joinLinkUrl(link.code)} primary={primary} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={replace} disabled={busy} style={ghost}>Make a new link</button>
            <button onClick={turnOff} disabled={busy} style={{ ...ghost, color: 'var(--danger-text)' }}>Turn link off</button>
          </div>
        </>
      ) : (
        <button onClick={create} disabled={busy} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary, color: '#fff',
          fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Creating…' : 'Create a join link'}</button>
      )}
    </div>
  )
}
