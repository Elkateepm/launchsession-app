import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function Volunteers({ org, session }) {
  const [volunteers, setVolunteers] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('overview')
  const qrRef = useRef(null)

  const portalUrl = `${window.location.origin}/volunteer/${org?.slug}`
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    if (org?.id) loadVolunteers()
  }, [org?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'qr' && qrRef.current && !qrRef.current.querySelector('canvas')) {
      generateQR()
    }
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVolunteers() {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('org_id', org.id)
      .eq('role', 'volunteer')
      .order('created_at', { ascending: false })
    const all = data || []
    setVolunteers(all.filter(v => v.status !== 'pending'))
    setPending(all.filter(v => v.status === 'pending'))
    setLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg('')
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail.trim(), {
      redirectTo: `${window.location.origin}/volunteer/${org?.slug}`
    })
    if (error) { setInviteMsg('Error: ' + error.message); setInviting(false); return }
    await supabase.from('user_profiles').upsert({
      email: inviteEmail.trim(),
      full_name: inviteName.trim() || inviteEmail.split('@')[0],
      org_id: org.id,
      role: 'volunteer',
      status: 'active',
    })
    setInviteMsg('Invite sent to ' + inviteEmail.trim())
    setInviteEmail(''); setInviteName('')
    setInviting(false)
    loadVolunteers()
  }

  async function approveVolunteer(id) {
    await supabase.from('user_profiles').update({ status: 'active' }).eq('id', id)
    loadVolunteers()
  }

  async function rejectVolunteer(id) {
    await supabase.from('user_profiles').update({ status: 'rejected' }).eq('id', id)
    loadVolunteers()
  }

  async function removeVolunteer(id) {
    if (!window.confirm('Remove this volunteer?')) return
    await supabase.from('user_profiles').update({ role: 'removed' }).eq('id', id)
    loadVolunteers()
  }

  function copyLink() {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function generateQR() {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = () => {
      if (qrRef.current) {
        qrRef.current.innerHTML = ''
        new window.QRCode(qrRef.current, {
          text: portalUrl,
          width: 200, height: 200,
          colorDark: '#ffffff',
          colorLight: '#0d1117',
        })
      }
    }
    document.head.appendChild(script)
  }

  const tabBtn = (key, label, badge) => (
    <button onClick={() => setTab(key)} style={{
      padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      background: tab === key ? primary : 'rgba(255,255,255,0.05)',
      color: tab === key ? '#fff' : 'rgba(255,255,255,0.5)',
      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
    }}>
      {label}
      {badge > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{badge}</span>}
    </button>
  )

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Volunteers</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>Manage your volunteer team and portal access.</p>
      </div>

      {/* PORTAL LINK CARD */}
      <div style={{ background: `linear-gradient(135deg, ${primary}18, ${primary}08)`, border: `1px solid ${primary}33`, borderRadius: 16, padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Volunteer Portal</div>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, wordBreak: 'break-all' }}>{portalUrl}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Share this link with volunteers to let them sign in or register.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={copyLink} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${primary}44`, background: copied ? primary : 'transparent', color: copied ? '#fff' : primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
          <button onClick={() => setTab('qr')} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            QR Code
          </button>
          <a href={portalUrl} target="_blank" rel="noreferrer" style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            Open ↗
          </a>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabBtn('overview', `Volunteers (${volunteers.length})`)}
        {tabBtn('pending', 'Pending', pending.length)}
        {tabBtn('invite', 'Invite')}
        {tabBtn('qr', 'QR Code')}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading...</div>
          ) : volunteers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card-bg, rgba(255,255,255,0.03))', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>❤️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No volunteers yet</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Invite volunteers or share the portal link for self-registration.</div>
              <button onClick={() => setTab('invite')} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Invite a volunteer</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {volunteers.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}88, #6366f188)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {v.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.full_name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.email}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80', background: 'rgba(74,222,128,0.1)', borderRadius: 6, padding: '3px 8px' }}>Active</div>
                  <button onClick={() => removeVolunteer(v.id)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#FCA5A5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PENDING TAB */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card-bg, rgba(255,255,255,0.03))', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No pending requests</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#FCD34D', flexShrink: 0 }}>
                    {v.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.full_name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.email} · Registered {new Date(v.created_at).toLocaleDateString('en-GB')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveVolunteer(v.id)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => rejectVolunteer(v.id)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INVITE TAB */}
      {tab === 'invite' && (
        <div style={{ background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 480 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Invite a volunteer</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>They'll receive an email with a link to set their password and access the volunteer portal.</div>
          <form onSubmit={handleInvite}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Full name (optional)</label>
              <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Smith"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--input-bg, rgba(255,255,255,0.05))', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Email address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@email.com" required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--input-bg, rgba(255,255,255,0.05))', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {inviteMsg && <div style={{ fontSize: 13, color: inviteMsg.startsWith('Error') ? '#FCA5A5' : '#4ADE80', marginBottom: 14, fontWeight: 600 }}>{inviteMsg}</div>}
            <button type="submit" disabled={inviting} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: primary, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: inviting ? 0.7 : 1 }}>
              {inviting ? 'Sending...' : 'Send invite →'}
            </button>
          </form>
        </div>
      )}

      {/* QR TAB */}
      {tab === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 340 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Volunteer Portal QR</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, textAlign: 'center' }}>Print or display this QR code for volunteers to scan and access the portal.</div>
          <div ref={qrRef} style={{ background: '#0d1117', padding: 16, borderRadius: 12, marginBottom: 16 }} />
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', wordBreak: 'break-all', marginBottom: 16 }}>{portalUrl}</div>
          <button onClick={copyLink} style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${primary}44`, background: copied ? primary : 'transparent', color: copied ? '#fff' : primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
            {copied ? '✓ Copied link!' : 'Copy portal link'}
          </button>
        </div>
      )}
    </div>
  )
}
