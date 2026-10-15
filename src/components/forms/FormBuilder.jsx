import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import FormQuestionRenderer, { QUESTION_TYPES, SMART_FIELDS, typeLabel } from './FormQuestionRenderer'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'
import { useTerms } from '../../context/OrgContext'
import { PANEL, BUTTON, QuestionToolbox, TemplateStarter, ReviewChecklist } from './FormBuilderWorkspace'
import { formIssues, templateDraft } from './formBuilderUtils'

const AUTOSAVE_MS = 800

const PURPOSES = [
  'Registration', 'Consent', 'Medical Information', 'Emergency Contacts',
  'Feedback', 'Survey', 'Session / Trip', 'Staff / Volunteer', 'General',
]

const newId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// Ticking "updates the child record" files a form under this tag, which is the
// section of the Forms list staff go to when chasing outstanding details.
export const CHILD_TAG = 'Child Onboarding & Maintenance'

// Columns on `children` a question may maintain, grouped the way the child
// profile is laid out so the list reads like the record it writes to.
// `has_medication` is deliberately absent: it duplicates `takes_medication`,
// and offering both invites a question being mapped to the one nothing reads.
const CHILD_TARGETS = [
  ['Child', [
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
    ['date_of_birth', 'Date of birth'],
    ['school', 'School'],
    ['group_name', 'Group'],
  ]],
  ['Parent / carer', [
    ['parent_name', 'Parent / carer name'],
    ['parent_email', 'Parent email'],
    ['parent_phone', 'Parent phone'],
    ['emergency_contact_name', 'Emergency contact name'],
    ['emergency_contact_phone', 'Emergency contact phone'],
  ]],
  ['Health', [
    ['allergies', 'Allergies'],
    ['medical_notes', 'Medical notes'],
    ['medication_details', 'Medication details'],
    ['takes_medication', 'Takes medication (yes / no)'],
    ['has_epipen', 'Has an EpiPen (yes / no)'],
    ['has_asthma', 'Has asthma (yes / no)'],
    ['has_diabetes', 'Has diabetes (yes / no)'],
  ]],
  ['Support', [
    ['sen', 'SEN / additional needs'],
    ['has_behaviour_plan', 'Has a behaviour plan (yes / no)'],
    ['behaviour_plan_notes', 'Behaviour plan notes'],
    ['notes', 'General notes'],
  ]],
  ['Consent', [
    ['travel_consent', 'Travel consent (yes / no)'],
    ['collection_restricted', 'Collection restricted (yes / no)'],
    ['sms_opt_out', 'SMS opt-out (yes / no)'],
  ]],
]

export default function FormBuilder({ org, initial, onSave, onCancel, onSaved }) {
  const isMobile = useIsMobile()
  const compact = useIsMobile(1180)
  const primary = org?.primary_color || '#6D5DF6'

  const [form, setForm] = useState(() => {
    const base = initial || { name: '', description: '', fields: [], tag: 'Other', visibility: 'public' }
    return {
      ...base,
      tag: base.tag || 'Other',
      visibility: base.visibility || 'public',
      updates_child: !!base.updates_child,
      update_mode: base.update_mode || 'review',
      // Ids may be missing on older forms, and stable ids are what selection,
      // reordering and duplication all depend on.
      fields: (base.fields || []).map((f, i) => ({ ...f, id: f.id || `${newId()}_${i}` })),
    }
  })

  const [tab, setTab] = useState('build')          // build | recipients | settings | preview
  const [selectedId, setSelectedId] = useState(null)
  const [saveState, setSaveState] = useState(initial?.id ? 'saved' : 'idle') // idle | saving | saved | error
  const [adderAt, setAdderAt] = useState(null)      // insertion index, or null
  const [menuFor, setMenuFor] = useState(null)
  const [previewData, setPreviewData] = useState({})
  const [smartOptions, setSmartOptions] = useState({})
  const [publishing, setPublishing] = useState(false)
  const [leaveError, setLeaveError] = useState(false)
  const publishingRef = useRef(false)
  const workspaceRef = useRef(null)
  useEffect(() => { workspaceRef.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' }) }, [tab])

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
      supabase.from('children').select('group_name').eq('org_id', org.id).not('group_name', 'is', null),
      supabase.from('sessions').select('title').eq('org_id', org.id).order('session_date', { ascending: false }).limit(40),
      supabase.from('projects').select('name').eq('org_id', org.id).limit(40),
    ])
    setSmartOptions({
      groups: [...new Set((groups.data || []).map(r => r.group_name).filter(Boolean))].sort(),
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

    if (snapshot.status === 'active' && formIssues(snapshot).length) {
      setSaveState('incomplete')
      return { ok: false, reason: 'incomplete' }
    }

    // Queue behind any save already running, so writes apply in order and the
    // insert that establishes the id completes before anything else uses it.
    const run = (inFlightRef.current || Promise.resolve()).then(() => doWriteRef.current(snapshot)).catch(error => {
      setSaveState('error')
      return { ok: false, error }
    })
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
      updates_child: !!snapshot.updates_child,
      update_mode: snapshot.update_mode === 'auto' ? 'auto' : 'review',
      // Only sent once the form has the setting, so saving still works on a
      // database without the column (20261009_public_reports.sql).
      ...(snapshot.creates_record !== undefined ? { creates_record: snapshot.creates_record || 'none' } : {}),
      status: snapshot.status || 'draft',
      is_active: (snapshot.status || 'draft') === 'active',
      updated_at: new Date().toISOString(),
    }

    let error
    if (formIdRef.current) {
      ({ error } = await supabase.from('org_forms').update(payload).eq('id', formIdRef.current).eq('org_id', org.id).select('id').single())
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
    if (firstRun.current) {
      firstRun.current = false
      if (initial?.id || !form.name?.trim()) return
    }
    dirtyRef.current = true
    setSaveState(s => (s === 'error' ? 'error' : 'idle'))
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(form), AUTOSAVE_MS)
    return () => clearTimeout(timerRef.current)
  }, [form, persist, initial?.id])

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
    if (dirtyRef.current || inFlightRef.current) {
      const result = await persist(latestRef.current)
      if (!result.ok) { setLeaveError(true); return }
    }
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

  const issues = formIssues(form)
  const changeTab = async nextTab => {
    setSelectedId(null)
    setAdderAt(null)
    setMenuFor(null)
    // Establish the form id before mounting recipients, including templates
    // that have not reached their first debounced save yet.
    if (nextTab === 'recipients' && !formIdRef.current && form.name.trim()) {
      clearTimeout(timerRef.current)
      await persist(latestRef.current)
    }
    setTab(nextTab)
  }

  const publish = async () => {
    if (publishingRef.current || issues.length) return
    publishingRef.current = true
    setPublishing(true)
    clearTimeout(timerRef.current)
    const next = { ...latestRef.current, status: 'active' }
    const result = await persist(next)
    publishingRef.current = false
    setPublishing(false)
    // A failed publish must not turn the draft into an active autosave.
    if (!result?.ok) return
    dirtyRef.current = false
    onSave?.({ ...next, id: formIdRef.current })
  }

  const useTemplate = template => {
    setForm(current => ({ ...current, ...templateDraft(template, newId) }))
    setSelectedId(null)
  }

  // ---------------------------------------------------------------- chrome
  const SaveBadge = () => {
    const map = {
      saving: { text: 'Saving…', color: 'var(--text-faint)' },
      saved: { text: 'Saved ✓', color: '#12B76A' },
      error: { text: "Couldn't save", color: 'var(--danger-text)' },
      incomplete: { text: 'Finish questions to save', color: 'var(--warn-text)' },
      idle: { text: form.name.trim() ? 'Unsaved changes' : 'Name your form to save', color: 'var(--text3)' },
    }
    const s = map[saveState]
    if (!s.text) return null
    return (
      <span role="status" style={{ fontSize: 12.5, fontWeight: 700, color: s.color, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {s.text}
        {saveState === 'error' && (
          <button onClick={() => persist(form)} style={{
            minHeight: 44, border: 'none', background: 'transparent', color: 'var(--danger-text)',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline',
          }}>Try again</button>
        )}
      </span>
    )
  }

  const TABS = [
    ['build', 'Questions', 'Write your form'], ['recipients', 'Recipients', 'Choose your audience'],
    ['settings', 'Settings', 'Set the details'], ['preview', 'Review', 'Try it, then publish'],
  ]
  const step = TABS.findIndex(([key]) => key === tab)
  const editorProps = selected ? {
    field: selected, primary,
    onChange: changes => updateField(selected.id, changes),
    onDuplicate: () => duplicateField(selected.id),
    onDelete: () => removeField(selected.id),
    onClose: () => setSelectedId(null),
    hasResponses: !!initial?.id, updatesChild: !!form.updates_child,
  } : null

  return (
    <fieldset ref={workspaceRef} disabled={publishing} style={{ border: 0, margin: 0, minWidth: 0, background: 'var(--surface2)', minHeight: '100%', padding: isMobile ? 14 : 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={leave} style={BUTTON}><Icon name="←" /> All forms</button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <SaveBadge />
          <button onClick={() => changeTab('preview')} style={{ ...BUTTON, background: primary, borderColor: primary, color: '#fff' }}><Icon name="view" /> Review form</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 15, flexShrink: 0, background: 'var(--org-a10)', color: primary }}><Icon name="forms" size={26} /></span>
        <div><div style={{ fontSize: 10.5, letterSpacing: 1.5, color: 'var(--org-ink)', fontWeight: 800, marginBottom: 4 }}>YOUR FORM WORKSPACE</div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 25 : 30, letterSpacing: -1, color: 'var(--text)' }}>Form studio<span style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 12, padding: '5px 8px', borderRadius: 6, background: isDraft ? 'var(--warn-bg)' : 'var(--ok-bg)', color: isDraft ? 'var(--warn-text)' : 'var(--ok-text)', fontSize: 11, letterSpacing: 0 }}>{isDraft ? 'Draft' : 'Live'}</span></h1>
        </div>
      </div>
      {!isDraft && <div role="note" style={{ ...PANEL, padding: 13, marginBottom: 16, color: 'var(--text3)', fontSize: 13 }}>This form is live. Complete edits save automatically to the shared form. Unfinished questions stay here until they are ready.</div>}
      {leaveError && <div role="alert" style={{ ...PANEL, padding: 16, marginBottom: 16, background: 'var(--warn-bg)', color: 'var(--warn-text)' }}>
        <strong>Your latest changes have not been saved.</strong><p style={{ fontSize: 13 }}>Check the form name and unfinished questions, or retry the save before leaving.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button onClick={() => setLeaveError(false)} style={BUTTON}>Keep editing</button><button onClick={() => { dirtyRef.current = false; onCancel?.() }} style={BUTTON}>Discard unsaved changes</button></div>
      </div>}
      <nav aria-label="Form building steps" style={{ ...PANEL, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', padding: isMobile ? 5 : 8, gap: 4, marginBottom: 22 }}>
        {TABS.map(([key, label, hint], index) => <button key={key} aria-current={tab === key ? 'step' : undefined} onClick={() => changeTab(key)} style={{ ...BUTTON, borderColor: 'transparent', padding: isMobile ? '10px 2px' : '12px 14px', justifyContent: isMobile ? 'center' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 5 : 10, background: tab === key ? 'var(--org-a10)' : 'transparent' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 27, height: 27, borderRadius: 9, flexShrink: 0, background: tab === key ? primary : 'var(--surface2)', color: tab === key ? '#fff' : 'var(--text3)', fontSize: 12 }}>{index + 1}</span>
          <span style={{ textAlign: isMobile ? 'center' : 'left' }}><span style={{ fontSize: isMobile ? 11 : 13, color: tab === key ? 'var(--org-ink)' : 'var(--text)' }}>{label}</span>{!compact && <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginTop: 3 }}>{hint}</span>}</span>
        </button>)}
      </nav>

      {tab === 'build' && <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
        <Canvas form={form} setForm={setForm} primary={primary} isMobile={isMobile}
          selectedId={selectedId} setSelectedId={setSelectedId} menuFor={menuFor} setMenuFor={setMenuFor}
          adderAt={adderAt} setAdderAt={idx => { if (idx !== null) loadSmartOptions(); setAdderAt(idx) }}
          addField={addField} updateField={updateField} removeField={removeField}
          duplicateField={duplicateField} moveField={moveField} smartOptions={smartOptions} onTemplate={useTemplate} />
        {!compact && <aside style={{ position: 'sticky', top: 16 }}>
          {selected ? <QuestionEditor key={selected.id} {...editorProps} /> : <QuestionToolbox primary={primary} onAdd={type => addField(type)} />}
        </aside>}
      </div>}
      {compact && selected && tab === 'build' && <MobileEditorSheet key={selected.id} {...editorProps} />}
      {tab === 'recipients' && <RecipientsPanel org={org} formId={formIdRef.current} form={form} primary={primary} isMobile={isMobile} />}
      {tab === 'settings' && <SettingsPanel form={form} setForm={setForm} primary={primary} />}
      {tab === 'preview' && <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
        <PreviewPanel form={form} org={org} primary={primary} value={previewData} onChange={setPreviewData} isMobile={isMobile} />
        <ReviewChecklist form={form} issues={issues} primary={primary} onPublish={publish} publishing={publishing} isDraft={isDraft} onFix={issue => { setTab(issue.tab); setSelectedId(issue.fieldId || null) }} />
      </div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <button disabled={step === 0} onClick={() => changeTab(TABS[step - 1][0])} style={{ ...BUTTON, opacity: step === 0 ? 0.4 : 1 }}><Icon name="←" /> Back</button>
        {step < 3 && <button onClick={() => changeTab(TABS[step + 1][0])} style={{ ...BUTTON, background: primary, borderColor: primary, color: '#fff' }}>Next: {TABS[step + 1][1]} <Icon name="→" /></button>}
      </div>
    </fieldset>
  )
}

// ------------------------------------------------------------------ canvas

function Canvas({
  form, setForm, primary, isMobile, selectedId, setSelectedId, menuFor, setMenuFor,
  adderAt, setAdderAt, addField, updateField, removeField, duplicateField, moveField, smartOptions, onTemplate,
}) {
  const [hoverGap, setHoverGap] = useState(null)

  return (
    <div style={{
      ...PANEL, minWidth: 0, borderTop: `4px solid ${primary}`,
      padding: isMobile ? 18 : 28,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: 'var(--text3)', marginBottom: 18 }}><span style={{ letterSpacing: 1, fontWeight: 800 }}>FORM DETAILS</span><span>{form.fields.length} questions · {form.fields.filter(f => f.required).length} required</span></div>
      {/* Title and description are edited in place: they are content, not
          settings, and burying them in a panel made the canvas feel like a
          preview of someone else's form. */}
      <input
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Untitled form"
        aria-label="Form name"
        style={{
          width: '100%', boxSizing: 'border-box', minHeight: 44, border: 'none', background: 'transparent',
          fontSize: isMobile ? 21 : 25, fontWeight: 900, color: 'var(--text)',
          letterSpacing: -0.4, marginBottom: 6, fontFamily: 'inherit',
        }}
      />
      <input
        value={form.description || ''}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Add a short description (optional)"
        aria-label="Form description"
        style={{
          width: '100%', boxSizing: 'border-box', minHeight: 44, border: 'none', background: 'transparent',
          fontSize: 16, color: 'var(--text3)', marginBottom: 22, fontFamily: 'inherit',
        }}
      />

      {form.fields.length === 0 && <TemplateStarter primary={primary} onUse={onTemplate} onBlank={() => addField('text', 0)} />}
      {form.fields.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Select a question to edit. Use the arrows to change its order.</div>}

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
          minHeight: 44, width: '100%', padding: subtle ? '7px' : '13px', borderRadius: 11,
          border: `1.5px dashed ${open ? primary : 'var(--border)'}`,
          background: subtle ? 'transparent' : 'var(--surface)',
          color: open ? 'var(--org-ink)' : 'var(--text3)',
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
              background: 'var(--surface)', border: '1px solid #ECE9F5', borderRadius: 14,
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
    fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 0.6,
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
        minHeight: 44, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 9,
        border: 'none', background: hover && !disabled ? 'var(--surface2)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>{hint}</div>}
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
      style={{
        position: 'relative', padding: '16px 18px', borderRadius: 14, cursor: 'pointer',
        border: `1.5px solid ${selected ? primary : hover ? 'var(--violet-border)' : 'var(--border-soft)'}`,
        background: selected ? 'var(--org-a05)' : 'var(--surface)',
        transition: 'border-color 170ms ease, background 170ms ease',
        marginBottom: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
        <button onClick={e => { e.stopPropagation(); onSelect() }} aria-label={`Edit question ${index + 1}: ${field.label || 'Untitled question'}`} style={{ ...BUTTON, padding: '6px 10px', fontSize: 11, background: selected ? 'var(--org-a10)' : 'var(--surface2)', borderColor: 'transparent' }}><span style={{ color: 'var(--org-ink)' }}>{String(index + 1).padStart(2, '0')}</span> {typeLabel(field.type)} <Icon name="edit" size={13} /></button>
        <div style={{ display: 'flex', paddingRight: 35 }}>
          {[[-1, '↑', 'up'], [1, '↓', 'down']].map(([delta, icon, label]) => <button key={delta} disabled={delta === -1 ? index === 0 : index === total - 1} aria-label={`Move question ${index + 1} ${label}`} onClick={e => { e.stopPropagation(); onMove(delta) }} style={{ ...BUTTON, width: 44, padding: 0, border: 'none', background: 'transparent', opacity: (delta === -1 ? index === 0 : index === total - 1) ? 0.3 : 1 }}><Icon name={icon} /></button>)}
        </div>
      </div>
      <FormQuestionRenderer field={field} accent={primary} />

      {/* Controls appear on hover or selection only. Shown permanently they
          turned every question into a row of buttons. */}
      {(
        <div ref={menuRef} style={{ position: 'absolute', top: 16, right: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); onMenu() }}
            aria-label={`Options for question ${index + 1}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              minHeight: 44, minWidth: 44, border: 'none', background: 'transparent', color: 'var(--text-faint)',
              fontSize: 17, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
              fontWeight: 800,
            }}
          >⋯</button>

          {menuOpen && (
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 40,
              background: 'var(--surface)', border: '1px solid #ECE9F5', borderRadius: 12,
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
              <div style={{ height: 1, background: 'var(--surface-hover)', margin: '5px 8px' }} />
              <MenuItem label="Delete" onClick={onDelete} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------- editor panel

function EditorBody({ field, primary, onChange, onDuplicate, onDelete, hasResponses, updatesChild }) {
  const terms = useTerms()
  const [showMore, setShowMore] = useState(!!field.description)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }
  const input = {
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: '1.5px solid var(--border)', minHeight: 44, fontSize: 16, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
  }

  const setOption = (i, v) =>
    onChange({ options: (field.options || []).map((o, idx) => idx === i ? v : o) })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <label style={label} htmlFor="question-label">QUESTION</label>
        <input
          id="question-label" autoFocus
          value={field.label || ''}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="What are you asking?"
          style={input}
        />
      </div>

      <div>
        <label style={label} htmlFor="question-type">ANSWER TYPE</label>
        <select
          id="question-type" value={field.type}
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
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.45 }}>
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
                <input aria-label={`Answer choice ${i + 1}`} value={o} onChange={e => setOption(i, e.target.value)} style={{ ...input, flex: 1 }} />
                {(field.options || []).length > 1 && (
                  <button
                    onClick={() => onChange({ options: field.options.filter((_, idx) => idx !== i) })}
                    aria-label={`Remove option ${o}`}
                    style={{
                      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-faint)',
                      minWidth: 44, minHeight: 44, borderRadius: 9, cursor: 'pointer', padding: '0 11px', fontSize: 15,
                    }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => onChange({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
            style={{
              minHeight: 44, marginTop: 7, padding: '8px 13px', borderRadius: 9, border: '1px dashed var(--border)',
              background: 'var(--surface)', color: 'var(--org-ink)', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >+ Add option</button>
        </div>
      )}

      {field.type === 'checkbox' && (
        <div>
          <label style={label}>TICK BOX TEXT</label>
          <input
            aria-label="Tick box text" value={field.checkboxText || ''}
            onChange={e => onChange({ checkboxText: e.target.value })}
            placeholder="Uses the question wording by default"
            style={input}
          />
        </div>
      )}

      {updatesChild && (
        <div>
          <label style={label}>SAVES TO</label>
          <select
            aria-label="Saves to record field" value={field.saves_to || ''}
            onChange={e => onChange({ saves_to: e.target.value || null })}
            style={input}
          >
            <option value="">Response only — don't touch the record</option>
            {CHILD_TARGETS.map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map(([key, lbl]) => <option key={key} value={key}>{lbl}</option>)}
              </optgroup>
            ))}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.45 }}>
            The answer maintains this field on the {terms.person}'s record. Leave it unset for
            questions that are only ever read on the response itself.
          </div>
        </div>
      )}

      <button
        role="switch" aria-checked={!!field.required} onClick={() => onChange({ required: !field.required })}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
          borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          border: `1.5px solid ${field.required ? primary : 'var(--border)'}`,
          background: field.required ? 'var(--org-a05)' : 'var(--surface)',
        }}
      >
        <span style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          display: 'grid', placeItems: 'center', fontSize: 11, color: '#fff',
          border: `1.5px solid ${field.required ? primary : 'var(--text-faint)'}`,
          background: field.required ? primary : 'var(--surface)',
        }}>{field.required ? '✓' : ''}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Required</span>
      </button>

      <button
        onClick={() => setShowMore(v => !v)}
        style={{
          border: 'none', background: 'transparent', color: 'var(--text3)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'left', padding: 0, minHeight: 44,
        }}
      >More options {showMore ? '▴' : '▾'}</button>

      {showMore && (
        <div>
          <label style={label}>HELPER TEXT</label>
          <textarea
            aria-label="Question helper text" value={field.description || ''}
            onChange={e => onChange({ description: e.target.value })}
            rows={2}
            placeholder="Shown under the question to explain what you need"
            style={{ ...input, resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{ height: 1, background: 'var(--surface-hover)' }} />

      <button onClick={onDuplicate} style={{
        border: 'none', background: 'transparent', color: 'var(--text2)',
        fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        textAlign: 'left', padding: 0, minHeight: 44,
      }}>Duplicate question</button>

      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} style={{
          border: 'none', background: 'transparent', color: 'var(--danger-text)',
          fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'left', padding: 0, minHeight: 44,
        }}>Delete question</button>
      ) : (
        <div style={{
          padding: 12, borderRadius: 11, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger-text)', marginBottom: 5 }}>
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
              minHeight: 44, padding: '8px 13px', borderRadius: 9, border: '1px solid var(--danger-border)',
              background: 'var(--surface)', color: '#7A271A', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={onDelete} style={{
              minHeight: 44, padding: '8px 13px', borderRadius: 9, border: 'none',
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
      width: '100%', boxSizing: 'border-box', background: 'var(--surface)',
      border: '1px solid #ECE9F5', borderRadius: 18, padding: 20,
      position: 'sticky', top: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', flex: 1 }}>Edit question</div>
        <button onClick={props.onClose} aria-label="Close editor" style={{
          minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', fontSize: 19, color: 'var(--text-faint)',
          cursor: 'pointer', lineHeight: 1, padding: 2,
        }}>×</button>
      </div>
      <EditorBody {...props} />
    </div>
  )
}

function MobileEditorSheet(props) {
  const sheetRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const trapFocus = event => {
      if (event.key !== 'Tab') return
      const targets = [...sheetRef.current.querySelectorAll('button:not(:disabled), input, select, textarea')]
      const first = targets[0], last = targets[targets.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const sheet = sheetRef.current
    sheet.addEventListener('keydown', trapFocus)
    return () => { sheet.removeEventListener('keydown', trapFocus); if (previous?.isConnected) previous.focus() }
  }, [])
  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Edit question" style={{
      position: 'fixed', inset: 0, zIndex: 1300, background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #ECE9F5',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button onClick={props.onClose} style={{
          border: 'none', background: 'transparent', color: 'var(--text3)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, minHeight: 44,
        }}><Icon name="←" /> Question</button>
        <div style={{ flex: 1 }} />
        <button onClick={props.onClose} style={{
          minHeight: 44, padding: '8px 16px', borderRadius: 10, border: 'none',
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
  const terms = useTerms()
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
    border: '1.5px solid var(--border)', minHeight: 44, fontSize: 16, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
  }
  const set = changes => setForm(f => ({ ...f, ...changes }))

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid #ECE9F5', borderRadius: 18,
      padding: 24, maxWidth: 760, boxSizing: 'border-box', display: 'grid', gap: 18,
    }}>
      <div><h2 style={{ margin: 0, fontSize: 21, color: 'var(--text)' }}>The finishing details</h2><p style={{ marginBottom: 0, fontSize: 13, color: 'var(--text3)' }}>Choose who can respond and what happens afterwards.</p></div>
      <div>
        <label style={label} htmlFor="form-purpose">PURPOSE</label>
        <select id="form-purpose" value={form.purpose || ''} onChange={e => set({ purpose: e.target.value })} style={input}>
          <option value="">Not set</option>
          {form.purpose && !PURPOSES.includes(form.purpose) && <option value={form.purpose}>{form.purpose.replace(/_/g, ' ')}</option>}
          {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <label style={label} htmlFor="form-visibility">WHO CAN RESPOND?</label>
        <select id="form-visibility" value={form.visibility || 'public'} onChange={e => set({ visibility: e.target.value })} style={input}>
          <option value="public">Anyone with the link</option>
          <option value="private">Staff only</option>
        </select>
        {form.visibility === 'public' && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Anyone with the link can respond. No sign-in required.
          </div>
        )}
      </div>

      <div>
        <label style={label} htmlFor="fb-creates-record">ALSO CREATES A RECORD</label>
        <select id="fb-creates-record" value={form.creates_record || 'none'} onChange={e => set({ creates_record: e.target.value })} style={input}>
          <option value="none">Nothing else</option>
          <option value="injury">An accident book entry</option>
          <option value="concern">A safeguarding concern</option>
        </select>
        {form.creates_record && form.creates_record !== 'none' && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            Every submission becomes {form.creates_record === 'injury' ? 'an entry in the accident book' : 'a concern in the safeguarding log'}, even from someone without an account.
            The standard report forms (Share, on Home) fill in its details; answers to other questions stay on the response, which the record links to.
          </div>
        )}
      </div>

      <div>
        <label style={label}>WHAT HAPPENS TO THE ANSWERS</label>
        <button
          onClick={() => setForm(f => {
            const on = !f.updates_child
            return {
              ...f,
              updates_child: on,
              // Turning this on files the form where staff look for it. Turning
              // it off only undoes that if nothing else has claimed the tag since.
              tag: on ? CHILD_TAG : (f.tag === CHILD_TAG ? 'Other' : f.tag),
            }
          })}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px',
            borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            border: `1.5px solid ${form.updates_child ? primary : 'var(--border)'}`,
            background: form.updates_child ? `${withAlpha(primary, '0D')}` : '#fff',
          }}
        >
          <span style={{
            width: 19, height: 19, borderRadius: 6, flexShrink: 0,
            display: 'grid', placeItems: 'center', fontSize: 12, color: '#fff',
            border: `1.5px solid ${form.updates_child ? primary : 'var(--text-faint)'}`,
            background: form.updates_child ? primary : 'var(--surface)',
          }}>{form.updates_child ? '✓' : ''}</span>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Answers update the {terms.person}'s record
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Map individual questions to record fields under Saves to, on each question.
            </span>
          </span>
        </button>

        {form.updates_child && (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {[
              ['review', 'Hold for review', 'Changes wait in the response until an admin approves them. Nothing on the record moves on its own.'],
              ['auto', 'Apply on submission', 'Mapped answers write straight to the record as soon as the form is submitted.'],
            ].map(([key, title, hint]) => {
              const on = (form.update_mode || 'review') === key
              return (
                <button
                  key={key}
                  onClick={() => set({ update_mode: key })}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 13px',
                    borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    border: `1.5px solid ${on ? primary : 'var(--border)'}`,
                    background: on ? `${withAlpha(primary, '0D')}` : '#fff',
                  }}
                >
                  <span style={{
                    width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    display: 'grid', placeItems: 'center',
                    border: `1.5px solid ${on ? primary : 'var(--text-faint)'}`, background: 'var(--surface)',
                  }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? primary : 'transparent' }} />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>{hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <label style={label} htmlFor="form-closing">CLOSING DATE</label>
        <input id="form-closing" type="date" value={form.closing_date || ''} onChange={e => set({ closing_date: e.target.value || null })} style={input} />
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
          After this date the form stops accepting responses and says so.
        </div>
      </div>

      <button
        onClick={() => set({ multi_step: !form.multi_step })}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px',
          borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          border: `1.5px solid ${form.multi_step ? primary : 'var(--border)'}`,
          background: form.multi_step ? 'var(--org-a05)' : 'var(--surface)',
        }}
      >
        <span style={{
          width: 19, height: 19, borderRadius: 6, flexShrink: 0,
          display: 'grid', placeItems: 'center', fontSize: 12, color: '#fff',
          border: `1.5px solid ${form.multi_step ? primary : 'var(--text-faint)'}`,
          background: form.multi_step ? primary : 'var(--surface)',
        }}>{form.multi_step ? '✓' : ''}</span>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Split long forms into steps
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Only applies once there are more than eight questions.
          </span>
        </span>
      </button>

      <div>
        <label style={label} htmlFor="form-confirmation">CONFIRMATION MESSAGE</label>
        <textarea
          id="form-confirmation" value={form.confirmation_message || ''}
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

function PreviewPanel({ form, org, primary, value, onChange, isMobile }) {
  const [device, setDevice] = useState('mobile')
  const [page, setPage] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const split = form.multi_step && form.fields.length > 8
  const pages = split ? Math.ceil(form.fields.length / 6) : 1
  const fields = split ? form.fields.slice(page * 6, page * 6 + 6) : form.fields
  const reset = () => { onChange({}); setPage(0); setSubmitted(false) }

  return <section style={{ minWidth: 0 }} aria-label="Form preview">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {!isMobile && [['mobile', '📱', 'Mobile'], ['desktop', 'view', 'Desktop']].map(([key, icon, label]) => <button key={key} onClick={() => setDevice(key)} aria-pressed={device === key} style={{ ...BUTTON, background: device === key ? 'var(--org-a10)' : 'var(--surface)', color: device === key ? 'var(--org-ink)' : 'var(--text3)' }}><Icon name={icon} /> {label}</button>)}
      </div><button onClick={reset} style={BUTTON}><Icon name="↻" /> Reset preview</button>
    </div>
    <div style={{ ...PANEL, maxWidth: device === 'mobile' ? 420 : 800, margin: '0 auto', overflow: 'hidden' }}>
      <div style={{ height: 6, background: primary }} />
      <div style={{ padding: isMobile ? 18 : 26 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--org-ink)', marginBottom: 20 }}>{org?.name || 'Your organisation'}</div>
        {submitted ? <div role="status" style={{ padding: '22px 0', textAlign: 'center' }}><Icon name="check" size={32} /><h2 style={{ fontSize: 22, color: 'var(--text)' }}>Thank you!</h2><p style={{ color: 'var(--text3)', lineHeight: 1.6 }}>{form.confirmation_message || 'Thanks, your response has been received.'}</p><button onClick={reset} style={BUTTON}>Try again</button></div> : <>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, margin: '0 0 8px', color: 'var(--text)', overflowWrap: 'anywhere' }}>{form.name || 'Untitled form'}</h2>
          {form.description && <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>{form.description}</p>}
          <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '14px 0 22px' }}>Fields marked * are required.{split && ` · Step ${page + 1} of ${pages}`}</p>
          <form onSubmit={e => { e.preventDefault(); if (page < pages - 1) setPage(p => p + 1); else setSubmitted(true) }}>
            <div style={{ display: 'grid', gap: 22 }}>
              {fields.map(field => <FormQuestionRenderer key={field.id} field={field} accent={primary} interactive value={value[field.id]} onChange={v => onChange({ ...value, [field.id]: v })} />)}
            </div>
            {!fields.length && <p style={{ color: 'var(--text3)' }}>Add a question to try your form.</p>}
            {fields.length > 0 && <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              {page > 0 && <button type="button" onClick={() => setPage(p => p - 1)} style={BUTTON}>Back</button>}
              <button type="submit" style={{ ...BUTTON, flex: 1, background: primary, borderColor: primary, color: '#fff' }}>{page < pages - 1 ? 'Continue' : 'Test submission'} <Icon name="→" /></button>
            </div>}
          </form>
        </>}
      </div>
    </div>
    <p style={{ color: 'var(--text3)', textAlign: 'center', fontSize: 12, marginTop: 14 }}>Preview only. Test answers are never sent or saved.</p>
  </section>
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
  const terms = useTerms()
  const [query, setQuery] = useState('')
  const [recipients, setRecipients] = useState([])
  const [children, setChildren] = useState([])
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState([])
  const [group, setGroup] = useState('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!formId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [recs, kids] = await Promise.all([
        supabase.from('form_recipients').select('*').eq('form_id', formId).eq('org_id', org.id).order('recipient_name'),
        supabase.from('children').select('id, first_name, last_name, group_name, parent_name, parent_email')
          .eq('org_id', org.id).order('last_name'),
      ])
      if (recs.error || kids.error) throw recs.error || kids.error
      setRecipients(recs.data || [])
      setChildren(kids.data || [])
    } catch (error) {
      setError('Recipients could not be loaded. Please try again.')
    }
    setLoading(false)
  }, [formId, org?.id])

  useEffect(() => { load() }, [load])

  const groupNames = [...new Set(children.map(c => c.group_name).filter(Boolean))]
  const visible = children.filter(c => (group === 'all' || c.group_name === group) && `${c.first_name} ${c.last_name} ${c.parent_name || ''} ${c.parent_email || ''}`.toLowerCase().includes(query.toLowerCase()))
  const already = new Set(recipients.map(r => r.child_id).filter(Boolean))

  const completed = recipients.filter(r => r.status === 'completed')
  const outstanding = recipients.filter(r => r.status !== 'completed')
  const pct = recipients.length ? Math.round((completed.length / recipients.length) * 100) : 0

  async function addChosen() {
    if (!chosen.length) return
    setBusy(true); setError(null)
    try {
      const { error: e } = await supabase.rpc('add_form_recipients_from_children', {
        p_form_id: formId, p_child_ids: chosen,
      })
      if (e) throw e
      setChosen([]); setPicking(false)
      await load()
    } catch (error) {
      setError('Recipients could not be added. Your selection is kept; please try again.')
    } finally { setBusy(false) }
  }

  const card = { background: 'var(--surface)', border: '1px solid #ECE9F5', borderRadius: 18, padding: isMobile ? 16 : 22 }

  if (!formId) {
    return (
      <div style={{ ...card, maxWidth: 620 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          Give the form a name first
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.55 }}>
          Recipients attach to a saved form. Add a name in Questions and this
          will be ready.
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, display: 'grid', gap: 14 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
          Who is this for?
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.55, marginBottom: 16 }}>
          {form.visibility === 'public'
            ? 'Anyone with the link can respond. Add recipients to track replies; this does not send an email.'
            : 'Only staff can respond to this form.'}
        </div>

        {recipients.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                {completed.length} of {recipients.length} completed
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--org-ink)' }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--surface-hover)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: primary, borderRadius: 8 }} />
            </div>
          </>
        )}

        {form.visibility !== 'private' && <button disabled={loading || busy} onClick={() => setPicking(p => !p)} style={{
          minHeight: 44, padding: '10px 17px', borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        }}>{picking ? 'Close' : '+ Add recipients'}</button>}

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13,
          }} role="alert">{error} <button onClick={load} style={BUTTON}>Reload recipients</button></div>
        )}
      </div>

      {picking && form.visibility !== 'private' && (
        <div style={card}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 8 }} htmlFor="recipient-search">Find {terms.people} or a parent / carer</label>
          <input id="recipient-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email…" style={{ width: '100%', minHeight: 46, padding: 12, boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, background: 'var(--surface)', color: 'var(--text)', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button style={BUTTON} onClick={() => setChosen(list => [...new Set([...list, ...visible.filter(c => !already.has(c.id)).map(c => c.id)])])}>Select visible</button>
            <button style={BUTTON} onClick={() => setChosen([])}>Clear selection</button>
          </div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all', ...groupNames].map(b => (
              <button key={b} onClick={() => setGroup(b)} style={{
                minHeight: 44, padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                border: `1px solid ${group === b ? 'transparent' : 'var(--border)'}`,
                background: group === b ? primary : 'var(--surface)',
                color: group === b ? '#fff' : 'var(--text3)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{b === 'all' ? 'Everyone' : b}</button>
            ))}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {!visible.length && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No matching people. Try another name or group.</p>}
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
                    border: `1px solid ${sel ? primary : 'var(--border-soft)'}`,
                    background: added ? 'var(--surface2)' : sel ? 'var(--org-a05)' : 'var(--surface)',
                    cursor: added ? 'not-allowed' : 'pointer', opacity: added ? 0.55 : 1,
                  }}
                >
                  <span style={{
                    width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                    display: 'grid', placeItems: 'center', fontSize: 10, color: '#fff',
                    border: `1.5px solid ${sel ? primary : 'var(--text-faint)'}`,
                    background: sel ? primary : 'var(--surface)',
                  }}>{sel ? '\u2713' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                      {c.first_name} {c.last_name}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-faint)' }}>
                      {/* No parent email means the form can be shared but this
                          person can never be ticked off automatically. */}
                      {c.parent_email || 'No parent email on record'}
                    </span>
                  </span>
                  {added && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Added</span>}
                </button>
              )
            })}
          </div>

          <button
            onClick={addChosen}
            disabled={!chosen.length || busy}
            style={{
              minHeight: 44, marginTop: 12, width: '100%', padding: '12px', borderRadius: 11, border: 'none',
              background: chosen.length && !busy ? primary : 'var(--border)', color: '#fff',
              fontSize: 14, fontWeight: 800,
              cursor: chosen.length && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >{busy ? 'Adding\u2026' : `Add ${chosen.length || ''} recipient${chosen.length === 1 ? '' : 's'}`}</button>
        </div>
      )}

      {loading && <div style={{ ...card, color: 'var(--text-faint)', fontSize: 13.5 }}>Loading\u2026</div>}

      {!loading && outstanding.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            Haven't replied ({outstanding.length})
          </div>
          {outstanding.some(r => !r.recipient_email) && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10, lineHeight: 1.5 }}>
              Anyone without an email can still be sent the link, but their response
              can't be matched back automatically.
            </div>
          )}
          <div style={{ display: 'grid', gap: 5 }}>
            {outstanding.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: 13.5 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 7, flexShrink: 0,
                  background: r.recipient_email ? '#F79009' : 'var(--text-faint)',
                }} />
                <span style={{ color: 'var(--text)', flex: 1 }}>{r.recipient_name || 'Unnamed'}</span>
                {r.recipient_email ? (
                  <span style={{ color: 'var(--text-faint)', fontSize: 12, overflowWrap: 'anywhere' }}>{r.recipient_email}</span>
                ) : (
                  <span style={{ color: 'var(--text-faint)', fontSize: 11.5, fontStyle: 'italic' }}>
                    no email — reply cannot be matched
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && completed.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            Completed ({completed.length})
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {completed.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: 13.5 }}>
                <span style={{ color: '#12B76A', flexShrink: 0 }}>{'\u2713'}</span>
                <span style={{ color: 'var(--text)', flex: 1 }}>{r.recipient_name || 'Unnamed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && recipients.length === 0 && !picking && (
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>
            No recipients yet
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.55 }}>
            Add people and LaunchSession will track who has replied. The public link
            keeps working either way.
          </div>
        </div>
      )}
    </div>
  )
}
