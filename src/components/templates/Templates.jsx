import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const TYPES = [
  { key: 'session_plan', label: 'Session Plans',      icon: '📋', color: '#3B82F6', desc: 'Pre-built agendas and activity plans' },
  { key: 'email',        label: 'Email Templates',    icon: '✉️',  color: '#8B5CF6', desc: 'Comms for parents, staff and volunteers' },
  { key: 'register',     label: 'Register Templates', icon: '📝', color: '#10B981', desc: 'Pre-configured attendance sheets' },
  { key: 'onboarding',   label: 'Onboarding',         icon: '🚀', color: '#F97316', desc: 'Org setup blueprints and welcome flows' },
]

const lbl = { display: 'block', fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

function RichEditor({ value, onChange, placeholder, readOnly }) {
  const ref = useRef(null)
  const isFirst = useRef(true)
  useEffect(() => {
    if (ref.current && isFirst.current) {
      ref.current.innerHTML = value || ''
      isFirst.current = false
    }
  }, [value])
  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val)
    ref.current && onChange && onChange(ref.current.innerHTML)
  }
  const tb = (cmd, label, val = null) => (
    <button key={cmd+label} onMouseDown={e => { e.preventDefault(); exec(cmd, val) }}
      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
    >{label}</button>
  )
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {tb('bold','B')} {tb('italic','I')} {tb('underline','U')} {tb('insertUnorderedList','• List')} {tb('insertOrderedList','1. List')} {tb('formatBlock','H2','h2')} {tb('formatBlock','H3','h3')} {tb('formatBlock','P','p')} {tb('removeFormat','Clear')}
        </div>
      )}
      <div ref={ref} contentEditable={!readOnly} suppressContentEditableWarning
        onInput={() => !readOnly && ref.current && onChange && onChange(ref.current.innerHTML)}
        data-placeholder={placeholder || 'Start writing...'}
        style={{ minHeight: readOnly ? 120 : 200, padding: '14px 16px', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, outline: 'none' }}
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:var(--text3);pointer-events:none}[contenteditable] h2{font-size:1.2em;font-weight:800;margin:10px 0 5px}[contenteditable] h3{font-size:1.05em;font-weight:700;margin:8px 0 4px}[contenteditable] ul,[contenteditable] ol{padding-left:20px;margin:4px 0}[contenteditable] li{margin:2px 0}[contenteditable] p{margin:3px 0}`}</style>
    </div>
  )
}

function ViewModal({ template, onClose, onUse, onEdit, isOwn, using }) {
  const typeMeta = TYPES.find(t => t.key === template.type) || TYPES[0]
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(700px,94vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22 }}>{typeMeta.icon}</span>
              {template.is_global && !isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#38BDF8', background: 'rgba(56,189,248,0.12)', padding: '3px 8px', borderRadius: 999 }}>GLOBAL TEMPLATE</span>}
              {isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#86EFAC', background: 'rgba(34,197,94,0.12)', padding: '3px 8px', borderRadius: 999 }}>YOUR TEMPLATE</span>}
              {template.category && <span style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', background: 'rgba(124,58,237,0.12)', padding: '3px 8px', borderRadius: 999 }}>{template.category}</span>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{template.title}</div>
            {template.description && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{template.description}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)', width: 32, height: 32, cursor: 'pointer', fontSize: 16, flexShrink: 0, marginLeft: 12 }}>x</button>
        </div>
        {template.type === 'email' && template.content?.subject && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Subject Line</div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{template.content.subject}</div>
          </div>
        )}
        {template.content?.body && (
          <div style={{ marginBottom: 20 }}>
            <div style={lbl}>Content</div>
            <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: template.content.body }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Close</button>
          {isOwn ? (
            <button onClick={onEdit} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#2563EB,#7C3AED)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Edit This Template</button>
          ) : (
            <button onClick={onUse} disabled={using} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: using ? 'rgba(34,197,94,0.4)' : 'linear-gradient(90deg,#16A34A,#059669)', color: '#fff', fontWeight: 900, cursor: using ? 'not-allowed' : 'pointer' }}>{using ? 'Saving...' : '+ Use This Template'}</button>
          )}
        </div>
      </div>
    </>
  )
}

function EditModal({ template, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: template?.title || '',
    description: template?.description || '',
    category: template?.category || '',
    content: template?.content || { body: '' },
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setContent = (k, v) => setForm(f => ({ ...f, content: { ...f.content, [k]: v } }))
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(700px,94vw)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: '#38BDF8', fontWeight: 950 }}>EDIT TEMPLATE</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>{template.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={lbl}>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} style={inp} /></div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Description</label><input value={form.description} onChange={e => set('description', e.target.value)} style={inp} /></div>
        {template.type === 'email' && (
          <div style={{ marginBottom: 14 }}><label style={lbl}>Email Subject</label><input value={form.content.subject || ''} onChange={e => setContent('subject', e.target.value)} style={inp} /></div>
        )}
        <div style={{ marginBottom: 22 }}>
          <label style={lbl}>Content</label>
          <RichEditor value={form.content.body || ''} onChange={v => setContent('body', v)} placeholder="Edit your template content..." />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.title.trim()} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? 'rgba(37,99,235,0.4)' : 'linear-gradient(90deg,#2563EB,#7C3AED)', color: '#fff', fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </>
  )
}

export default function Templates({ org }) {
  const [activeType, setActiveType] = useState('session_plan')
  const [globalTemplates, setGlobalTemplates] = useState([])
  const [ownTemplates, setOwnTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [using, setUsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, color = '#22C55E') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [globalRes, ownRes] = await Promise.all([
      supabase.from('templates').select('*').eq('type', activeType).eq('is_global', true).eq('is_active', true).order('title'),
      supabase.from('templates').select('*').eq('type', activeType).eq('org_id', org.id).eq('is_active', true).order('created_at', { ascending: false }),
    ])
    setGlobalTemplates(globalRes.data || [])
    setOwnTemplates(ownRes.data || [])
    setLoading(false)
  }, [activeType, org.id])

  useEffect(() => { load() }, [load])

  const handleUse = async (template) => {
    setUsing(true)
    const { error } = await supabase.from('templates').insert({
      title: template.title + ' (copy)',
      description: template.description,
      type: template.type,
      category: template.category,
      content: template.content,
      is_global: false,
      org_id: org.id,
      is_active: true,
    })
    setUsing(false)
    if (error) { showToast('Failed to save: ' + error.message, '#EF4444'); return }
    showToast('Template saved to your library!')
    setViewModal(null)
    load()
  }

  const handleSaveEdit = async (form) => {
    setSaving(true)
    const { error } = await supabase.from('templates').update({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      content: form.content,
      updated_at: new Date().toISOString(),
    }).eq('id', editModal.id)
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, '#EF4444'); return }
    showToast('Template updated!')
    setEditModal(null)
    load()
  }

  const handleDelete = async (t) => {
    if (!window.confirm('Delete "' + t.title + '"?')) return
    await supabase.from('templates').update({ is_active: false }).eq('id', t.id)
    showToast('Template deleted')
    load()
  }

  const typeMeta = TYPES.find(t => t.key === activeType)
  const filteredGlobal = globalTemplates.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category||'').toLowerCase().includes(search.toLowerCase()))
  const filteredOwn = ownTemplates.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category||'').toLowerCase().includes(search.toLowerCase()))

  const TemplateCard = ({ t, isOwn }) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#86EFAC', background: 'rgba(34,197,94,0.1)', padding: '2px 7px', borderRadius: 999 }}>YOURS</span>}
            {!isOwn && <span style={{ fontSize: 10, fontWeight: 900, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: 999 }}>GLOBAL</span>}
            {t.category && <span style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', background: 'rgba(124,58,237,0.1)', padding: '2px 7px', borderRadius: 999 }}>{t.category}</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{t.title}</div>
          {t.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{t.description}</div>}
        </div>
        <div style={{ fontSize: 24, marginLeft: 10, flexShrink: 0 }}>{typeMeta.icon}</div>
      </div>
      {t.content?.body && (
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, maxHeight: 52, overflow: 'hidden', maskImage: 'linear-gradient(to bottom,black 50%,transparent 100%)' }}
          dangerouslySetInnerHTML={{ __html: t.content.body }} />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => setViewModal({ ...t, isOwn })} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View</button>
        {isOwn ? (
          <>
            <button onClick={() => setEditModal(t)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(37,99,235,0.08)', color: '#93C5FD', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Edit</button>
            <button onClick={() => handleDelete(t)} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#F87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Del</button>
          </>
        ) : (
          <button onClick={() => handleUse(t)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#16A34A,#059669)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>+ Use</button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: '#fff', padding: '10px 22px', borderRadius: 12, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
      )}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Template Library</div>
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>Browse global templates or manage your own custom versions.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 22 }}>
        {TYPES.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)} style={{ padding: '14px 12px', borderRadius: 14, border: activeType === t.key ? '1px solid ' + t.color + '55' : '1px solid var(--border)', background: activeType === t.key ? t.color + '14' : 'var(--surface)', color: activeType === t.key ? 'var(--text)' : 'var(--text3)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 18, marginBottom: 5 }}>{t.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{t.label}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={'Search ' + typeMeta.label.toLowerCase() + '...'} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading templates...</div>
      ) : (
        <>
          {filteredOwn.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#22C55E', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Your Templates ({filteredOwn.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {filteredOwn.map(t => <TemplateCard key={t.id} t={t} isOwn={true} />)}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#38BDF8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Global Library ({filteredGlobal.length})</div>
            {filteredGlobal.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{typeMeta.icon}</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No {typeMeta.label} yet</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Your platform admin is adding templates soon.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {filteredGlobal.map(t => <TemplateCard key={t.id} t={t} isOwn={false} />)}
              </div>
            )}
          </div>
        </>
      )}
      {viewModal && <ViewModal template={viewModal} isOwn={viewModal.isOwn} onClose={() => setViewModal(null)} onUse={() => handleUse(viewModal)} onEdit={() => { setViewModal(null); setEditModal(viewModal) }} using={using} />}
      {editModal && <EditModal template={editModal} onClose={() => setEditModal(null)} onSave={handleSaveEdit} saving={saving} />}
    </div>
  )
}
