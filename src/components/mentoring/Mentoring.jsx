import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../shared/PageHeader'

const OUTCOMES = [
  'Improve confidence',
  'Make friends',
  'Improve attendance',
  'Build positive relationships',
  'Improve wellbeing',
  'Develop new skills',
  'Increase engagement',
  'Build self-esteem',
  'Improve communication',
]

const MOODS = [
  { key: 'low', emoji: '😔', label: 'Low' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'amazing', emoji: '🌟', label: 'Amazing' },
]

export default function Mentoring({ org, session }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'

  const [view, setView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState([])
  const [team, setTeam] = useState([])
  const [referrals, setReferrals] = useState([])
  const [matches, setMatches] = useState([])
  const [sessions, setSessions] = useState([])
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)

  const load = async () => {
    if (!orgId) return
    setLoading(true)

    const [childrenRes, teamRes, referralsRes, matchesRes, sessionsRes] = await Promise.all([
      supabase.from('children').select('*').eq('org_id', orgId).eq('active', true).order('first_name'),
      supabase.from('user_profiles').select('*').eq('org_id', orgId).order('full_name'),
      supabase.from('mentoring_referrals').select('*, child:children(*)').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase
        .from('mentoring_matches')
        .select('*, child:children(*), volunteer:user_profiles!mentoring_matches_volunteer_id_fkey(*), supervisor:user_profiles!mentoring_matches_supervisor_id_fkey(*)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase.from('mentoring_sessions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10),
    ])

    setChildren(childrenRes.data || [])
    setTeam(teamRes.data || [])
    setReferrals(referralsRes.data || [])
    setMatches(matchesRes.data || [])
    setSessions(sessionsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (orgId) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const activeMatches = matches.filter(m => m.status === 'active')
  const awaiting = referrals.filter(r => r.status === 'awaiting_match')
  const reviewsDue = matches.filter(m => m.status === 'review')
  const thisMonth = matches.filter(m => {
    if (!m.created_at) return false
    const d = new Date(m.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  if (view === 'referral') {
    return (
      <ReferralForm
        org={org}
        children={children}
        session={session}
        primary={primary}
        onCancel={() => setView('dashboard')}
        onCreated={() => {
          load()
          setView('dashboard')
        }}
      />
    )
  }

  if (view === 'match') {
    return (
      <MatchForm
        org={org}
        children={children}
        team={team}
        referral={selectedReferral}
        session={session}
        primary={primary}
        onCancel={() => {
          setSelectedReferral(null)
          setView('dashboard')
        }}
        onCreated={() => {
          load()
          setSelectedReferral(null)
          setView('dashboard')
        }}
      />
    )
  }

  if (view === 'profile' && selectedMatch) {
    return (
      <MatchProfile
        org={org}
        match={selectedMatch}
        session={session}
        primary={primary}
        onBack={() => {
          setSelectedMatch(null)
          setView('dashboard')
          load()
        }}
      />
    )
  }

  return (
    <div style={{ ...styles.page, display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        icon="🤝"
        title="Mentoring"
        subtitle="Build long-term relationships, track outcomes and support every young person"
        primary={primary}
        stats={[
          { label: 'Active Matches', value: activeMatches.length, icon: '💚', color: '#16A34A' },
          { label: 'Awaiting Match', value: awaiting.length, icon: '⏰', color: '#F59E0B' },
          { label: 'Reviews Due', value: reviewsDue.length, icon: '⭐', color: '#E91E63' },
          { label: 'New This Month', value: thisMonth.length, icon: '✨', color: '#7C3AED' },
        ]}
        actions={[
          { label: '🌱 New Referral', onClick: () => setView('referral') },
          { label: '💞 New Match', onClick: () => { setSelectedReferral(null); setView('match') }, variant: 'ghost' },
        ]}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>

      <div style={styles.actionGrid}>
        <button style={{ ...styles.primaryAction, background: `linear-gradient(135deg, ${primary}, #7C3AED)` }} onClick={() => setView('referral')}>
          🌱 New Referral
        </button>
        <button style={{ ...styles.primaryAction, background: 'linear-gradient(135deg, #E91E63, #7C3AED)' }} onClick={() => { setSelectedReferral(null); setView('match') }}>
          💞 New Match
        </button>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading mentoring...</div>
      ) : (
        <div style={styles.grid}>
          <div style={styles.left}>
            <Panel title="📋 Awaiting Match">
              {awaiting.length === 0 ? (
                <Empty text="No referrals waiting to be matched." />
              ) : awaiting.map(ref => (
                <ReferralRow
                  key={ref.id}
                  referral={ref}
                  primary={primary}
                  onClick={() => {
                    setSelectedReferral(ref)
                    setView('match')
                  }}
                />
              ))}
            </Panel>

            <Panel title="💚 Active Matches">
              {activeMatches.length === 0 ? (
                <Empty text="No active mentoring matches yet." />
              ) : activeMatches.map(match => (
                <MatchRow
                  key={match.id}
                  match={match}
                  primary={primary}
                  onClick={() => {
                    setSelectedMatch(match)
                    setView('profile')
                  }}
                />
              ))}
            </Panel>
          </div>

          <div style={styles.right}>
            <Panel title="🕒 Recent Check-ins">
              {sessions.length === 0 ? (
                <Empty text="No mentoring check-ins logged yet." />
              ) : sessions.map(s => (
                <div key={s.id} style={styles.smallRow}>
                  <div style={{ fontSize: 24 }}>{MOODS.find(m => m.key === s.mood)?.emoji || '🙂'}</div>
                  <div>
                    <strong>{s.session_date}</strong>
                    <p>{s.notes || 'Mentoring check-in logged.'}</p>
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="🛤️ Mentoring Pathway">
              <PathwayStep number="1" title="Referral" text="A young person is referred for mentoring support." color={primary} />
              <PathwayStep number="2" title="Awaiting Match" text="Staff review needs and choose the right mentor." color="#F59E0B" />
              <PathwayStep number="3" title="Matched" text="Child, volunteer and supervising staff are linked." color="#E91E63" />
              <PathwayStep number="4" title="Active Mentoring" text="Regular sessions and check-ins begin." color="#16A34A" />
              <PathwayStep number="5" title="6-Week Review" text="Progress, relationship and safeguarding are reviewed." color="#7C3AED" />
              <PathwayStep number="6" title="Outcomes" text="Confidence, wellbeing and engagement are tracked." color="#2563EB" />
            </Panel>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function ReferralForm({ org, children, session, primary, onCancel, onCreated }) {
  const [childId, setChildId] = useState('')
  const [referredBy, setReferredBy] = useState('')
  const [reason, setReason] = useState('')
  const [supportNeeds, setSupportNeeds] = useState('')
  const [safeguardingNotes, setSafeguardingNotes] = useState('')
  const [outcomes, setOutcomes] = useState([])
  const [saving, setSaving] = useState(false)

  const toggle = outcome => {
    setOutcomes(prev => prev.includes(outcome) ? prev.filter(x => x !== outcome) : [...prev, outcome])
  }

  const save = async () => {
    if (!childId) return
    setSaving(true)

    const { data, error } = await supabase.from('mentoring_referrals').insert([{
      org_id: org.id,
      child_id: childId,
      referred_by: referredBy,
      reason,
      support_needs: supportNeeds,
      safeguarding_notes: safeguardingNotes || null,
      desired_outcomes: outcomes,
      status: 'awaiting_match',
      created_by: session?.user?.id || null,
    }]).select().single()

    if (!error && data) onCreated()
    setSaving(false)
  }

  return (
    <div style={styles.page}>
      <BackHeader title="New Mentoring Referral" subtitle="Start a young person's mentoring journey" onBack={onCancel} primary={primary} />

      <div style={styles.formWrap}>
        <Panel title="👦 Young Person">
          <select value={childId} onChange={e => setChildId(e.target.value)} style={styles.input}>
            <option value="">Select young person...</option>
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </Panel>

        <Panel title="📄 Referral Details">
          <Input label="Referred By" value={referredBy} onChange={setReferredBy} placeholder="e.g. School, Social Worker, Self" />
          <Textarea label="Reason for Referral" value={reason} onChange={setReason} placeholder="Why is this child being referred for mentoring?" />
          <Textarea label="Support Needs" value={supportNeeds} onChange={setSupportNeeds} placeholder="What support does this child need?" />
        </Panel>

        <Panel title="🎯 Desired Outcomes">
          <div style={styles.chipWrap}>
            {OUTCOMES.map(o => (
              <button key={o} onClick={() => toggle(o)} style={{ ...styles.chip, borderColor: outcomes.includes(o) ? primary : '#E5E7EB', background: outcomes.includes(o) ? primary + '18' : '#fff', color: outcomes.includes(o) ? primary : '#475569' }}>
                {outcomes.includes(o) ? '✓ ' : ''}{o}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="🛡️ Safeguarding Notes">
          <Textarea label="Staff only" value={safeguardingNotes} onChange={setSafeguardingNotes} placeholder="Confidential safeguarding notes..." />
        </Panel>

        <button onClick={save} disabled={!childId || saving} style={{ ...styles.saveButton, background: !childId || saving ? '#CBD5E1' : `linear-gradient(135deg, ${primary}, #7C3AED)` }}>
          {saving ? 'Creating...' : 'Create Referral'}
        </button>
      </div>
    </div>
  )
}

function MatchForm({ org, children, team, referral, session, primary, onCancel, onCreated }) {
  const [childId, setChildId] = useState(referral?.child_id || '')
  const [volunteerId, setVolunteerId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [frequency, setFrequency] = useState('weekly')
  const [saving, setSaving] = useState(false)

  const volunteers = team.filter(t => t.role === 'volunteer')
  const staff = team.filter(t => ['owner', 'admin', 'manager', 'staff'].includes(t.role))

  const save = async () => {
    if (!childId || !volunteerId || !supervisorId) return
    setSaving(true)

    const { data: match, error } = await supabase.from('mentoring_matches').insert([{
      org_id: org.id,
      referral_id: referral?.id || null,
      child_id: childId,
      volunteer_id: volunteerId,
      supervisor_id: supervisorId,
      start_date: startDate,
      frequency,
      status: 'active',
      focus_areas: referral?.desired_outcomes || [],
      created_by: session?.user?.id || null,
    }]).select().single()

    if (!error && match) {
      if (referral?.id) {
        await supabase.from('mentoring_referrals').update({ status: 'matched' }).eq('id', referral.id).eq('org_id', org.id)
      }

      await supabase.from('mentoring_timeline_events').insert([{
        org_id: org.id,
        match_id: match.id,
        event_type: 'matched',
        emoji: '🤝',
        title: 'Mentor Assigned',
        description: 'A mentoring match was created.',
        event_date: new Date().toISOString().slice(0, 10),
      }])

      const due = new Date(startDate)
      due.setDate(due.getDate() + 42)
      await supabase.from('mentoring_reviews').insert([{
        org_id: org.id,
        match_id: match.id,
        due_date: due.toISOString().slice(0, 10),
      }])

      onCreated()
    }

    setSaving(false)
  }

  return (
    <div style={styles.page}>
      <BackHeader title="Create Mentoring Match" subtitle="Connect a young person with a mentor and supervisor" onBack={onCancel} primary={primary} />

      <div style={styles.formWrap}>
        <Panel title="👥 People">
          <Field label="Young Person">
            <select value={childId} onChange={e => setChildId(e.target.value)} style={styles.input}>
              <option value="">Select young person...</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </Field>

          <Field label="Volunteer Mentor">
            <select value={volunteerId} onChange={e => setVolunteerId(e.target.value)} style={styles.input}>
              <option value="">Select volunteer...</option>
              {volunteers.map(v => <option key={v.id} value={v.id}>{v.full_name || v.email}</option>)}
            </select>
          </Field>

          <Field label="Supervising Staff">
            <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} style={styles.input}>
              <option value="">Select staff supervisor...</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
            </select>
          </Field>
        </Panel>

        <Panel title="📅 Match Details">
          <Input label="Start Date" type="date" value={startDate} onChange={setStartDate} />
          <Field label="Meeting Frequency">
            <div style={styles.frequencyGrid}>
              {['weekly', 'fortnightly', 'monthly'].map(f => (
                <button key={f} onClick={() => setFrequency(f)} style={{ ...styles.chip, borderColor: frequency === f ? primary : '#E5E7EB', background: frequency === f ? primary + '18' : '#fff', color: frequency === f ? primary : '#475569' }}>
                  {f}
                </button>
              ))}
            </div>
          </Field>
        </Panel>

        <button onClick={save} disabled={!childId || !volunteerId || !supervisorId || saving} style={{ ...styles.saveButton, background: (!childId || !volunteerId || !supervisorId || saving) ? '#CBD5E1' : 'linear-gradient(135deg, #E91E63, #7C3AED)' }}>
          {saving ? 'Creating...' : 'Confirm Match'}
        </button>
      </div>
    </div>
  )
}

function MatchProfile({ org, match, session, primary, onBack }) {
  const [checkMood, setCheckMood] = useState('good')
  const [notes, setNotes] = useState('')
  const [actions, setActions] = useState('')
  const [saving, setSaving] = useState(false)

  const childName = `${match.child?.first_name || ''} ${match.child?.last_name || ''}`.trim() || 'Young Person'
  const mentorName = match.volunteer?.full_name || match.volunteer?.email || 'Mentor'
  const supervisorName = match.supervisor?.full_name || match.supervisor?.email || 'Supervisor'

  const saveCheckIn = async () => {
    setSaving(true)
    await supabase.from('mentoring_sessions').insert([{
      org_id: org.id,
      match_id: match.id,
      session_date: new Date().toISOString().slice(0, 10),
      mood: checkMood,
      attended: true,
      notes,
      actions,
    }])

    await supabase.from('mentoring_timeline_events').insert([{
      org_id: org.id,
      match_id: match.id,
      event_type: 'activity',
      emoji: '⭐',
      title: 'Session Check-in',
      description: notes || 'Mentoring check-in logged.',
      event_date: new Date().toISOString().slice(0, 10),
    }])

    setNotes('')
    setActions('')
    setSaving(false)
    onBack()
  }

  return (
    <div style={styles.page}>
      <BackHeader title="Mentoring Match" subtitle={`${childName} with ${mentorName}`} onBack={onBack} primary={primary} />

      <div style={styles.formWrap}>
        <Panel title="🤝 Match Overview">
          <div style={styles.connection}>
            <PersonBubble name={childName} label="Young Person" color={primary} />
            <div style={styles.connectionLine}>MENTORING</div>
            <PersonBubble name={mentorName} label="Mentor" color="#E91E63" />
            <div style={styles.connectionLine}>SUPERVISED</div>
            <PersonBubble name={supervisorName} label="Supervisor" color="#16A34A" />
          </div>
        </Panel>

        <Panel title="🙂 Log Session Check-in">
          <Field label="Mood">
            <div style={styles.moodGrid}>
              {MOODS.map(m => (
                <button key={m.key} onClick={() => setCheckMood(m.key)} style={{ ...styles.moodButton, borderColor: checkMood === m.key ? primary : '#E5E7EB', background: checkMood === m.key ? primary + '18' : '#fff' }}>
                  <span>{m.emoji}</span>
                  <small>{m.label}</small>
                </button>
              ))}
            </div>
          </Field>

          <Textarea label="Session Notes" value={notes} onChange={setNotes} placeholder="How did the session go?" />
          <Textarea label="Actions Agreed" value={actions} onChange={setActions} placeholder="Next actions or follow-up needed..." />

          <button onClick={saveCheckIn} disabled={saving} style={{ ...styles.saveButton, background: `linear-gradient(135deg, ${primary}, #16A34A)` }}>
            {saving ? 'Saving...' : 'Save Check-in'}
          </button>
        </Panel>
      </div>
    </div>
  )
}


function PathwayStep({ number, title, text, color }) {
  return (
    <div style={styles.pathwayStep}>
      <div style={{ ...styles.pathwayNumber, background: color }}>{number}</div>
      <div>
        <div style={styles.pathwayTitle}>{title}</div>
        <div style={styles.pathwayText}>{text}</div>
      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>{title}</h3>
      {children}
    </div>
  )
}

function ReferralRow({ referral, primary, onClick }) {
  const child = referral.child
  const name = child ? `${child.first_name} ${child.last_name}` : 'Unknown child'

  return (
    <button onClick={onClick} style={styles.row}>
      <div style={{ ...styles.avatar, background: primary }}>{name[0]}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <strong>{name}</strong>
        <p>{referral.reason || 'Awaiting mentoring match'}</p>
      </div>
      <span style={styles.pendingBadge}>Match →</span>
    </button>
  )
}

function MatchRow({ match, primary, onClick }) {
  const child = match.child
  const name = child ? `${child.first_name} ${child.last_name}` : 'Unknown child'
  const mentor = match.volunteer?.full_name || match.volunteer?.email || 'Mentor'

  return (
    <button onClick={onClick} style={styles.row}>
      <div style={styles.avatarStack}>
        <div style={{ ...styles.avatar, background: primary }}>{name[0]}</div>
        <div style={{ ...styles.avatar, background: '#E91E63', marginLeft: -10 }}>{mentor[0]}</div>
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <strong>{name}</strong>
        <p>with {mentor}</p>
      </div>
      <span style={styles.activeBadge}>Active</span>
    </button>
  )
}

function Empty({ text }) {
  return <div style={styles.empty}>{text}</div>
}

function BackHeader({ title, subtitle, onBack, primary }) {
  return (
    <div style={{ ...styles.backHeader, background: `linear-gradient(135deg, ${primary}, #2D1B4E)` }}>
      <button onClick={onBack} style={styles.backButton}>←</button>
      <div>
        <h1 style={styles.backTitle}>{title}</h1>
        <p style={styles.backSubtitle}>{subtitle}</p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={styles.input} />
    </Field>
  )
}

function Textarea({ label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...styles.input, resize: 'none', lineHeight: 1.5 }} />
    </Field>
  )
}

function PersonBubble({ name, label, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...styles.bigAvatar, background: color }}>{name[0]}</div>
      <div style={styles.bubbleLabel}>{label}</div>
      <div style={styles.bubbleName}>{name.split(' ')[0]}</div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100%',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, #F8FBFF 0%, #EEF4FA 100%)',
    color: 'var(--text)',
  },
  hero: {
    borderRadius: 22,
    color: '#fff',
    margin: 22,
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 18px 38px rgba(15,23,42,0.18)',
  },
  kicker: {
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 2,
    opacity: 0.8,
  },
  title: {
    fontSize: 32,
    fontWeight: 950,
    margin: '8px 0 6px',
  },
  subtitle: {
    margin: 0,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
  },
  heroEmoji: {
    fontSize: 72,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
    gap: 14,
    padding: '0 22px 18px',
  },
  metric: {
    background: 'var(--surface)',
    border: '1px solid #E5EAF2',
    borderRadius: 18,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 950,
  },
  metricLabel: {
    fontSize: 11,
    color: 'var(--text3)',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    padding: '0 22px 18px',
  },
  primaryAction: {
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    padding: 15,
    fontSize: 15,
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(124,58,237,0.22)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: 18,
    padding: '0 22px 22px',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  right: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  panel: {
    background: 'var(--surface)',
    border: '1px solid #E5EAF2',
    borderRadius: 20,
    padding: 18,
    boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
  },
  panelTitle: {
    margin: '0 0 14px',
    fontSize: 16,
    fontWeight: 950,
  },
  row: {
    width: '100%',
    border: '1px solid #E5EAF2',
    background: 'var(--surface2)',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    cursor: 'pointer',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 950,
    flexShrink: 0,
  },
  avatarStack: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  pendingBadge: {
    background: '#FEF3C7',
    color: '#B45309',
    borderRadius: 999,
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 950,
  },
  activeBadge: {
    background: '#DCFCE7',
    color: '#15803D',
    borderRadius: 999,
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 950,
  },
  empty: {
    textAlign: 'center',
    padding: 28,
    color: 'var(--text3)',
    fontWeight: 800,
  },
  smallRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #EEF2F7',
  },
  pathwayStep: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    background: 'var(--surface2)',
    border: '1px solid #E5EAF2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  pathwayNumber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 950,
    flexShrink: 0,
  },
  pathwayTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: 'var(--text)',
  },
  pathwayText: {
    fontSize: 12,
    color: 'var(--text3)',
    marginTop: 3,
    lineHeight: 1.4,
  },
  nextStep: {
    background: 'var(--surface2)',
    border: '1px solid #E5EAF2',
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text2)',
  },
  formWrap: {
    maxWidth: 680,
    margin: '0 auto',
    padding: 22,
  },
  backHeader: {
    padding: 22,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: 'none',
    background: 'rgba(255,255,255,0.16)',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
  },
  backTitle: {
    margin: 0,
    fontSize: 23,
    fontWeight: 950,
  },
  backSubtitle: {
    margin: '4px 0 0',
    color: 'rgba(255,255,255,0.72)',
  },
  input: {
    width: '100%',
    border: '1.5px solid #E5E7EB',
    borderRadius: 12,
    padding: '11px 13px',
    fontSize: 14,
    outline: 'none',
    background: '#F9FAFB',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  label: {
    fontSize: 11,
    fontWeight: 900,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    display: 'block',
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    border: '1.5px solid #E5E7EB',
    borderRadius: 999,
    background: 'var(--surface)',
    padding: '9px 13px',
    fontSize: 13,
    fontWeight: 850,
    cursor: 'pointer',
    textTransform: 'capitalize',
  },
  saveButton: {
    width: '100%',
    border: 'none',
    color: '#fff',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontWeight: 950,
    cursor: 'pointer',
    marginBottom: 30,
  },
  frequencyGrid: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  connection: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr auto 1fr',
    alignItems: 'center',
    gap: 10,
  },
  connectionLine: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: 950,
    textAlign: 'center',
  },
  bigAvatar: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 950,
    fontSize: 22,
    margin: '0 auto 6px',
  },
  bubbleLabel: {
    fontSize: 10,
    color: 'var(--text3)',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  bubbleName: {
    fontSize: 13,
    fontWeight: 850,
  },
  moodGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5,1fr)',
    gap: 8,
  },
  moodButton: {
    border: '1.5px solid #E5E7EB',
    borderRadius: 12,
    background: 'var(--surface)',
    padding: '10px 6px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
  },
}