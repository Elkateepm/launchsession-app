import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { LS, IconGlyph } from './fundraisingShared'

const DEFAULT_DOCS = [
  { name: 'Annual accounts', category: 'accounts' },
  { name: 'Safeguarding policy', category: 'safeguarding' },
  { name: 'Risk assessment', category: 'policies' },
  { name: 'Public liability insurance', category: 'insurance' },
  { name: 'Constitution / governing document', category: 'constitution' },
  { name: 'Trustee / committee list', category: 'trustees' },
  { name: 'Most recent impact report', category: 'impact_report' },
]

const STATUS_META = {
  have: { label: 'Have it', color: '#16803C', bg: '#E7F6EC' },
  expiring_soon: { label: 'Expiring soon', color: '#B45309', bg: '#FEF3C7' },
  missing: { label: 'Missing', color: LS.muted, bg: '#F3F2F7' },
}

export default function DocumentVault({ org, isAdmin }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newDoc, setNewDoc] = useState({ name: '', category: 'other' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('fundraising_documents').select('*').eq('org_id', org.id).order('created_at')
    if ((data || []).length === 0 && isAdmin) {
      const { data: seeded } = await supabase.from('fundraising_documents').insert(DEFAULT_DOCS.map(d => ({ ...d, org_id: org.id, status: 'missing' }))).select()
      setDocs(seeded || [])
    } else {
      setDocs(data || [])
    }
    setLoading(false)
  }, [org.id, isAdmin])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    setDocs(d => d.map(x => x.id === id ? { ...x, status } : x))
    await supabase.from('fundraising_documents').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const addDoc = async () => {
    if (!newDoc.name) return
    const { data } = await supabase.from('fundraising_documents').insert({ ...newDoc, org_id: org.id, status: 'missing' }).select().single()
    if (data) { setDocs(d => [...d, data]); setNewDoc({ name: '', category: 'other' }); setShowAdd(false) }
  }

  const removeDoc = async (id) => {
    setDocs(d => d.filter(x => x.id !== id))
    await supabase.from('fundraising_documents').delete().eq('id', id)
  }

  const { haveCount, pct } = useMemo(() => {
    const haveCount = docs.filter(d => d.status === 'have').length
    return { haveCount, pct: docs.length ? Math.round((haveCount / docs.length) * 100) : 0 }
  }, [docs])

  const inp = { padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: LS.muted }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, padding: '18px 20px', background: LS.softGradient, border: `1px solid ${LS.lavenderBorder}`, borderRadius: 18 }}>
        <div style={{ width: 54, height: 54, borderRadius: 999, background: `conic-gradient(${LS.purple} ${pct}%, #fff 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: LS.text }}>{pct}%</div>
        </div>
        <div>
          <div style={{ fontSize: 14, color: LS.text, fontWeight: 700 }}>{haveCount} of {docs.length} documents ready</div>
          <div style={{ fontSize: 12, color: LS.muted, marginTop: 2 }}>Most funders ask for these before considering an application — worth keeping current.</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16, padding: '4px 18px', marginBottom: 18 }}>
        {docs.map((d, i) => {
          const meta = STATUS_META[d.status] || STATUS_META.missing
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i === docs.length - 1 ? 'none' : `1px solid ${LS.border}` }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconGlyph name="doc" color={meta.color} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: LS.text }}>{d.name}</div>
                <div style={{ fontSize: 11, color: LS.muted, marginTop: 1 }}>Updated {format(new Date(d.updated_at), 'd MMM yyyy')}</div>
              </div>
              {isAdmin ? (
                <select value={d.status} onChange={e => updateStatus(d.id, e.target.value)}
                  style={{ fontSize: 11.5, fontWeight: 700, color: meta.color, background: meta.bg, border: 'none', borderRadius: 20, padding: '5px 12px', cursor: 'pointer' }}>
                  <option value="missing">Missing</option>
                  <option value="have">Have it</option>
                  <option value="expiring_soon">Expiring soon</option>
                </select>
              ) : (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: meta.color, background: meta.bg, borderRadius: 20, padding: '5px 12px' }}>{meta.label}</span>
              )}
              {isAdmin && <button onClick={() => removeDoc(d.id)} title="Remove" style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 14, width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: -6 }}>✕</button>}
            </div>
          )
        })}
      </div>

      {isAdmin && (showAdd ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newDoc.name} onChange={e => setNewDoc(n => ({ ...n, name: e.target.value }))} placeholder="Document name" style={{ ...inp, flex: 1 }} />
          <button onClick={addDoc} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Add</button>
          <button onClick={() => setShowAdd(false)} style={{ padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff', color: LS.muted, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
          border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff', color: LS.purpleDark, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}>
          <IconGlyph name="plus" color={LS.purpleDark} size={13} /> Add document
        </button>
      ))}
    </div>
  )
}
