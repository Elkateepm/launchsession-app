import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Avatar } from '../volunteers/vh_shared'
import Icon from '../../lib/icons'

const UI = {
  text: 'var(--text, #172033)', muted: 'var(--text2, #526075)',
  surface: 'var(--surface, #fff)', soft: 'var(--bg, #F6F8FC)',
  border: 'var(--border, #E3E8F0)', accentSoft: 'var(--org-a05, #F5F3FF)',
}
const panel = { background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 16 }
const button = {
  minHeight: 44, padding: '10px 15px', borderRadius: 10,
  border: `1px solid ${UI.border}`, background: UI.surface, color: UI.text,
  font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}
const control = {
  minHeight: 44, padding: '10px 12px', borderRadius: 9,
  border: `1px solid ${UI.border}`, background: UI.surface, color: UI.text,
  font: 'inherit', fontSize: 13, minWidth: 0, boxSizing: 'border-box',
}
const columns = 'minmax(210px, 1.8fr) minmax(95px, .8fr) minmax(150px, 1.2fr) minmax(155px, 1.3fr) minmax(105px, .8fr) 24px'

export function PeopleHeader({ terms, primary, stats, loading, onAdd, onInvite, onQR, onOnSite }) {
  const mobile = useIsMobile()
  return (
    <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div style={{ width: mobile ? '100%' : undefined }}>
        {!mobile && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.6, color: primary, marginBottom: 10 }}>PEOPLE & CONNECTIONS</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: mobile ? 'space-between' : 'flex-start', gap: 16 }}>
          <h1 style={{ margin: 0, color: UI.text, fontSize: mobile ? 28 : 34, letterSpacing: -1, fontWeight: 800 }}>{terms.People}</h1>
          <button onClick={onOnSite} style={{ ...button, minHeight: 44, padding: '7px 10px', color: 'var(--ok-text)', background: 'var(--ok-bg)', border: '1px solid #DCFCE7', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span aria-hidden="true">●</span> {loading ? '…' : stats.onSite} on site
          </button>
        </div>
        <p style={{ margin: '8px 0 0', color: UI.muted, fontSize: 14, lineHeight: 1.6 }}>{mobile ? 'Profiles, contacts and support.' : 'The people you support, and the details that matter.'}</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: mobile ? '100%' : undefined }}>
        <button style={{ ...button, flex: mobile ? 1 : undefined }} onClick={onInvite}><Icon name="✉️" /> Invite & register</button>
        <button style={button} onClick={onQR}><Icon name="⊞" /> QR code</button>
        <button style={{ ...button, background: primary, borderColor: primary, color: '#fff', width: mobile ? '100%' : undefined }} onClick={onAdd}>+ Add {terms.person}</button>
      </div>
    </header>
  )
}

export function PeopleTabs({ terms, stats, value, onChange }) {
  return (
    <nav aria-label={`${terms.People} sections`} style={{ display: 'flex', gap: 22, overflowX: 'auto', borderBottom: `1px solid ${UI.border}`, marginTop: 24 }}>
      {[
        ['directory', 'Directory'], ['onsite', 'On site'], ['groups', terms.Groups],
        ['consents', 'Consents'], ['medical', 'Medical & support'], ['requests', 'Registration requests', stats.pendingRegs],
      ].map(([key, label, count]) => (
        <button key={key} onClick={() => onChange(key)} aria-current={value === key ? 'page' : undefined}
          style={{ ...button, padding: '13px 0', borderRadius: 0, border: 'none', borderBottom: `3px solid ${value === key ? 'var(--org-primary, #7C5CFC)' : 'transparent'}`, background: 'transparent', color: value === key ? 'var(--org-primary, #7C5CFC)' : UI.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {label}{count > 0 && <span style={{ background: 'var(--warn-bg)', color: 'var(--warn-text)', padding: '2px 7px', borderRadius: 6, fontSize: 11 }}>{count}</span>}
        </button>
      ))}
    </nav>
  )
}

export function PeopleSummary({ stats, terms, primary, value, onChange, loading }) {
  const mobile = useIsMobile()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
      {[
        [null, `All ${terms.people}`, stats.total, 'Active records', '👥', primary],
        ['active', mobile ? 'Active · 30 days' : 'Active in last 30 days', stats.activeThisMonth, 'With recorded activity', '📈', '#047857'],
        ['medical', 'Medical alerts', stats.medical, 'Care information to know', '❤️', '#B91C1C'],
        ['attention', 'Needs attention', stats.attention, 'Consents or profile details', '⚠️', '#B45309'],
      ].map(([key, label, count, detail, icon, tone]) => (
        <button key={label} aria-pressed={value === key} onClick={() => onChange(key)} style={{ ...panel, textAlign: 'left', padding: mobile ? 12 : 20, font: 'inherit', cursor: 'pointer', boxShadow: value === key ? `inset 0 0 0 1px ${primary}` : 'none', borderColor: value === key ? primary : UI.border }}>
          <div style={{ color: UI.muted, fontSize: 12, fontWeight: 700, minHeight: mobile ? 16 : 20 }}>{label}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: mobile ? '5px 0 0' : '9px 0' }}>
            <span style={{ color: UI.text, fontSize: mobile ? 26 : 30, fontWeight: 800, letterSpacing: -1 }}>{loading ? '—' : count}</span>
            <span style={{ color: tone, fontSize: 21 }} aria-hidden="true"><Icon name={icon} /></span>
          </div>
          {!mobile && <span style={{ color: UI.muted, fontSize: 11.5, lineHeight: 1.5 }}>{detail}</span>}
        </button>
      ))}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const colors = {
    neutral: [UI.soft, UI.muted], amber: ['#FEF3C7', '#92400E'],
    red: ['#FEF2F2', '#B91C1C'], green: ['#DCFCE7', '#166534'],
  }
  const [background, color] = colors[tone]
  return <span style={{ display: 'inline-block', padding: '4px 7px', borderRadius: 6, background, color, fontSize: 10.5, fontWeight: 700, lineHeight: 1.3 }}>{children}</span>
}

function activityDate(attendance) {
  if (!attendance?.created_at) return 'No activity recorded'
  return new Date(attendance.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
}

export function PeopleRoster({
  records, total, terms, primary, loading, search, onSearch, groupFilter, groups, onGroup,
  quickFilter, onFilter, sort, onSort, onClear, onOpen, onAdd, groupLabel,
  latestAttByChild, medicalAlerts, consentIssue, age,
}) {
  // The permanent sidebar leaves less space than the viewport width suggests.
  const compact = useIsMobile(1250)
  const filtersActive = !!search || groupFilter !== 'all' || quickFilter !== null
  return (
    <section style={{ ...panel, overflow: 'hidden', minWidth: 0 }} aria-label={`${terms.People} directory`}>
      <div style={{ padding: compact ? 16 : 20, borderBottom: `1px solid ${UI.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 17, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: UI.text, margin: 0 }}>Your directory</h2>
            <span style={{ fontSize: 11, background: UI.soft, borderRadius: 6, padding: '5px 8px', color: UI.muted }}>{loading ? 'Loading' : total}</span>
          </div>
          <span style={{ fontSize: 12, color: UI.muted }}>Select a name to open their profile</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: 14, color: UI.muted }}><Icon name="🔍" /></span>
            <input aria-label={`Search ${terms.people}`} placeholder={`Search names, family, school or ${terms.group}…`} value={search} onChange={e => onSearch(e.target.value)} style={{ ...control, width: '100%', paddingLeft: 36 }} />
          </div>
          <select aria-label={`Filter by ${terms.group}`} value={groupFilter} onChange={e => onGroup(e.target.value)} style={{ ...control, flex: compact ? '1 1 130px' : '0 1 170px' }}>
            <option value="all">All {terms.Groups.toLowerCase()}</option>
            <option value="__ungrouped">Unassigned</option>
            {groups.map(g => <option key={g.toLowerCase()} value={g}>{g}</option>)}
          </select>
          <select aria-label="Filter records" value={quickFilter || 'all'} onChange={e => onFilter(e.target.value === 'all' ? null : e.target.value)} style={{ ...control, flex: compact ? '1 1 130px' : '0 1 180px' }}>
            <option value="all">All records</option>
            <option value="active">Active in last 30 days</option>
            <option value="onsite">On site</option>
            <option value="medical">Medical alerts</option>
            <option value="attention">Needs attention</option>
            <option value="consent">Consents to check</option>
            <option value="incomplete">Incomplete profiles</option>
          </select>
        </div>
      </div>
      <div style={{ padding: compact ? '10px 16px' : '10px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: UI.soft, borderBottom: `1px solid ${UI.border}` }}>
        <div role="status" style={{ fontSize: 12, color: UI.muted }}>
          {loading ? 'Loading records…' : <><strong style={{ color: UI.text }}>{records.length}</strong> of {total} {terms.people}</>}
          {filtersActive && <button onClick={onClear} style={{ ...button, background: 'transparent', border: 0, color: primary, fontSize: 12, padding: '8px 12px' }}>Clear filters</button>}
        </div>
        <select aria-label="Sort directory" value={sort} onChange={e => onSort(e.target.value)} style={{ ...control, background: 'transparent', borderColor: 'transparent', fontSize: 12, maxWidth: '100%' }}>
          <option value="name">Name A–Z</option>
          <option value="surname">Surname A–Z</option>
          <option value="recent">Recent activity</option>
          <option value="group">{terms.Group} A–Z</option>
        </select>
      </div>
      {!compact && <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'center', gap: 16, padding: '13px 20px', color: UI.muted, fontSize: 10, letterSpacing: .6, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${UI.border}` }}>
        <span>{terms.Person}</span><span>{terms.Group}</span><span>Family contact</span><span>Care & consents</span><span>Last activity</span><span />
      </div>}
      {loading ? <div role="status" style={{ padding: 36, textAlign: 'center', color: UI.muted }}>Loading your directory…</div> : records.length === 0 ? (
        <div style={{ padding: '48px 22px', textAlign: 'center' }}>
          <div style={{ color: primary, fontSize: 28, marginBottom: 12 }}><Icon name="👥" /></div>
          <h3 style={{ margin: '0 0 8px', color: UI.text, fontSize: 18 }}>{total ? 'No matching records' : `Welcome to your ${terms.people} directory`}</h3>
          <p style={{ color: UI.muted, fontSize: 13, lineHeight: 1.6 }}>{total ? 'Try another name or clear your filters to see everyone.' : `Add your first ${terms.person} to keep their details together.`}</p>
          <button style={button} onClick={total ? onClear : onAdd}>{total ? 'Clear filters' : `Add ${terms.person}`}</button>
        </div>
      ) : <div>{records.map(person => {
        const name = `${person.first_name || ''} ${person.last_name || ''}`.trim()
        const personAge = age(person.date_of_birth)
        const att = latestAttByChild[person.id]
        const onSite = att?.status === 'signed_in'
        const alerts = medicalAlerts(person)
        const consentDue = consentIssue(person.id)
        return (
          <button key={person.id} aria-label={`Open ${name} profile`} onClick={() => onOpen(person.id)}
            style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : columns, gap: compact ? 12 : 16, width: '100%', padding: compact ? 16 : '18px 20px', border: 0, borderBottom: `1px solid ${UI.border}`, background: UI.surface, color: UI.text, cursor: 'pointer', font: 'inherit', textAlign: 'left', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = UI.accentSoft }} onMouseLeave={e => { e.currentTarget.style.background = UI.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <Avatar name={name} photoUrl={person.photo_url} size={42} color={primary} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 750, color: UI.text, overflowWrap: 'anywhere' }}>{name}</div>
                <div style={{ fontSize: 11.5, color: UI.muted, marginTop: 5, lineHeight: 1.4 }}>{personAge != null ? `Age ${personAge}` : 'Age not recorded'}{person.school ? ` · ${person.school}` : ''}</div>
              </div>
              {compact && <span style={{ color: primary, fontSize: 18 }} aria-hidden="true">↗</span>}
            </div>
            <div style={{ fontSize: 12, color: UI.muted }}>{compact && <span style={{ fontWeight: 700 }}>{terms.Group}: </span>}{groupLabel(person.group_name) || 'Unassigned'}</div>
            <div style={{ minWidth: 0, color: UI.muted, fontSize: 12, overflowWrap: 'anywhere' }}>
              <div style={{ color: UI.text, fontWeight: 600 }}>{person.parent_name || 'No family contact'}</div>
              <div style={{ marginTop: 5 }}>{person.parent_phone || person.parent_email || 'Contact details missing'}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {alerts.map(alert => <Chip key={alert.label} tone={alert.label === 'Allergy' ? 'amber' : 'red'}>{alert.label}</Chip>)}
              {person.has_behaviour_plan && <Chip tone="amber">Support plan</Chip>}
              {person.collection_restricted && <Chip tone="red">Collection restriction</Chip>}
              {person.profile_incomplete && <Chip tone="amber">Profile incomplete</Chip>}
              {consentDue && <Chip tone="amber">Check consents</Chip>}
              {!alerts.length && !person.has_behaviour_plan && !person.collection_restricted && !person.profile_incomplete && !consentDue && <span style={{ fontSize: 12, color: UI.muted }}>No flags recorded</span>}
            </div>
            <div style={{ fontSize: 11.5, color: UI.muted, lineHeight: 1.5 }}>{onSite ? <Chip tone="green">● On site</Chip> : <>{compact && 'Last activity: '}{activityDate(att)}</>}</div>
            {!compact && <span style={{ color: primary, fontSize: 18 }} aria-hidden="true">↗</span>}
          </button>
        )
      })}</div>}
    </section>
  )
}

export function PeopleProfileDrawer({ name, onClose, children }) {
  const mobile = useIsMobile()
  const dialog = useRef(null)
  const close = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const items = Array.from(dialog.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length)
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return createPortal(
    <div onClick={event => { if (event.target === event.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(15,23,42,.4)', display: 'flex', justifyContent: 'flex-end' }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-label={`${name} profile`} style={{ width: mobile ? '100%' : 'min(860px, 90vw)', height: '100%', background: UI.soft, boxShadow: '-12px 0 48px rgba(15,23,42,.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${UI.border}`, background: UI.surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: UI.text }}>Profile & support</span>
          <button ref={close} style={button} onClick={onClose} aria-label="Close profile">Close <span aria-hidden="true">×</span></button>
        </div>
        <div style={{ padding: mobile ? 12 : 20, overflowY: 'auto', overscrollBehavior: 'contain', flex: 1 }}>{children}</div>
      </section>
    </div>, document.body,
  )
}
