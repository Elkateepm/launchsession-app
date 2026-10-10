import React, { useMemo, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { useTerms } from '../../context/OrgContext'
import { getAuthBranding } from '../auth/authBranding'
import { brandPalette } from '../../lib/brandColors'
import { OrgLogo, orgBrand } from '../shared/OrgPageHero'
import Icon from '../../lib/icons'
import { buildTodaySummary } from './todayModel'
import useTodayData from './useTodayData'

const CARD = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }
const BUTTON = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, padding: '10px 15px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer', outlineOffset: 3 }
const PHASE = {
  live: { label: 'Running now', color: 'var(--ok-text)', bg: 'var(--ok-bg)' },
  upcoming: { label: 'Later today', color: 'var(--today-ink)', bg: 'var(--today-tint)' },
  completed: { label: 'Finished', color: 'var(--text3)', bg: 'var(--surface2)' },
  scheduled: { label: 'Time to confirm', color: 'var(--warn-text)', bg: 'var(--warn-bg)' },
  draft: { label: 'Draft', color: 'var(--text3)', bg: 'var(--surface2)' },
}
const show = n => n == null ? '—' : n
const time = value => value ? String(value).slice(0, 5) : 'Time to confirm'
const dateLabel = value => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`))

function Stat({ icon, value, label, detail }) {
  return <div style={{ ...CARD, padding: '17px 18px', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text3)' }}>{label}</span>
      <Icon name={icon} size={17} style={{ color: 'var(--today-ink)' }} />
    </div>
    <div style={{ fontSize: 29, lineHeight: 1.1, fontWeight: 800, letterSpacing: -0.8, color: 'var(--text)' }}>{show(value)}</div>
    <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text3)', marginTop: 6 }}>{detail}</div>
  </div>
}

function SectionTitle({ icon, children, detail }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
    <Icon name={icon} size={17} style={{ color: 'var(--today-ink)' }} />
    <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 800 }}>{children}</h2>
    {detail && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)' }}>{detail}</span>}
  </div>
}

export default function Today({ org, userProfile, onNavigate, access = {}, newResponses = 0 }) {
  const terms = useTerms()
  const mobile = useIsMobile()
  const compact = useIsMobile(1100)
  const dark = useIsDarkTheme()
  const brand = getAuthBranding(org)
  const palette = brandPalette(brand.primary, dark)
  const identity = { name: brand.name, logo_url: brand.logo, primary_color: brand.primary, secondary_color: brand.secondary, accent_color: brand.accent }
  const colours = orgBrand(identity)
  const { data, loading, refreshing, checkedAt, refresh } = useTodayData(org?.id, access)
  const summary = useMemo(() => buildTodaySummary(data?.sessions || [], data?.attendance, data?.staff), [data])
  const [filter, setFilter] = useState('all')
  const heading = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const openRegister = id => onNavigate?.('registers', id ? { sessionId: id, returnTo: 'today' } : undefined)
  const editPlan = s => onNavigate?.('planner', access.plannerEdit ? { editSessionId: s.id } : undefined)
  const createPlan = () => onNavigate?.('planner', { autoOpenWizard: true })
  const next = summary.running[0] || summary.today.find(s => s.phase === 'upcoming') || summary.next[0]
  const errors = data?.errors || []
  const deliveryUnknown = loading || !data?.sessions || (summary.delivery.length > 0 && (!data?.attendance || !data?.staff)) || errors.some(e => ['overview', 'schedule', 'attendance', 'staffing'].includes(e))
  const priorities = []
  const addRegisters = (rows, id, title, detail) => {
    if (!rows.length || !access.registers) return
    priorities.push({ id, icon: 'registers', title, detail, count: rows.length, label: access.registerEdit ? rows.length === 1 ? 'Open register' : 'Open registers' : 'View registers', action: () => openRegister(access.registerEdit && rows.length === 1 ? rows[0].id : null) })
  }
  addRegisters(summary.leftOpen, 'left-open', `${summary.leftOpen.length} register${summary.leftOpen.length === 1 ? '' : 's'} left open`, summary.leftOpen.length === 1 ? `${summary.leftOpen[0].title || terms.Session} has finished with ${summary.leftOpen[0].present} still signed in.` : `Check sign-outs for finished ${terms.sessions}.`)
  addRegisters(summary.notStarted, 'not-started', `${summary.notStarted.length} register${summary.notStarted.length === 1 ? '' : 's'} not started`, summary.notStarted.length === 1 ? `${summary.notStarted[0].title || terms.Session} is running with nobody marked in` : `${terms.Sessions} are running with nobody marked in`)
  if (summary.unstaffed.length && access.planner) priorities.push({ id: 'staffing', icon: 'team', count: summary.unstaffed.length, title: `${summary.unstaffed.length} ${summary.unstaffed.length === 1 ? terms.session : terms.sessions} with no team assigned`, detail: 'Review who is supporting delivery.', label: 'Review staffing', action: () => editPlan(summary.unstaffed[0]) })
  if (summary.untimed.length && access.planner) priorities.push({ id: 'times', icon: 'clock', count: summary.untimed.length, title: 'Start times need confirming', detail: `${summary.untimed.length} ${summary.untimed.length === 1 ? terms.session : terms.sessions} without a start time.`, label: 'Review plans', action: () => editPlan(summary.untimed[0]) })
  const priorityCount = priorities.reduce((n, p) => n + p.count, 0)
  const filters = [{ key: 'all', label: 'All' }, ...Object.entries(PHASE).filter(([key]) => summary.today.some(s => s.phase === key)).map(([key, meta]) => ({ key, label: meta.label }))]
  const activeFilter = filters.some(f => f.key === filter) ? filter : 'all'
  const order = { live: 0, upcoming: 1, scheduled: 2, draft: 3, completed: 4 }
  const visible = summary.today.filter(s => activeFilter === 'all' || s.phase === activeFilter).sort((a, b) => order[a.phase] - order[b.phase] || (a.start_time || '').localeCompare(b.start_time || ''))
  const shortcuts = [
    access.plannerEdit && { label: `Plan a ${terms.session}`, detail: 'Set up your next activity', icon: 'add', action: createPlan },
    access.registers && { label: 'Registers', detail: 'Attendance and sign-outs', icon: 'registers', action: () => openRegister(null) },
    access.risk && { label: 'Risk assessments', detail: 'Get ready for safe delivery', icon: 'safeguarding', action: () => onNavigate?.('risk_assessments') },
    access.office && { label: 'Open Office', detail: 'Forms, communications and admin', icon: 'operations', action: () => onNavigate?.('office') },
  ].filter(Boolean)
  const primaryButton = { ...BUTTON, background: colours.ink, color: '#fff', borderColor: 'transparent' }

  return <div style={{ '--today-ink': palette.ink, '--today-tint': palette.tint, '--today-border': palette.border, '--font': brand.font.body, '--font-display': brand.font.display, fontFamily: brand.font.body, padding: mobile ? '16px 12px 28px' : '22px 24px 36px', width: '100%', maxWidth: 1480, boxSizing: 'border-box', margin: '0 auto' }}>
    <section aria-label="Today overview" style={{ background: colours.hero, color: '#fff', borderRadius: mobile ? 22 : 26, padding: mobile ? 22 : '26px 30px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', width: 440, height: 440, border: '1px solid #ffffff20', borderRadius: '50%', right: -120, top: -220, pointerEvents: 'none' }} />
      <div style={{ flex: '1 1 340px', minWidth: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <OrgLogo org={identity} height={46} maxWidth={150} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{brand.name}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#ffffffd6' }}>{heading}</div>
          </div>
        </div>
        <h1 style={{ margin: 0, fontFamily: brand.font.display, fontSize: mobile ? 30 : 36, letterSpacing: -0.9, fontWeight: 800, lineHeight: 1.15 }}>Today, at a glance.</h1>
        <p style={{ margin: '9px 0 18px', fontSize: 13.5, lineHeight: 1.6, color: '#ffffffde' }}>{userProfile?.full_name ? `${userProfile.full_name.split(' ')[0]}, here's` : 'Here’s'} what’s happening, what needs you and what’s next.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {access.calendar && <button type="button" onClick={() => onNavigate?.('calendar')} style={{ ...BUTTON, background: '#fff', borderColor: 'transparent', color: colours.ink }}><Icon name="calendar" size={16} />Open calendar</button>}
          {access.plannerEdit && <button type="button" onClick={createPlan} style={{ ...BUTTON, color: '#fff', background: '#ffffff16', borderColor: '#ffffff55' }}><Icon name="add" size={16} />New {terms.session}</button>}
        </div>
      </div>
      {!compact && <div style={{ flex: '0 1 330px', minWidth: 0, padding: '20px 22px', border: '1px solid #ffffff35', background: '#00000020', borderRadius: 18, position: 'relative' }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4, color: '#ffffffcc', marginBottom: 10 }}>{loading ? 'Your day' : next?.phase === 'live' ? 'Happening now' : 'Next up'}</div>
        <div style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 800 }}>{loading ? 'Getting things ready…' : next ? next.title || terms.Session : data?.sessions ? 'A little room to plan ahead' : 'Your delivery overview'}</div>
        <div style={{ fontSize: 12.5, color: '#ffffffde', marginTop: 9, lineHeight: 1.7 }}>{next ? `${dateLabel(next.session_date)} · ${time(next.start_time)}` : 'Keep your team prepared for the days ahead.'}</div>
        {next?.location && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ffffffde', marginTop: 6 }}><Icon name="location" size={14} />{next.location}</div>}
        {next?.phase === 'live' && access.registerEdit && <button type="button" onClick={() => openRegister(next.id)} style={{ ...BUTTON, marginTop: 14, width: '100%', color: colours.ink }}>Open live register<Icon name="→" size={14} /></button>}
      </div>}
    </section>

    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
      <span role="status" style={{ color: 'var(--text3)', fontSize: 11.5 }}>{loading ? 'Loading your day…' : checkedAt ? `Last checked ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(checkedAt)} · updates every minute` : ''}</span>
      <button type="button" onClick={refresh} disabled={refreshing} style={{ ...BUTTON, padding: '8px 12px', minHeight: 44, background: 'transparent', opacity: refreshing ? 0.6 : 1 }}><Icon name="🔄" size={14} />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    {errors.length > 0 && <div role="alert" style={{ ...CARD, borderColor: 'var(--warn-border)', background: 'var(--warn-bg)', color: 'var(--warn-text)', padding: '14px 18px', marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
      We couldn’t update {errors.join(', ')}. Unavailable figures are shown as —. Refresh to try again.
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 26 }}>
      <Stat icon="sessions" value={data?.sessions ? summary.delivery.length : null} label={`${terms.Sessions} today`} detail={data?.sessions ? `${summary.running.length} running now${summary.today.some(s => s.phase === 'draft') ? ' · drafts below' : ''}` : access.schedule ? 'Waiting for the schedule' : 'Schedule access required'} />
      <Stat icon="children" value={summary.onSite} label={`${terms.People} signed in`} detail={access.registers ? 'Unique people across today' : 'Register access required'} />
      <Stat icon="team" value={summary.staffOnSite} label="Team on site" detail={access.planner ? 'Signed in and not signed out' : 'Planner access required'} />
      <Stat icon="bell" value={deliveryUnknown ? null : priorityCount} label="Delivery checks" detail={deliveryUnknown ? 'Some checks unavailable' : priorityCount ? 'Follow up below' : 'No issues flagged'} />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(0, 1.65fr) minmax(300px, 1fr)', alignItems: 'start', gap: 22 }}>
      <div style={{ minWidth: 0 }}>
        <section aria-label="Delivery priorities" style={{ ...CARD, padding: mobile ? 17 : 21, marginBottom: 22 }}>
          <SectionTitle icon="today">Needs attention</SectionTitle>
          {priorities.length > 0 ? <div style={{ display: 'grid', gap: 12 }}>{priorities.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 14px', borderRadius: 12, background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
            <Icon name={item.icon} size={18} style={{ color: 'var(--warn-text)' }} />
            <div style={{ flex: '1 1 200px', minWidth: 0 }}><div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 800 }}>{item.title}</div><div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text3)', marginTop: 4 }}>{item.detail}</div></div>
            <button type="button" onClick={item.action} style={{ ...BUTTON, width: mobile ? '100%' : undefined }}>{item.label}<Icon name="→" size={14} /></button>
          </div>)}</div> : <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', color: 'var(--text3)', fontSize: 13, lineHeight: 1.65 }}><Icon name={deliveryUnknown ? 'clock' : 'check'} size={21} style={{ color: 'var(--today-ink)' }} /><span>{loading ? 'Checking your day…' : deliveryUnknown ? 'Some delivery checks are unavailable. Check the relevant tools before relying on the overview.' : summary.delivery.length ? 'No register or staffing issues flagged for today.' : `No ${terms.sessions} scheduled today. Use the next few days to get ahead.`}</span></div>}
        </section>

        <section aria-label="Today’s schedule">
          <SectionTitle icon="calendar">Today’s schedule</SectionTitle>
          {summary.today.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {filters.map(f => <button key={f.key} type="button" aria-pressed={activeFilter === f.key} onClick={() => setFilter(f.key)} style={{ ...BUTTON, padding: '8px 12px', fontSize: 11.5, background: activeFilter === f.key ? 'var(--today-tint)' : 'var(--surface)', borderColor: activeFilter === f.key ? 'var(--today-border)' : 'var(--border)', color: activeFilter === f.key ? 'var(--today-ink)' : 'var(--text3)' }}>{f.label}</button>)}
          </div>}
          <div style={{ display: 'grid', gap: 12 }}>
            {visible.map(s => {
              const meta = PHASE[s.phase]
              return <article key={s.id} style={{ ...CARD, padding: mobile ? 17 : 21, borderLeft: `4px solid ${s.phase === 'live' ? 'var(--ok-text)' : 'var(--today-border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, padding: '4px 9px', borderRadius: 7, color: meta.color, background: meta.bg, fontWeight: 750 }}>{meta.label}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 12 }}>{time(s.start_time)}{s.end_time ? `–${time(s.end_time)}` : ''}</span>
                  {s.session_date < data?.day && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Continues from {dateLabel(s.session_date)}</span>}
                </div>
                <h3 style={{ margin: '0 0 7px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{s.title || terms.Session}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}><Icon name="location" size={14} />{s.location || 'Location to confirm'}</div>
                {s.phase !== 'draft' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: '13px 0', marginBottom: 14, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', gap: 8 }}>
                  {[{ n: s.present, label: 'Signed in' }, { n: s.waiting, label: 'Awaiting arrival' }, { n: s.staffAssigned == null ? null : `${s.staffOnSite}/${s.staffAssigned}`, label: 'Team on site' }].map(metric => <div key={metric.label}><div style={{ color: 'var(--text)', fontSize: 19, fontWeight: 800 }}>{show(metric.n)}</div><div style={{ marginTop: 4, color: 'var(--text3)', fontSize: 11 }}>{metric.label}</div></div>)}
                </div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{s.phase === 'draft' ? 'Finish planning before delivery.' : s.signedOut != null ? `${s.signedOut} signed out · ${s.absent} absent` : 'Attendance unavailable'}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {access.planner && <button type="button" onClick={() => editPlan(s)} style={BUTTON}>{s.phase === 'draft' && access.plannerEdit ? 'Continue planning' : access.plannerEdit ? 'Review plan' : 'View plans'}</button>}
                    {s.phase !== 'draft' && access.registers && <button type="button" onClick={() => openRegister(access.registerEdit ? s.id : null)} style={primaryButton}>{access.registerEdit ? 'Open register' : 'View registers'}<Icon name="→" size={14} /></button>}
                  </div>
                </div>
              </article>
            })}
            {visible.length === 0 && <div style={{ ...CARD, padding: mobile ? 22 : 28, background: 'linear-gradient(120deg, var(--surface), var(--today-tint))' }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', color: 'var(--today-ink)', background: 'var(--today-tint)', marginBottom: 15 }}><Icon name="calendar" size={23} /></span>
              <h3 style={{ fontSize: 17, margin: '0 0 8px', color: 'var(--text)' }}>{loading ? 'Your schedule is loading' : !access.schedule ? 'Schedule access is not available' : !data?.sessions ? 'Your schedule is unavailable' : 'A quieter day for delivery'}</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text3)', maxWidth: 440 }}>{!data?.sessions ? 'Use the tools you can access, or refresh to try loading the overview again.' : `No ${terms.sessions} scheduled today. Look ahead, prepare your plans or catch up with the team.`}</p>
              {access.plannerEdit && <button type="button" onClick={createPlan} style={{ ...primaryButton, marginTop: 18 }}><Icon name="add" size={15} />Plan a {terms.session}</button>}
            </div>}
          </div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 20, minWidth: 0 }}>
        {access.schedule && <section aria-label="Next seven days" style={{ ...CARD, padding: mobile ? 18 : 22 }}>
          <SectionTitle icon="clock" detail={data?.sessions ? `${summary.next.length} planned` : undefined}>Next 7 days</SectionTitle>
          {summary.next.length ? summary.next.slice(0, 3).map((s, i) => <div key={s.id} style={{ padding: i ? '16px 0 0' : '2px 0 0', marginTop: i ? 16 : 0, borderTop: i ? '1px solid var(--border)' : undefined }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--today-ink)', marginBottom: 7 }}>{dateLabel(s.session_date)} · {time(s.start_time)}</div>
            <h3 style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>{s.title || terms.Session}</h3>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{s.location || 'Location to confirm'}</div>
            {access.planner && <button type="button" onClick={() => editPlan(s)} style={{ ...BUTTON, minHeight: 44, fontSize: 11.5 }}>{access.plannerEdit ? 'Review plan' : 'View plans'}<Icon name="→" size={13} /></button>}
          </div>) : <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text3)', margin: 0 }}>{loading ? 'Looking ahead…' : data?.sessions ? `No published ${terms.sessions} in the next seven days. Drafts are available in your plans.` : 'Upcoming plans are unavailable. Refresh to try again.'}</p>}
          {access.calendar && <button type="button" onClick={() => onNavigate?.('calendar')} style={{ ...BUTTON, marginTop: 17, width: '100%', color: 'var(--today-ink)' }}>View full calendar<Icon name="→" size={14} /></button>}
        </section>}

        {(access.hr || (access.forms && newResponses > 0)) && <section aria-label="Team and admin follow-ups" style={{ ...CARD, padding: mobile ? 18 : 22 }}>
          <SectionTitle icon="team">Also on your list</SectionTitle>
          {access.hr && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}><span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 750 }}>HR follow-ups</span><strong style={{ fontSize: 22, color: 'var(--text)' }}>{show(data?.hr?.count)}</strong></div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 13 }}>{data?.hr ? data.hr.urgent == null ? 'Urgency check unavailable. Open HR to review.' : <><span style={{ fontWeight: 750, color: data.hr.urgent ? 'var(--warn-text)' : 'var(--text2)' }}>{data.hr.urgent} urgent</span> · {Math.max(0, data.hr.count - data.hr.urgent)} other follow-ups<br />Compliance, reviews and team records.</> : loading ? 'Checking team follow-ups…' : 'HR overview unavailable. Open HR to check.'}</div>
            <button type="button" onClick={() => onNavigate?.('hr')} style={{ ...BUTTON, width: '100%' }}>Review HR<Icon name="→" size={14} /></button>
          </>}
          {access.forms && newResponses > 0 && <button type="button" onClick={() => onNavigate?.('forms')} style={{ ...BUTTON, marginTop: access.hr ? 12 : 0, justifyContent: 'space-between', width: '100%', textAlign: 'left' }}><span>{newResponses} new form {newResponses === 1 ? 'response' : 'responses'}</span><Icon name="→" size={14} /></button>}
        </section>}

        {shortcuts.length > 0 && <section aria-label="Useful shortcuts" style={{ ...CARD, padding: mobile ? 18 : 22 }}>
          <SectionTitle icon="operations">Useful shortcuts</SectionTitle>
          <div style={{ display: 'grid', gap: 4 }}>{shortcuts.map(action => <button key={action.label} type="button" onClick={action.action} style={{ ...BUTTON, justifyContent: 'flex-start', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 0', gap: 12 }}>
            <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 11, background: 'var(--today-tint)', color: 'var(--today-ink)', flexShrink: 0 }}><Icon name={action.icon} size={17} /></span>
            <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 12.5 }}>{action.label}</span><span style={{ display: 'block', marginTop: 4, color: 'var(--text3)', fontSize: 11.5, fontWeight: 400 }}>{action.detail}</span></span><Icon name="chevron" size={15} />
          </button>)}</div>
        </section>}
      </aside>
    </div>
  </div>
}
