import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { withAlpha } from '../../lib/withAlpha'
import { londonDate } from '../../lib/sessionPhase'
import Icon from '../../lib/icons'
import SignedImg from '../shared/SignedImg'
import OrgPageHero, { orgBrand, heroButtons } from '../shared/OrgPageHero'
import { ageOnDate, groupFor, registerView, UNGROUPED } from './registerView'

const button = { minHeight: 44, minWidth: 44, borderRadius: 12, padding: '10px 15px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
const statusLabels = { signed_in: 'On site', signed_out: 'Signed out', absent: 'Absent', expected: 'Expected', unmarked: 'Not marked' }
const statusColours = { signed_in: 'var(--ok-text)', signed_out: 'var(--info-text)', absent: 'var(--danger-text)', expected: 'var(--text3)', unmarked: 'var(--text3)' }

export default function RegisterWorkspace({ org, terms, people, sessions, session, onSessionChange, attendance, loading, sessionsLoading, sessionsError, onRetrySessions, attendanceLoading, attendanceError, onRetryAttendance, offline, groups, selectedIds, selectMode, onSelectMode, onToggleSelect, onSelectVisible, onClearSelection, onAssign, assigning, onPerson, onOpenRegister, onPlan, onToday, onAdd, onImport, onTemplates, onGroups, onMedical, onPrint, onHistory, onArchive }) {
  const mobile = useIsMobile()
  const brand = orgBrand(org)
  const { primary, secondary, gradient: brandGradient } = brand
  const onHero = heroButtons(brand, button)
  const [directory, setDirectory] = useState(!session)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')
  const [filter, setFilter] = useState('all')
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsRef = useRef(null)
  const effectiveDirectory = directory || !session
  const view = useMemo(() => registerView({ people, attendance, sessionId: session?.id, directory: effectiveDirectory, groups, search, group, filter }), [people, attendance, session?.id, effectiveDirectory, groups, search, group, filter])
  useEffect(() => { setDirectory(!session?.id); setFilter('all'); setGroup('all') }, [session?.id])
  useEffect(() => {
    if (!toolsOpen) return
    const close = event => { if (!toolsRef.current?.contains(event.target)) setToolsOpen(false) }
    const escape = event => { if (event.key === 'Escape') { setToolsOpen(false); toolsRef.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [toolsOpen])
  const chooseView = value => { setDirectory(value); setFilter('all'); setGroup('all'); onClearSelection() }
  const filterStatus = value => { setDirectory(false); setFilter(value); setGroup('all'); setSearch(''); onClearSelection() }
  const busy = loading || (!effectiveDirectory && attendanceLoading)
  const attendanceUnavailable = attendanceLoading || !!attendanceError
  const today = londonDate()
  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const closed = !!session?.closed_at || session?.status === 'completed'
  const started = !!session?.opened_at || view.counts.signed_in > 0 || view.counts.signed_out > 0
  const phaseLabel = closed ? 'Register closed' : started ? 'Register open' : 'Ready to take attendance'
  const actionStyle = { ...button, background: brandGradient, color: '#fff', borderColor: 'transparent', boxShadow: `0 5px 14px ${withAlpha(primary, '26')}` }
  const tools = [
    ...(mobile ? [{ label: terms.Sessions, icon: '📅', action: onPlan }, { label: 'Today', icon: '⚡', action: onToday }] : []),
    { label: `Manage ${terms.groups || `${terms.group}s`}`, icon: '🏷️', action: onGroups },
    { label: 'Import templates', icon: '🧩', action: onTemplates },
    { label: 'Medical alerts', icon: '💊', action: onMedical },
    { label: 'Print current view', icon: '🖨', action: () => onPrint(view.visible, !effectiveDirectory) },
    { label: 'Archived registers', icon: '📦', action: onArchive },
  ]

  return <div data-register-workspace style={{ height: '100%', width: '100%', minWidth: 0, overflowY: 'auto', background: `radial-gradient(ellipse at 0% 0%, ${withAlpha(primary, '14')}, transparent 48%), var(--bg, var(--surface2))`, color: 'var(--text)', boxSizing: 'border-box', paddingBottom: mobile ? 24 : 32 }}>
    <div aria-hidden="true" style={{ height: 4, background: brand.stripe }} />
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: mobile ? '20px 16px 0' : '28px 28px 0' }}>
    <header>
      <OrgPageHero org={org} mobile={mobile} title="Registers" subtitle="A clear view of who's here and what they need." label="Today's register" detail={dateLabel}
        actions={<>
          <button onClick={onImport} style={{ ...onHero.main, flex: mobile ? 1 : undefined }}><Icon name="📥" /> Import register</button>
          <button onClick={onAdd} style={{ ...onHero.quiet, flex: mobile ? 1 : undefined }}><Icon name="➕" /> Add {terms.person}</button>
          <div ref={toolsRef} style={{ position: 'relative' }}>
            <button onClick={() => setToolsOpen(value => !value)} aria-expanded={toolsOpen} aria-controls="register-tools" aria-label="Tools" style={{ ...onHero.quiet, padding: mobile ? 12 : '10px 15px' }}><Icon name="⚙️" />{!mobile && 'Tools'}</button>
            {toolsOpen && <div id="register-tools" style={{ position: 'absolute', right: 0, top: 52, width: 235, maxWidth: 'calc(100vw - 32px)', padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 16px 48px #0002', zIndex: 10 }}>
              {tools.map(tool => <button key={tool.label} onClick={() => { setToolsOpen(false); tool.action() }} style={{ ...button, width: '100%', justifyContent: 'flex-start', border: 0, textAlign: 'left' }}><Icon name={tool.icon} />{tool.label}</button>)}
            </div>}
          </div>
        </>}
        shortcuts={<>
          <button onClick={onPlan} style={onHero.shortcut}><Icon name="📅" />{terms.Sessions}</button>
          <button onClick={onToday} style={onHero.shortcut}><Icon name="⚡" />Today</button>
        </>} />

      <section aria-label="Today's register overview" style={{ borderRadius: 22, border: `1px solid ${withAlpha(primary, '35')}`, background: `linear-gradient(115deg, ${withAlpha(primary, '12')}, var(--surface) 60%, ${withAlpha(secondary, '12')})`, marginBottom: mobile ? 16 : 22, boxShadow: `0 12px 35px -24px ${withAlpha(primary, '80')}` }}>
        <div style={{ padding: mobile ? 14 : 24 }}>
        {sessions.length > 1 && <label style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 16 }}>
          {!mobile && <>Today's {terms.sessions}</>}
          <select aria-label={`Choose today's ${terms.session}`} value={session?.id || ''} onChange={event => { onClearSelection(); onSessionChange(event.target.value) }} style={{ ...button, flex: 1, minWidth: 0, maxWidth: mobile ? '100%' : 440 }}>
            {sessions.map(item => <option key={item.id} value={item.id}>{item.start_time?.slice(0, 5) || 'Any time'} · {item.title}</option>)}
          </select>
        </label>}
        {sessionsError ? <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><p style={{ flex: 1, fontSize: 14, color: 'var(--warn-text)' }}>{sessionsError}</p><button onClick={onRetrySessions} style={button}>Retry {terms.sessions}</button></div> : sessionsLoading ? <div role="status" style={{ padding: 16 }}>Loading today's {terms.sessions}…</div> : session ? <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: mobile ? 14 : 32, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: closed ? 'var(--text3)' : 'var(--ok-text)', fontSize: 12, fontWeight: 800, marginBottom: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />{phaseLabel}</div>
            {(!mobile || sessions.length < 2) && <h2 style={{ margin: '0 0 10px', fontSize: mobile ? 20 : 26, lineHeight: 1.25, letterSpacing: -.6, overflowWrap: 'anywhere' }}>{session.title}</h2>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
              {session.start_time && <span><Icon name="🕐" /> {session.start_time.slice(0, 5)}{session.end_time ? ` – ${session.end_time.slice(0, 5)}` : ''}</span>}
              {session.location && <span style={{ overflowWrap: 'anywhere' }}><Icon name="📍" /> {session.location}</span>}
            </div>
            {session.meeting_point && <p style={{ fontSize: 13, color: 'var(--text3)', margin: '8px 0' }}>Meeting point: {session.meeting_point}</p>}
            <button onClick={() => onOpenRegister(session)} style={{ ...actionStyle, marginTop: mobile ? 12 : 18, width: mobile ? '100%' : undefined }}>{closed ? 'View register' : 'Take attendance'} <Icon name="→" /></button>
          </div>
          <div style={{ display: mobile ? 'grid' : 'block', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            <button aria-label={`${view.counts.signed_in} currently on site`} onClick={() => filterStatus('signed_in')} style={{ border: mobile ? `1px solid ${withAlpha(primary, '35')}` : 0, borderRadius: 12, padding: mobile ? 6 : 0, background: mobile ? withAlpha(primary, '10') : 'none', color: 'var(--text)', cursor: 'pointer', textAlign: mobile ? 'center' : 'left', minHeight: mobile ? 56 : 44, display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'center' : 'baseline', justifyContent: mobile ? 'center' : 'flex-start', flexWrap: 'wrap', gap: mobile ? 4 : 10 }}>
              <span style={{ fontSize: mobile ? 18 : 46, lineHeight: 1, letterSpacing: mobile ? -.5 : -2, fontWeight: 850 }}>{attendanceUnavailable ? '—' : view.counts.signed_in}<span style={{ fontSize: mobile ? 11 : 22, color: 'var(--text3)', letterSpacing: -1 }}> / {attendanceUnavailable ? '—' : view.counts.total}</span></span>
              <span style={{ fontSize: mobile ? 10 : 13, fontWeight: 700, color: 'var(--text3)' }}>{mobile ? 'On site' : 'on site now'}</span>
            </button>
            {!mobile && <div aria-hidden="true" style={{ height: 6, margin: '14px 0 16px', borderRadius: 10, background: 'var(--border-soft)', overflow: 'hidden' }}><div style={{ width: `${view.counts.total ? view.counts.signed_in / view.counts.total * 100 : 0}%`, height: '100%', background: brandGradient, borderRadius: 10 }} /></div>}
            <div style={{ display: mobile ? 'contents' : 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
              {[['expected', 'To arrive'], ['signed_out', 'Signed out'], ['absent', 'Absent']].map(([key, label]) => <button key={key} onClick={() => filterStatus(key)} aria-pressed={!effectiveDirectory && filter === key} style={{ ...button, padding: mobile ? '6px' : '10px 6px', flexDirection: 'column', gap: 4, background: !effectiveDirectory && filter === key ? withAlpha(primary, '1C') : 'var(--surface)', borderColor: !effectiveDirectory && filter === key ? primary : 'var(--border)' }}><b style={{ fontSize: 18 }}>{attendanceUnavailable ? '—' : view.counts[key]}</b><span style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</span></button>)}
            </div>
          </div>
        </div> : <div style={{ display: 'flex', gap: 22, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}><div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--org-ink)', marginBottom: 8 }}>Plan your next {terms.session}</div><h2 style={{ fontSize: mobile ? 20 : 26, letterSpacing: -.6, margin: '0 0 8px' }}>Ready for your next {terms.session}.</h2><p style={{ margin: 0, fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>No {terms.session} scheduled for today. Your directory is ready below. Plan a {terms.session} to start taking attendance.</p></div>
          <button onClick={onPlan} style={{ ...actionStyle, width: mobile ? '100%' : undefined }}><Icon name="📅" /> Open {terms.session} planner</button>
        </div>}
        </div>
      </section>
      {attendanceError && <div role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 12, borderRadius: 12, background: 'var(--warn-bg)', color: 'var(--warn-text)', marginBottom: 12 }}><span style={{ flex: 1, fontSize: 13 }}>{attendanceError}</span><button onClick={onRetryAttendance} style={button}>Retry attendance</button></div>}
      {offline && <p role="status" style={{ background: 'var(--warn-bg)', color: 'var(--warn-text)', borderRadius: 12, padding: 12, fontSize: 13 }}>Showing saved data. Attendance totals may be out of date until your connection returns.</p>}
      <nav aria-label="Register views" style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: mobile ? 14 : 20, alignItems: 'center', flexWrap: 'nowrap' }}>
        {session && <button onClick={() => chooseView(false)} aria-pressed={!effectiveDirectory} style={{ ...button, border: 0, borderRadius: 0, borderBottom: `3px solid ${!effectiveDirectory ? primary : 'transparent'}`, background: 'transparent', padding: '12px 0', color: !effectiveDirectory ? 'var(--org-ink)' : 'var(--text3)' }}>This register <span style={{ fontSize: 11 }}>{attendanceUnavailable ? '—' : view.counts.total}</span></button>}
        <button onClick={() => chooseView(true)} aria-pressed={effectiveDirectory} style={{ ...button, border: 0, borderRadius: 0, borderBottom: `3px solid ${effectiveDirectory ? primary : 'transparent'}`, background: 'transparent', padding: '12px 0', color: effectiveDirectory ? 'var(--org-ink)' : 'var(--text3)' }}>Everyone <span style={{ fontSize: 11 }}>{people.length}</span></button>
        <button onClick={onHistory} style={{ ...button, border: 0, background: 'transparent', marginLeft: 'auto', padding: '12px 0', color: 'var(--text3)' }}><Icon name="📜" />{mobile ? 'History' : 'Past registers'}</button>
      </nav>
    </header>

    <main style={{ padding: mobile ? '18px 0' : '24px 0', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div><h2 style={{ fontSize: 18, margin: '0 0 4px', letterSpacing: -.3 }}>{effectiveDirectory ? terms.People : 'Attendance overview'}</h2>{!mobile && <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>{effectiveDirectory ? 'Your full directory. Open a profile to see details.' : `Use “Take attendance” to sign ${terms.people} in and out.`}</p>}</div>
        <button onClick={onSelectMode} aria-pressed={selectMode} style={button}>{selectMode ? 'Done' : 'Select'}</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}><span style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text3)' }}><Icon name="🔍" /></span><input aria-label="Search by name" placeholder="Search by name…" value={search} onChange={event => { setSearch(event.target.value); onClearSelection() }} onKeyDown={event => { if (event.key === 'Escape') setSearch('') }} style={{ ...button, boxSizing: 'border-box', width: '100%', height: 46, fontSize: 16, fontWeight: 400, paddingLeft: 40, paddingRight: 44, cursor: 'text' }} />{search && <button aria-label="Clear search" onClick={() => setSearch('')} style={{ ...button, position: 'absolute', right: 1, top: 1, width: 44, border: 0, padding: 0 }}>×</button>}</div>
        <select aria-label={`Filter by ${terms.group}`} value={group} onChange={event => { setGroup(event.target.value); onClearSelection() }} style={{ ...button, maxWidth: '100%', flex: mobile ? '1 1 150px' : '0 1 200px', minWidth: 0, fontSize: 14 }}><option value="all">All {terms.group}s</option>{groups.map(item => <option key={item.key || item.label} value={item.label}>{item.label}</option>)}<option value={UNGROUPED}>Ungrouped</option></select>
        <button aria-pressed={filter === 'alerts'} onClick={() => { setFilter(filter === 'alerts' ? 'all' : 'alerts'); onClearSelection() }} style={{ ...button, background: filter === 'alerts' ? 'var(--warn-bg)' : 'var(--surface)', color: filter === 'alerts' ? 'var(--warn-text)' : 'var(--text3)' }}><Icon name="⚠" /> Care alerts {view.alertCount}</button>
      </div>
      {!effectiveDirectory && <div aria-label="Attendance filters" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }}>{[['all', 'Everyone'], ['signed_in', 'On site'], ['expected', 'To arrive'], ['signed_out', 'Signed out'], ['absent', 'Absent']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); onClearSelection() }} style={{ ...button, minHeight: 44, whiteSpace: 'nowrap', borderRadius: 99, padding: '8px 13px', background: filter === key ? brandGradient : 'transparent', color: filter === key ? '#fff' : 'var(--text3)', borderColor: filter === key ? withAlpha(primary, '45') : 'transparent' }}>{label}</button>)}</div>}
      {selectMode && <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12, background: withAlpha(primary, '0D'), border: `1px solid ${withAlpha(primary, '30')}`, borderRadius: 12, marginBottom: 12 }}>
        <b style={{ fontSize: 13 }}>{selectedIds.size} selected</b><button onClick={() => onSelectVisible(view.visible.map(person => person.id))} style={{ ...button, padding: '8px 10px' }}>Select shown</button>
        <select aria-label={`Assign selected to ${terms.group}`} value="" disabled={!selectedIds.size || assigning} onChange={event => onAssign(event.target.value)} style={{ ...button, flex: '1 1 160px', minWidth: 0, maxWidth: '100%' }}><option value="">{assigning ? 'Assigning…' : `Move to ${terms.group}…`}</option>{groups.map(item => <option key={item.key || item.label} value={item.label}>{item.label}</option>)}</select>
        <button onClick={onClearSelection} style={{ ...button, padding: '8px 10px' }}>Clear</button>
      </div>}
      <div aria-live="polite" style={{ color: 'var(--text3)', fontSize: 12, margin: '4px 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span>{busy ? 'Loading…' : `${view.visible.length} of ${view.source.length} ${terms.people}`}</span>{(search || group !== 'all' || filter !== 'all') && <button onClick={() => { setSearch(''); setGroup('all'); setFilter('all') }} style={{ ...button, padding: '4px 10px', background: 'transparent', border: 0, color: 'var(--org-ink)' }}>Clear filters</button>}</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {!mobile && <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: effectiveDirectory ? 'minmax(0, 1fr) 180px 90px' : 'minmax(0, 1fr) 180px 110px', gap: 12, padding: '12px 18px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .9, color: 'var(--text3)', borderBottom: '1px solid var(--border)', background: withAlpha(primary, '0B') }}><span>{terms.Person} & care information</span><span>{terms.Group}</span><span style={{ textAlign: 'right' }}>{effectiveDirectory ? 'Age' : 'Attendance'}</span></div>}
        {attendanceError && !effectiveDirectory ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Retry attendance above, or open Everyone to browse your directory.</div> : busy ? <div role="status" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading {terms.people}…</div> : view.visible.length === 0 ? <div style={{ padding: '40px 20px', textAlign: 'center' }}><div style={{ fontSize: 30, color: primary, marginBottom: 12 }}><Icon name="📋" /></div><h3 style={{ fontSize: 18, margin: '0 0 8px' }}>{view.source.length ? 'No matches just yet' : effectiveDirectory ? `Add your first ${terms.person}` : 'Build this register'}</h3><p style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>{view.source.length ? 'Try a different name or clear the filters.' : effectiveDirectory ? 'Import a spreadsheet or add someone individually.' : `Open attendance to add the ${terms.people} joining this ${terms.session}.`}</p><button onClick={view.source.length ? () => { setSearch(''); setGroup('all'); setFilter('all') } : effectiveDirectory ? onImport : () => onOpenRegister(session)} style={actionStyle}>{view.source.length ? 'Clear filters' : effectiveDirectory ? 'Import register' : 'Take attendance'}</button></div> : <ul aria-label={effectiveDirectory ? terms.People : 'Attendance overview'} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {view.visible.map(person => {
            const itemGroup = groupFor(person, groups)
            const colour = itemGroup?.color || primary
            const age = ageOnDate(person.date_of_birth, today)
            const status = view.statusOf(person.id)
            const name = `${person.first_name || ''} ${person.last_name || ''}`.trim()
            return <li key={person.id} style={{ borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', paddingLeft: selectMode ? 10 : 0, background: selectedIds.has(person.id) ? withAlpha(primary, '0D') : 'transparent' }}>
              {selectMode && <label style={{ width: 44, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><input type="checkbox" aria-label={`Select ${name}`} checked={selectedIds.has(person.id)} onChange={() => onToggleSelect(person.id)} style={{ width: 20, height: 20, accentColor: primary }} /></label>}
              <button aria-label={`Open ${name}`} onClick={() => selectMode ? onToggleSelect(person.id) : onPerson(person)} style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr) auto' : effectiveDirectory ? 'minmax(0, 1fr) 180px 90px' : 'minmax(0, 1fr) 180px 110px', gap: mobile ? 8 : 12, width: '100%', minWidth: 0, alignItems: 'center', border: 0, background: 'transparent', color: 'var(--text)', padding: mobile ? '14px 12px' : '14px 18px', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
                <span style={{ display: 'flex', gap: mobile ? 10 : 12, alignItems: 'center', minWidth: 0 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: withAlpha(colour, '18'), color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 800, overflow: 'hidden' }}>{person.photo_url ? <SignedImg bucket="gallery" src={person.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`}</span>
                  <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 750, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 7px', marginTop: 4, fontSize: 10.5 }}>
                      {mobile && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{itemGroup?.label || 'Ungrouped'}{age !== null ? ` · ${age} yrs` : ''}</span>}
                      {person.allergies && <span style={{ color: 'var(--warn-text)', background: 'var(--warn-bg)', padding: '2px 6px', borderRadius: 5 }}>Allergy</span>}
                      {person.medical_notes && <span style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)', padding: '2px 6px', borderRadius: 5 }}>Medical</span>}
                      {person.has_epipen && <span style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)', padding: '2px 6px', borderRadius: 5 }}>EpiPen</span>}
                    </span>
                  </span>
                </span>
                {!mobile && <span style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ height: 7, width: 7, flexShrink: 0, borderRadius: '50%', background: colour }} />{itemGroup?.label || 'Ungrouped'}</span>}
                <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: effectiveDirectory ? 'var(--text3)' : statusColours[status], whiteSpace: 'nowrap' }}>{effectiveDirectory ? mobile ? '›' : age === null ? '—' : `${age} yrs` : statusLabels[status] || 'Not marked'}</span>
              </button>
            </li>
          })}
        </ul>}
      </div>
    </main>
    <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 0 16px', fontSize: 11, color: 'var(--text3)' }}><Icon name="🚀" />Powered by <span style={{ fontWeight: 800, color: 'var(--org-ink)' }}>LaunchSession</span></footer>
    </div>
  </div>
}
