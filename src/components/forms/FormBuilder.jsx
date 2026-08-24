import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import FormQuestionRenderer, { QUESTION_TYPES, SMART_FIELDS, typeLabel } from './FormQuestionRenderer'
import Icon from '../../lib/icons'

// Form builder.
//
// The old builder showed every control for every field all the time: a type
// badge, a required checkbox, duplicate and remove links, and a permanent
// column of field types down the left. It read as configuring a database table.
//
// This shows the form as the respondent will see it and keeps configuration one
// click away. The canvas is the product; everything else is contextual.

const AUTOSAVE_MS = 800

const PURPOSES = [
  'Registration', 'Consent', 'Medical Information', 'Emergency Contacts',
  'Feedback', 'Survey', 'Session / Trip', 'Staff / Volunteer', 'General',
]

const newId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export default function FormBuilder({ org, initial, onSave, onCancel, onSaved }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#6D5DF6'

  const [form, setForm] = useState(() => {
    const base = initial || { name: '', description: '', fields: [], tag: 'Other', visibility: 'public' }
    return {
      ...base,
      tag: base.tag || 'Other',
      visibility: base.visibility || 'public',
      // Ids may be missing on older forms, and stable ids are what selection,
      // reordering and duplication all depend on.
      fields: (base.fields || []).map((f, i) => ({ ...f, id: f.id || `${newId()}_${i}` })),
    }
  })

  const [tab, setTab] = useState('build')          // build | recipients | settings | preview
  const [selectedId, setSelectedId] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [adderAt, setAdderAt] = useState(null)      // insertion index, or null
  const [menuFor, setMenuFor] = useState(null)
  const [previewData, setPreviewData] = useState({})
  const [smartOptions, setSmartOptions] = useState({})

  const formIdRef = useRef(initial?.id || null)
  const timerRef = useRef(null)
  const dirtyRef = useRef(false)
  const firstRun = useRef(true)
  // Serialises writes. Without it a slower earlier save can land after a newer
  // one and restore the older snapshot, and a publish during the first insert
  // sees no id yet and inserts a second row.
  const inFlightRef = useRef(null)
  const doWriteRef = useRef(null)
  const latestRef = useRef(form)
  latestRef.current = form

  const selected = form.fields.find(f => f.id === selectedId) || null

  // ------------------------------------------------------------- smart data
  const smartLoaded = useRef(false)
  const loadSmartOptions = useCallback(async () => {
    if (smartLoaded.current || !org?.id) return
    smartLoaded.current = true
    const [groups, sessions, projects] = await Promise.all([
      // Only the group name is needed, so this reads one column rather than
      // pulling child records the builder has no use for.
      supabase.from('children').select('bubble').eq('org_id', org.id).not('bubble', 'is', null),
      supabase.from('sessions').select('title').eq('org_id', org.id).order('session_date', { ascending: false }).limit(40),
      supabase.from('projects').select('name').eq('org_id', org.id).limit(40),
    ])
    setSmartOptions({
      groups: [...new Set((groups.data || []).map(r => r.bubble).filter(Boolean))].sort(),
      sessions: [...new Set((sessions.data || []).map(r => r.title).filter(Boolean))],
      projects: [...new Set((projects.data || []).map(r => r.name).filter(Boolean))],
    })
  }, [org?.id])

  // -------------------------------------------------------------- autosave
  const persist = useCallback(async snapshot => {
    if (!snapshot.name?.trim()) {
      // A form with no name cannot be meaningfully saved or found again, so hold
      // rather than writing an untitled row the user will never locate.
      setSaveState('idle')
      return { ok: false, reason: 'no_name' }
    }

    // Queue behind any save already running, so writes apply in order and the
    // insert that establishes the id completes before anything else uses it.
    const run = (inFlightRef.current || Promise.resolve()).then(() => doWriteRef.current(snapshot))
    inFlightRef.current = run.catch(() => {})
    return run
  }, [])

  const doWrite = useCallback(async snapshot => {
    setSaveState('saving')
    const payload = {
      name: snapshot.name,
      description: snapshot.description || null,
      fields: snapshot.fields,
      tag: snapshot.tag || 'Other',
      visibility: snapshot.visibility || 'public',
      purpose: snapshot.purpose || null,
      confirmation_message: snapshot.confirmation_message || null,
      closing_date: snapshot.closing_date || null,
      multi_step: !!snapshot.multi_step,
      status: snapshot.status || 'draft',
      is_active: (snapshot.status || 'draft') === 'active',
      updated_at: new Date().toISOString(),
    }

    let error
    if (formIdRef.current) {
      ({ error } = await supabase.from('org_forms').update(payload).eq('id', formIdRef.current).eq('org_id', org.id))
    } else {
      const { data, error: insErr } = await supabase.from('org_forms')
        .insert({ org_id: org.id, ...payload }).select('id').single()
      error = insErr
      // Record the new id immediately, or the next autosave inserts a second row.
      if (data?.id) formIdRef.current = data.id
    }

    if (error) { setSaveState('error'); return { ok: false, error } }

    // Only clear the dirty flag if nothing changed while this write was in
    // flight, otherwise the UI claims 'Saved' over unsaved edits.
    if (latestRef.current === snapshot) {
      dirtyRef.current = false
      setSaveState('saved')
    }
    onSaved?.()
    return { ok: true, id: formIdRef.current }
  }, [org?.id, onSaved])
  doWriteRef.current = doWrite

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    dirtyRef.current = true
    setSaveState(s => (s === 'error' ? 'error' : 'idle'))
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(form), AUTOSAVE_MS)
    return () => clearTimeout(timerRef.current)
  }, [form, persist])

  // Losing a half-built form to a stray tab close is the kind of thing people
  // never forgive an app for.
  useEffect(() => {
    const beforeUnload = e => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  // Leaving cancels the pending debounce, so flush first. Otherwise the last
  // thing typed is lost by an interface that has been saying 'Saved'.
  const leave = async () => {
    clearTimeout(timerRef.current)
    if (dirtyRef.current) await persist(latestRef.current)
    onCancel?.()
  }

  // ------------------------------------------------------------ field ops
  const patch = updater => setForm(f => ({ ...f, ...updater(f) }))

  const addField = (type, atIndex, smart) => {
    const base = smart
      ? {
          id: newId(), type: smart.type, label: smart.label, required: false,
          smartSource: smart.source,
          options: smartOptions[smart.source] || [],
        }
      : {
          id: newId(), type, label: '', required: false,
          options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
        }

    patch(f => {
      const fields = [...f.fields]
      fields.splice(atIndex ?? fields.length, 0, base)
      return { fields }
    })
    setSelectedId(base.id)
    setAdderAt(null)
  }

  const updateField = (id, changes) =>
    patch(f => ({ fields: f.fields.map(x => x.id === id ? { ...x, ...changes } : x) }))

  const removeField = id => {
    patch(f => ({ fields: f.fields.filter(x => x.id !== id) }))
    setSelectedId(cur => (cur === id ? null : cur))
    setMenuFor(null)
  }

  const duplicateField = id => {
    const copy = { ...form.fields.find(x => x.id === id), id: newId() }
    patch(f => {
      const idx = f.fields.findIndex(x => x.id === id)
      const fields = [...f.fields]
      fields.splice(idx + 1, 0, copy)
      return { fields }
    })
    setSelectedId(copy.id)
    setMenuFor(null)
  }

  const moveField = (id, delta) => {
    patch(f => {
      const idx = f.fields.findIndex(x => x.id === id)
      const to = idx + delta
      if (idx === -1 || to < 0 || to >= f.fields.length) return {}
      const fields = [...f.fields]
      const [m] = fields.splice(idx, 1)
      fields.splice(to, 0, m)
      return { fields }
    })
    setMenuFor(null)
  }

  // Escape backs out of editing rather than trapping people in the panel.
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { setSelectedId(null); setMenuFor(null); setAdderAt(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isDraft = (form.status || 'draft') !== 'active'

  const publish = async () => {
    const next = { ...form, status: 'active' }
    setForm(next)
    latestRef.current = next
    clearTimeout(timerRef.current)
    const result = await persist(next)
    // Leaving the builder on a failed write loses the form from this flow
    // entirely, and for a first insert would hand back a null id.
    if (!result?.ok) return
    onSave?.({ ...next, id: formIdRef.current })
  }

  // ---------------------------------------------------------------- chrome
  const SaveBadge = () => {
    const map = {
      saving: { text: 'Saving…', color: '#94A3B8' },
      saved: { text: 'Saved ✓', color: '#12B76A' },
      error: { text: "Couldn't save", color: '#DC2626' },
      idle: { text: '', color: '#94A3B8' },
    }
    const s = map[saveState]
    if (!s.text) return null
    return (
      <span style={{ fontSize: 12.5, fontWeight: 700, color: s.color, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {s.text}
        {saveState === 'error' && (
          <button onClick={() => persist(form)} style={{
            border: 'none', background: 'transparent', color: '#DC2626',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline',
          }}>Try again</button>
        )}
      </span>
    )
  }

  const TABS = [
    ['build', 'Build'], ['recipients', 'Recipients'],
    ['settings', 'Settings'], ['preview', 'Preview'],
  ]

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: isMobile ? 14 : 22 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={leave} style={{
          padding: '7px 13px', borderRadius: 9, border: '1px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 12.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}><Icon name="←" /> Forms</button>
        <div style={{ flex: 1 }} />
        <SaveBadge />
        <button onClick={publish} style={{
          padding: '10px 18px', borderRadius: 11, border: 'none',
          background: primary, color: '#fff', fontSize: 13.5, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{isDraft ? 'Publish Form' : 'Update Form'}</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${tab === key ? 'transparent' : '#E2E8F0'}`,
            background: tab === key ? primary : '#fff',
            color: tab === key ? '#fff' : '#64748B',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'build' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Canvas
              form={form}
              setForm={setForm}
              primary={primary}
              isMobile={isMobile}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              menuFor={menuFor}
              setMenuFor={setMenuFor}
              adderAt={adderAt}
              setAdderAt={idx => { if (idx !== null) loadSmartOptions(); setAdderAt(idx) }}
              addField={addField}
              updateField={updateField}
              removeField={removeField}
              duplicateField={duplicateField}
              moveField={moveField}
              smartOptions={smartOptions}
            />
          </div>

          {!isMobile && selected && (
            <QuestionEditor
              field={selected}
              primary={primary}
              onChange={changes => updateField(selected.id, changes)}
              onDuplicate={() => duplicateField(selected.id)}
              onDelete={() => removeField(selected.id)}
              onClose={() => setSelectedId(null)}
              hasResponses={!!initial?.id}
            />
          )}
        </div>
      )}

      {isMobile && selected && (
        <MobileEditorSheet
          field={selected}
          primary={primary}
          onChange={changes => updateField(selected.id, changes)}
          onDuplicate={() => duplicateField(selected.id)}
          onDelete={() => removeField(selected.id)}
          onClose={() => setSelectedId(null)}
          hasResponses={!!initial?.id}
        />
      )}

      {tab === 'recipients' && (
        <RecipientsPanel
          org={org}
          formId={formIdRef.current}
          form={form}
          primary={primary}
          isMobile={isMobile}
        />
      )}

      {tab === 'settings' && (
        <SettingsPanel form={form} setForm={setForm} primary={primary} />
      )}

      {tab === 'preview' && (
        <PreviewPanel form={form} primary={primary} value={previewData} onChange={setPreviewData} isMobile={isMobile} />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ canvas

function Canvas({
  form, setForm, primary, isMobile, selectedId, setSelectedId, menuFor, setMenuFor,
  adderAt, setAdderAt, addField, updateField, removeField, duplicateField, moveField, smartOptions,
}) {
  const [hoverGap, setHoverGap] = useState(null)

  return (
    <div style={{
      background: '#fff', border: '1px solid #ECE9F5', borderRadius: 18,
      padding: isMobile ? 18 : 28,
    }}>
      {/* Title and description are edited in place: they are content, not
          settings, and burying them in a panel made the canvas feel like a
          preview of someone else's form. */}
      <input
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Untitled form"
        aria-label="Form name"
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#0F172A',
          letterSpacing: -0.4, marginBottom: 6, fontFamily: 'inherit',
        }}
      />
      <input
        value={form.description || ''}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Add a short description (optional)"
        aria-label="Form description"
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          fontSize: 14.5, color: '#64748B', marginBottom: 22, fontFamily: 'inherit',
        }}
      />

      {form.fields.length === 0 && (
        <div style={{
          padding: '38px 22px', textAlign: 'center', border: '1.5px dashed #E2E8F0',
          borderRadius: 14, marginBottom: 14,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
            Your form is ready to build
          </div>
          <div style={{ fontSize: 13.5, color: '#8B87A3', marginBottom: 16 }}>
            Add your first question below.
          </div>
        </div>
      )}

      {form.fields.map((field, i) => {
        const isSel = selectedId === field.id
        return (
          <div key={field.id}>
            <InsertGap
              show={hoverGap === i || adderAt === i}
              onHover={v => setHoverGap(v ? i : null)}
              open={adderAt === i}
              onOpen={() => setAdderAt(adderAt === i ? null : i)}
              onPick={(type, smart) => addField(type, i, smart)}
              primary={primary}
              smartOptions={smartOptions}
            />

            <QuestionCard
              field={field}
              index={i}
              total={form.fields.length}
              selected={isSel}
              primary={primary}
              menuOpen={menuFor === field.id}
              onMenu={() => setMenuFor(menuFor === field.id ? null : field.id)}
              onSelect={() => setSelectedId(field.id)}
              onUpdate={changes => updateField(field.id, changes)}
              onDuplicate={() => duplicateField(field.id)}
              onDelete={() => removeField(field.id)}
              onMove={delta => moveField(field.id, delta)}
            />
          </div>
        )
      })}

      <div style={{ marginTop: 16 }}>
        <AddQuestionButton
          open={adderAt === form.fields.length}
          onOpen={() => setAdderAt(adderAt === form.fields.length ? null : form.fields.length)}
          onPick={(type, smart) => addField(type, form.fields.length, smart)}
          primary={primary}
          smartOptions={smartOptions}
        />
      </div>
    </div>
  )
}

function InsertGap({ show, onHover, open, onOpen, onPick, primary, smartOptions }) {
  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{ position: 'relative', height: show || open ? 'auto' : 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {(show || open) && (
        <div style={{ width: '100%', padding: '6px 0' }}>
          <AddQuestionButton open={open} onOpen={onOpen} onPick={onPick} primary={primary} subtle smartOptions={smartOptions} />
        </div>
      )}
    </div>
  )
}

function AddQuestionButton({ open, onOpen, onPick, primary, subtle, smartOptions }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) onOpen() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onOpen])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={onOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: '100%', padding: subtle ? '7px' : '13px', borderRadius: 11,
          border: `1.5px dashed ${open ? primary : '#E2E8F0'}`,
          background: subtle ? 'transparent' : '#fff',
          color: open ? primary : '#64748B',
          fontSize: subtle ? 12.5 : 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >+ Add question</button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 40,
              background: '#fff', border: '1px solid #ECE9F5', borderRadius: 14,
              padding: 8, boxShadow: '0 18px 44px -18px rgba(15,23,42,0.4)',
              maxHeight: 380, overflowY: 'auto',
            }}
          >
            <MenuHeading>Most used</MenuHeading>
            {QUESTION_TYPES.filter(t => t.group === 'common').map(t => (
              <MenuItem key={t.key} label={t.label} hint={t.hint} onClick={() => onPick(t.key)} />
            ))}

            <MenuHeading>More</MenuHeading>
            {QUESTION_TYPES.filter(t => t.group === 'more').map(t => (
              <MenuItem key={t.key} label={t.label} hint={t.hint} onClick={() => onPick(t.key)} />
            ))}

            <MenuHeading>From LaunchSession</MenuHeading>
            {SMART_FIELDS.map(sf => {
              const count = (smartOptions?.[sf.source] || []).length
              return (
                <MenuItem
                  key={sf.key}
                  label={`${sf.icon} ${sf.label}`}
                  hint={count ? `${count} available` : sf.hint}
                  disabled={!count}
                  onClick={() => onPick(sf.type, sf)}
                />
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const MenuHeading = ({ children }) => (
  <div style={{
    fontSize: 10.5, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.6,
    textTransform: 'uppercase', padding: '8px 10px 5px',
  }}>{children}</div>
)

function MenuItem({ label, hint, onClick, disabled }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 9,
        border: 'none', background: hover && !disabled ? '#F8FAFC' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 1 }}>{hint}</div>}
    </button>
  )
}

function QuestionCard({
  field, index, total, selected, primary, menuOpen, onMenu, onSelect,
  onUpdate, onDuplicate, onDelete, onMove,
}) {
  const [hover, setHover] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = e => { if (menuRef.current && !menuRef.current.contains(e.target)) onMenu() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen, onMenu])

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      style={{
        position: 'relative', padding: '16px 18px', borderRadius: 14, cursor: 'pointer',
        border: `1.5px solid ${selected ? primary : hover ? '#DDD6FE' : '#F1F5F9'}`,
        background: selected ? 'var(--org-a05)' : '#fff',
        transition: 'border-color 170ms ease, background 170ms ease',
        marginBottom: 4,
      }}
    >
      <FormQuestionRenderer field={field} accent={primary} />

      {/* Controls appear on hover or selection only. Shown permanently they
          turned every question into a row of buttons. */}
      {(hover || selected || menuOpen) && (
        <div ref={menuRef} style={{ position: 'absolute', top: 10, right: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); onMenu() }}
            aria-label="Question options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              border: 'none', background: 'transparent', color: '#94A3B8',
              fontSize: 17, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
              fontWeight: 800,
            }}
          >⋯</button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 40,
              background: '#fff', border: '1px solid #ECE9F5', borderRadius: 12,
              padding: 6, minWidth: 190, boxShadow: '0 18px 44px -18px rgba(15,23,42,0.4)',
            }}>
              <MenuItem label="Edit" onClick={e => { onSelect(); onMenu() }} />
              <MenuItem label="Duplicate" onClick={onDuplicate} />
              <MenuItem
                label={field.required ? 'Make optional' : 'Make required'}
                onClick={() => { onUpdate({ required: !field.required }); onMenu() }}
              />
              <MenuItem label="Move up" disabled={index === 0} onClick={() => onMove(-1)} />
              <MenuItem label="Move down" disabled={index === total - 1} onClick={() => onMove(1)} />
              <div style={{ height: 1, background: '#F1F5F9', margin: '5px 8px' }} />
              <MenuItem label="Delete" onClick={onDelete} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------- editor panel

function EditorBody({ field, primary, onChange, onDuplicate, onDelete, hasResponses }) {
  const [showMore, setShowMore] = useState(!!field.description)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  }

  const setOption = (i, v) =>
    onChange({ options: (field.options || []).map((o, idx) => idx === i ? v : o) })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <label style={label}>QUESTION</label>
        <input
          autoFocus
          value={field.label || ''}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="What are you asking?"
          style={input}
        />
      </div>

      <div>
        <label style={label}>ANSWER TYPE</label>
        <select
          value={field.type}
          onChange={e => {
            const type = e.target.value
            // Moving to a choice type with no options leaves an unusable
            // dropdown, so seed it.
            onChange({
              type,
              options: type === 'select' ? (field.options?.length ? field.options : ['Option 1', 'Option 2']) : undefined,
            })
          }}
          style={input}
        >
          {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {field.smartSource && (
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 6, lineHeight: 1.45 }}>
            Options come from your organisation's {field.smartSource}. Editing them here
            only changes this form.
          </div>
        )}
      </div>

      {field.type === 'select' && (
        <div>
          <label style={label}>OPTIONS</label>
          <div style={{ display: 'grid', gap: 6 }}>
            {(field.options || []).map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input value={o} onChange={e => setOption(i, e.target.value)} style={{ ...input, flex: 1 }} />
                {(field.options || []).length > 1 && (
                  <button
                    onClick={() => onChange({ options: field.options.filter((_, idx) => idx !== i) })}
                    aria-label={`Remove option ${o}`}
                    style={{
                      border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8',
                      borderRadius: 9, cursor: 'pointer', padding: '0 11px', fontSize: 15,
                    }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => onChange({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
            style={{
              marginTop: 7, padding: '8px 13px', borderRadius: 9, border: '1px dashed #E2E8F0',
              background: '#fff', color: primary, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >+ Add option</button>
        </div>
      )}

      {field.type === 'checkbox' && (
        <div>
          <label style={label}>TICK BOX TEXT</label>
          <input
            value={field.checkboxText || ''}
            onChange={e => onChange({ checkboxText: e.target.value })}
            placeholder="Yes, I confirm"
            style={input}
          />
        </div>
      )}

      <button
        onClick={() => onChange({ required: !field.required })}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
          borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          border: `1.5px solid ${field.required ? primary : '#E2E8F0'}`,
          background: field.required ? 'var(--org-a05)' : '#fff',
        }}
      >
        <span style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          display: 'grid', placeItems: 'center', fontSize: 11, color: '#fff',
          border: `1.5px solid ${field.required ? primary : '#CBD5E1'}`,
          background: field.required ? primary : '#fff',
        }}>{field.required ? '✓' : ''}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>Required</span>
      </button>

      <button
        onClick={() => setShowMore(v => !v)}
        style={{
          border: 'none', background: 'transparent', color: '#64748B',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'left', padding: 0,
        }}
      >More options {showMore ? '▴' : '▾'}</button>

      {showMore && (
        <div>
          <label style={label}>HELPER TEXT</label>
          <textarea
            value={field.description || ''}
            onChange={e => onChange({ description: e.target.value })}
            rows={2}
            placeholder="Shown under the question to explain what you need"
            style={{ ...input, resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{ height: 1, background: '#F1F5F9' }} />

      <button onClick={onDuplicate} style={{
        border: 'none', background: 'transparent', color: '#334155',
        fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        textAlign: 'left', padding: 0,
      }}>Duplicate question</button>

      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} style={{
          border: 'none', background: 'transparent', color: '#DC2626',
          fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'left', padding: 0,
        }}>Delete question</button>
      ) : (
        <div style={{
          padding: 12, borderRadius: 11, background: '#FEF2F2', border: '1px solid #FECACA',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#B42318', marginBottom: 5 }}>
            Remove this question?
          </div>
          {hasResponses && (
            // Answers already given stay in their submissions. Saying so stops
            // people avoiding a tidy-up they are entitled to make.
            <div style={{ fontSize: 12.5, color: '#7A271A', lineHeight: 1.5, marginBottom: 9 }}>
              Answers already submitted are kept in those responses. The question just
              stops appearing for new ones.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{
              padding: '8px 13px', borderRadius: 9, border: '1px solid #FECACA',
              background: '#fff', color: '#7A271A', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={onDelete} style={{
              padding: '8px 13px', borderRadius: 9, border: 'none',
              background: '#DC2626', color: '#fff', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionEditor(props) {
  return (
    <div style={{
      width: 320, flexShrink: 0, background: '#fff',
      border: '1px solid #ECE9F5', borderRadius: 18, padding: 20,
      position: 'sticky', top: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', flex: 1 }}>Edit question</div>
        <button onClick={props.onClose} aria-label="Close editor" style={{
          border: 'none', background: 'transparent', fontSize: 19, color: '#94A3B8',
          cursor: 'pointer', lineHeight: 1, padding: 2,
        }}>×</button>
      </div>
      <EditorBody {...props} />
    </div>
  )
}

function MobileEditorSheet(props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300, background: '#fff',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #ECE9F5',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button onClick={props.onClose} style={{
          border: 'none', background: 'transparent', color: '#64748B',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
        }}><Icon name="←" /> Question</button>
        <div style={{ flex: 1 }} />
        <button onClick={props.onClose} style={{
          padding: '8px 16px', borderRadius: 10, border: 'none',
          background: props.primary, color: '#fff', fontSize: 13.5, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Done</button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto', flex: 1, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
        <EditorBody {...props} />
      </div>
    </div>
  )
}

// --------------------------------------------------------------- settings

function SettingsPanel({ form, setForm, primary }) {
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
    border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  }
  const set = changes => setForm(f => ({ ...f, ...changes }))

  return (
    <div style={{
      background: '#fff', border: '1px solid #ECE9F5', borderRadius: 18,
      padding: 24, maxWidth: 620, display: 'grid', gap: 18,
    }}>
      <div>
        <label style={label}>PURPOSE</label>
        <select value={form.purpose || ''} onChange={e => set({ purpose: e.target.value })} style={input}>
          <option value="">Not set</option>
          {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <label style={label}>WHO CAN RESPOND?</label>
        <select value={form.visibility || 'public'} onChange={e => set({ visibility: e.target.value })} style={input}>
          <option value="public">Anyone with the link</option>
          <option value="private">Staff only</option>
        </select>
        {form.visibility === 'public' && (
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
            Anyone with the link can respond. No sign-in required.
          </div>
        )}
      </div>

      <div>
        <label style={label}>CLOSING DATE</label>
        <input type="date" value={form.closing_date || ''} onChange={e => set({ closing_date: e.target.value || null })} style={input} />
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
          After this date the form stops accepting responses and says so.
        </div>
      </div>

      <button
        onClick={() => set({ multi_step: !form.multi_step })}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px',
          borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          border: `1.5px solid ${form.multi_step ? primary : '#E2E8F0'}`,
          background: form.multi_step ? 'var(--org-a05)' : '#fff',
        }}
      >
        <span style={{
          width: 19, height: 19, borderRadius: 6, flexShrink: 0,
          display: 'grid', placeItems: 'center', fontSize: 12, color: '#fff',
          border: `1.5px solid ${form.multi_step ? primary : '#CBD5E1'}`,
          background: form.multi_step ? primary : '#fff',
        }}>{form.multi_step ? '✓' : ''}</span>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
            Split long forms into steps
          </span>
          <span style={{ display: 'block', fontSize: 12, color: '#64748B', marginTop: 2 }}>
            Only applies once there are more than eight questions.
          </span>
        </span>
      </button>

      <div>
        <label style={label}>CONFIRMATION MESSAGE</label>
        <textarea
          value={form.confirmation_message || ''}
          onChange={e => set({ confirmation_message: e.target.value })}
          rows={2}
          placeholder="Thanks, your response has been received."
          style={{ ...input, resize: 'vertical' }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- preview

function PreviewPanel({ form, primary, value, onChange, isMobile }) {
  const [device, setDevice] = useState('mobile')
  const width = device === 'mobile' ? 400 : '100%'

  return (
    <div>
      {!isMobile && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['mobile', 'Mobile'], ['desktop', 'Desktop']].map(([k, l]) => (
            <button key={k} onClick={() => setDevice(k)} style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              border: `1px solid ${device === k ? 'transparent' : '#E2E8F0'}`,
              background: device === k ? primary : '#fff',
              color: device === k ? '#fff' : '#64748B',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>
      )}

      <div style={{
        maxWidth: width, margin: device === 'mobile' && !isMobile ? '0 auto' : 0,
        background: '#fff', border: '1px solid #ECE9F5', borderRadius: 18, padding: 24,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>
          {form.name || 'Untitled form'}
        </div>
        {form.description && (
          <div style={{ fontSize: 14.5, color: '#64748B', marginBottom: 20, lineHeight: 1.55 }}>
            {form.description}
          </div>
        )}

        {form.fields.length === 0 && (
          <div style={{ fontSize: 13.5, color: '#94A3B8', padding: '20px 0' }}>
            No questions yet.
          </div>
        )}

        <div style={{ display: 'grid', gap: 18 }}>
          {form.fields.map(f => (
            <FormQuestionRenderer
              key={f.id}
              field={f}
              accent={primary}
              interactive
              value={value[f.label]}
              onChange={v => onChange({ ...value, [f.label]: v })}
            />
          ))}
        </div>

        {form.fields.length > 0 && (
          <button disabled style={{
            width: '100%', marginTop: 22, padding: '14px', borderRadius: 12, border: 'none',
            background: primary, color: '#fff', fontSize: 15.5, fontWeight: 800,
            opacity: 0.85, fontFamily: 'inherit', cursor: 'not-allowed',
          }}>Submit</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12 }}>
        This is a preview. Nothing here is submitted.
      </div>
    </div>
  )
}

export { typeLabel }

// ------------------------------------------------------------- recipients

/**
 * Who the form is for, and who has not replied.
 *
 * The point of holding recipients at all is that "3 parents haven't completed
 * this" is answerable without anyone comparing a response list against a
 * register by hand. A submission ticks its recipient off automatically via a
 * database trigger matching on email.
 */
function RecipientsPanel({ org, formId, form, primary, isMobile }) {
  const [recipients, setRecipients] = useState([])
  const [children, setChildren] = useState([])
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState([])
  const [bubble, setBubble] = useState('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!formId) { setLoading(false); return }
    setLoading(true)
    const [{ data: recs }, { data: kids }] = await Promise.all([
      supabase.from('form_recipients').select('*').eq('form_id', formId).order('recipient_name'),
      supabase.from('children').select('id, first_name, surname, bubble, parent_name, parent_email')
        .eq('org_id', org.id).order('surname'),
    ])
    setRecipients(recs || [])
    setChildren(kids || [])
    setLoading(false)
  }, [formId, org?.id])

  useEffect(() => { load() }, [load])

  const bubbles = [...new Set(children.map(c => c.bubble).filter(Boolean))]
  const visible = bubble === 'all' ? children : children.filter(c => c.bubble === bubble)
  const already = new Set(recipients.map(r => r.child_id).filter(Boolean))

  const completed = recipients.filter(r => r.status === 'completed')
  const outstanding = recipients.filter(r => r.status !== 'completed')
  const pct = recipients.length ? Math.round((completed.length / recipients.length) * 100) : 0

  async function addChosen() {
    if (!chosen.length) return
    setBusy(true); setError(null)
    const { error: e } = await supabase.rpc('add_form_recipients_from_children', {
      p_form_id: formId, p_child_ids: chosen,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    setChosen([]); setPicking(false)
    load()
  }

  const card = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 18, padding: 22 }

  if (!formId) {
    return (
      <div style={{ ...card, maxWidth: 620 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
          Give the form a name first
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.55 }}>
          Recipients attach to a saved form. Add a name on the Build tab and this
          will be ready.
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, display: 'grid', gap: 14 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
          Who is this for?
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.55, marginBottom: 16 }}>
          {form.visibility === 'public'
            ? 'Anyone with the link can respond. Adding recipients also lets you see who has and hasn\u2019t.'
            : 'Only staff can respond to this form.'}
        </div>

        {recipients.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                {completed.length} of {recipients.length} completed
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: primary }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: '#F1F5F9', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: primary, borderRadius: 8 }} />
            </div>
          </>
        )}

        <button onClick={() => setPicking(p => !p)} style={{
          padding: '10px 17px', borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        }}>{picking ? 'Close' : '+ Add recipients'}</button>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
            border: '1px solid #FECACA', color: '#B42318', fontSize: 13,
          }}>{error}</div>
        )}
      </div>

      {picking && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all', ...bubbles].map(b => (
              <button key={b} onClick={() => setBubble(b)} style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                border: `1px solid ${bubble === b ? 'transparent' : '#E2E8F0'}`,
                background: bubble === b ? primary : '#fff',
                color: bubble === b ? '#fff' : '#64748B',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{b === 'all' ? 'Everyone' : b}</button>
            ))}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {visible.map(c => {
              const added = already.has(c.id)
              const sel = chosen.includes(c.id)
              return (
                <button
                  key={c.id}
                  disabled={added}
                  onClick={() => setChosen(list => sel ? list.filter(x => x !== c.id) : [...list, c.id])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                    borderRadius: 10, textAlign: 'left', fontFamily: 'inherit',
                    border: `1px solid ${sel ? primary : '#F1F5F9'}`,
                    background: added ? '#F8FAFC' : sel ? 'var(--org-a05)' : '#fff',
                    cursor: added ? 'not-allowed' : 'pointer', opacity: added ? 0.55 : 1,
                  }}
                >
                  <span style={{
                    width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                    display: 'grid', placeItems: 'center', fontSize: 10, color: '#fff',
                    border: `1.5px solid ${sel ? primary : '#CBD5E1'}`,
                    background: sel ? primary : '#fff',
                  }}>{sel ? '\u2713' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                      {c.first_name} {c.surname}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8' }}>
                      {/* No parent email means the form can be shared but this
                          person can never be ticked off automatically. */}
                      {c.parent_email || 'No parent email on record'}
                    </span>
                  </span>
                  {added && <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Added</span>}
                </button>
              )
            })}
          </div>

          <button
            onClick={addChosen}
            disabled={!chosen.length || busy}
            style={{
              marginTop: 12, width: '100%', padding: '12px', borderRadius: 11, border: 'none',
              background: chosen.length && !busy ? primary : '#E2E8F0', color: '#fff',
              fontSize: 14, fontWeight: 800,
              cursor: chosen.length && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >{busy ? 'Adding\u2026' : `Add ${chosen.length || ''} recipient${chosen.length === 1 ? '' : 's'}`}</button>
        </div>
      )}

      {loading && <div style={{ ...card, color: '#94A3B8', fontSize: 13.5 }}>Loading\u2026</div>}

      {!loading && outstanding.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            Haven't replied ({outstanding.length})
          </div>
          {outstanding.some(r => !r.recipient_email) && (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 1.5 }}>
              Anyone without an email can still be sent the link, but their response
              can't be matched back automatically.
            </div>
          )}
          <div style={{ display: 'grid', gap: 5 }}>
            {outstanding.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 7, flexShrink: 0,
                  background: r.recipient_email ? '#F79009' : '#CBD5E1',
                }} />
                <span style={{ color: '#0F172A', flex: 1 }}>{r.recipient_name || 'Unnamed'}</span>
                {r.recipient_email ? (
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>{r.recipient_email}</span>
                ) : (
                  <span style={{ color: '#94A3B8', fontSize: 11.5, fontStyle: 'italic' }}>
                    no email — tick off by hand
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && completed.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
            Completed ({completed.length})
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {completed.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5 }}>
                <span style={{ color: '#12B76A', flexShrink: 0 }}>{'\u2713'}</span>
                <span style={{ color: '#0F172A', flex: 1 }}>{r.recipient_name || 'Unnamed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && recipients.length === 0 && !picking && (
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
            No recipients yet
          </div>
          <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.55 }}>
            Add people and LaunchSession will track who has replied. The public link
            keeps working either way.
          </div>
        </div>
      )}
    </div>
  )
}
