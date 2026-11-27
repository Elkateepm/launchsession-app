// The session builder's rules: what a plan is made of, how its times add up,
// what to bring, what is on now. Pure, so the builder, the running order, the
// print-out and the volunteer portal all agree.
//
// A plan is an ordered list of blocks stored on the session (sessions.plan).
// Times are not stored: each block's start follows from the session's start
// and the minutes before it, so moving or resizing one block never leaves the
// rest showing stale times.

export const KINDS = [
  { key: 'welcome', label: 'Welcome & check-in', icon: '👋' },
  { key: 'warmup', label: 'Warm-up', icon: '🔥' },
  { key: 'icebreaker', label: 'Icebreaker', icon: '😊' },
  { key: 'skill', label: 'Skill or drill', icon: '🎯' },
  { key: 'game', label: 'Game', icon: '🏆' },
  { key: 'activity', label: 'Main activity', icon: '✨' },
  { key: 'discussion', label: 'Discussion or workshop', icon: '💬' },
  { key: 'break', label: 'Break', icon: '🕐' },
  { key: 'cooldown', label: 'Cool-down', icon: '❤️' },
  { key: 'reflection', label: 'Reflection', icon: '💡' },
  { key: 'admin', label: 'Admin or transition', icon: '📋' },
]
export const kindOf = key => KINDS.find(k => k.key === key) || KINDS.find(k => k.key === 'activity')

const MAX_BLOCKS = 60
const clampMinutes = n => Math.max(1, Math.min(600, Math.round(Number(n) || 0) || 1))
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

let seq = 0
export const newId = () => (typeof window !== 'undefined' && window.crypto?.randomUUID
  ? window.crypto.randomUUID()
  : `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 7)}`)

/** A block with every field present and sane. */
export function newBlock(partial = {}) {
  return normaliseBlock({ id: newId(), kind: 'activity', title: '', minutes: 15, ...partial })
}

export function normaliseBlock(b = {}) {
  return {
    id: typeof b.id === 'string' && b.id ? b.id : newId(),
    kind: KINDS.some(k => k.key === b.kind) ? b.kind : 'activity',
    title: text(b.title, 120),
    minutes: clampMinutes(b.minutes ?? 15),
    details: text(b.details, 4000),
    equipment: Array.isArray(b.equipment) ? b.equipment.map(e => text(e, 80).trim()).filter(Boolean).slice(0, 40) : [],
    area: text(b.area, 80),
    lead_id: typeof b.lead_id === 'string' ? b.lead_id : '',
    groups: Array.isArray(b.groups) ? b.groups.filter(g => typeof g === 'string').slice(0, 20) : [],
    outcome: text(b.outcome, 40),
    safety: text(b.safety, 1000),
    easier: text(b.easier, 600),
    harder: text(b.harder, 600),
  }
}

/** Whatever is stored (null, an object, a bad array) becomes a clean list. */
export function normalisePlan(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter(b => b && typeof b === 'object').slice(0, MAX_BLOCKS).map(normaliseBlock)
}

/** For saving: drop blank optional fields so the stored plan stays small. */
export function toStored(blocks) {
  return normalisePlan(blocks).map(b => Object.fromEntries(Object.entries(b).filter(([k, v]) =>
    ['id', 'kind', 'title', 'minutes'].includes(k) || (Array.isArray(v) ? v.length : v))))
}

export const toMinutes = hhmm => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
export const toClock = mins => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Session length in minutes; a session that ends after midnight wraps. */
export function sessionLength(session) {
  const a = toMinutes(session?.start_time), b = toMinutes(session?.end_time)
  if (a == null || b == null) return null
  const d = b - a
  return d > 0 ? d : d + 1440
}

/** Each block with its start and end, counted from the session's start. */
export function withTimes(blocks, startHHMM) {
  const start = toMinutes(startHHMM)
  let at = 0
  return blocks.map(b => {
    const from = at
    at += b.minutes
    return { ...b, from, to: at, start: start == null ? null : toClock(start + from), end: start == null ? null : toClock(start + at) }
  })
}

/** How the plan fits the session: empty, room to spare, spot on, or over. */
export function fit(blocks, session) {
  const total = blocks.reduce((s, b) => s + b.minutes, 0)
  const length = sessionLength(session)
  if (!blocks.length) return { total, length, status: 'empty', text: length ? `Nothing planned yet for ${length} minutes` : 'Nothing planned yet' }
  if (length == null) return { total, length, status: 'fits', text: `${total} minutes planned` }
  if (total > length) return { total, length, over: total - length, status: 'over', text: `${total - length} min over the session` }
  if (total === length) return { total, length, status: 'fits', text: `All ${length} minutes planned` }
  return { total, length, spare: length - total, status: 'short', text: `${total} of ${length} min planned · ${length - total} min spare` }
}

/** Everything to bring, merged across blocks, with where each item is used. */
export function equipmentList(blocks) {
  const map = new Map()
  for (const b of blocks) for (const raw of b.equipment || []) {
    const key = raw.trim().toLowerCase()
    if (!key) continue
    if (!map.has(key)) map.set(key, { item: raw.trim(), uses: [] })
    const label = b.title || kindOf(b.kind).label
    if (!map.get(key).uses.includes(label)) map.get(key).uses.push(label)
  }
  return [...map.values()].sort((a, b) => a.item.localeCompare(b.item, 'en-GB'))
}

/** The outcome areas the plan works on, most-used first. */
export function outcomesCovered(blocks) {
  const counts = {}
  for (const b of blocks) if (b.outcome) counts[b.outcome] = (counts[b.outcome] || 0) + b.minutes
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, minutes]) => ({ key, minutes }))
}

/**
 * On the day: which block is on now, minutes left in it, and what is next.
 * nowMin is minutes since midnight (Europe/London). Null when the session is
 * not on today or has not started / has finished.
 */
export function nowInPlan(timed, session, today, nowMin) {
  if (!timed.length || !session?.session_date || session.session_date !== today) return null
  const start = toMinutes(session.start_time)
  if (start == null) return null
  const since = nowMin - start
  if (since < 0) return { phase: 'before', startsIn: -since, next: timed[0] }
  const i = timed.findIndex(b => since >= b.from && since < b.to)
  if (i === -1) return { phase: 'after' }
  return { phase: 'during', index: i, current: timed[i], left: timed[i].to - since, next: timed[i + 1] || null, progress: (since - timed[i].from) / timed[i].minutes }
}

export const moveBlock = (blocks, index, dir) => {
  const to = index + dir
  if (to < 0 || to >= blocks.length) return blocks
  const next = [...blocks]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}
export const duplicateBlock = (blocks, index) => [...blocks.slice(0, index + 1), { ...blocks[index], id: newId(), title: blocks[index].title ? `${blocks[index].title} (again)` : '' }, ...blocks.slice(index + 1)]
export const removeBlock = (blocks, index) => blocks.filter((_, i) => i !== index)

/**
 * A starting shape for an empty plan, sized to the session: welcome,
 * warm-up, the main part, a game, reflection. Every block is editable.
 */
export function scaffold(session) {
  const length = sessionLength(session) || 90
  const welcome = length >= 60 ? 10 : 5
  const warm = length >= 60 ? 15 : 10
  const reflect = length >= 60 ? 10 : 5
  const rest = Math.max(10, length - welcome - warm - reflect)
  const game = Math.max(5, Math.round(rest * 0.4 / 5) * 5)
  const main = Math.max(5, rest - game)
  return [
    newBlock({ kind: 'welcome', title: 'Welcome and check-in', minutes: welcome, details: 'Register, names, how is everyone feeling today?' }),
    newBlock({ kind: 'warmup', title: 'Warm-up', minutes: warm }),
    newBlock({ kind: 'activity', title: 'Main activity', minutes: main }),
    newBlock({ kind: 'game', title: 'Game', minutes: game }),
    newBlock({ kind: 'reflection', title: 'Reflection', minutes: reflect, details: 'One thing you enjoyed, one thing you learned.' }),
  ]
}

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const strip = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

function guessKind(title) {
  const t = title.toLowerCase()
  if (/welcome|intro|arrival|registration|check.?in/.test(t)) return 'welcome'
  if (/warm/.test(t)) return 'warmup'
  if (/ice.?break/.test(t)) return 'icebreaker'
  if (/cool/.test(t)) return 'cooldown'
  if (/reflect|debrief|review|wrap/.test(t)) return 'reflection'
  if (/break|snack|lunch/.test(t)) return 'break'
  if (/game|match|tournament|competition/.test(t)) return 'game'
  if (/skill|drill|technique|station/.test(t)) return 'skill'
  if (/discuss|workshop|talk/.test(t)) return 'discussion'
  return 'activity'
}

/**
 * Turn an older free-text session plan (Templates > Session Plans) into
 * blocks. Handles the two shapes those use: headings with "(15 mins)", and
 * lists of "09:00 - Registration" times.
 */
export function blocksFromHtml(html) {
  if (!html) return []
  const sections = []
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>|$)/gi
  let m
  while ((m = re.exec(html))) sections.push({ heading: strip(m[1]), body: m[2] })
  const blocks = []
  for (const s of sections) {
    const mins = /\((\d{1,3})\s*min/i.exec(s.heading)
    const items = [...s.body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(x => strip(x[1])).filter(Boolean)
    if (mins) {
      const title = s.heading.replace(/\(\s*\d{1,3}\s*mins?\s*\)/i, '').trim()
      blocks.push(newBlock({ kind: guessKind(title), title, minutes: Number(mins[1]), details: items.join('\n') }))
      continue
    }
    const timed = items.map(t => /^(\d{1,2}[:.]\d{2})\s*[-–—]\s*(.+)$/.exec(t)).filter(Boolean)
    if (timed.length >= 2) {
      timed.forEach((t, i) => {
        const a = toMinutes(t[1].replace('.', ':'))
        const b = timed[i + 1] ? toMinutes(timed[i + 1][1].replace('.', ':')) : null
        blocks.push(newBlock({ kind: guessKind(t[2]), title: t[2].trim(), minutes: b != null && b > a ? b - a : 30 }))
      })
    }
  }
  return blocks
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A readable HTML version, for plan templates and anything that shows text. */
export function planToHtml(blocks) {
  return blocks.map(b => {
    const lines = [b.details, b.equipment.length ? `Equipment: ${b.equipment.join(', ')}` : '', b.safety ? `Safety: ${b.safety}` : '']
      .filter(Boolean).flatMap(l => l.split('\n')).filter(Boolean)
    return `<h2>${esc(b.title || kindOf(b.kind).label)} (${b.minutes} mins)</h2>${lines.length ? `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`
  }).join('')
}

/**
 * Built-in ideas for the activity library, so a new organisation is not
 * staring at an empty list. Written for youth work; every one can be added
 * to a plan and changed.
 */
export const STARTER_ACTIVITIES = [
  { kind: 'welcome', title: 'Check-in circle', minutes: 10, details: 'Everyone says their name and one word for how they are feeling. Staff note anyone who seems low and check in quietly later.', outcome: 'wellbeing' },
  { kind: 'icebreaker', title: 'Two truths and a lie', minutes: 10, details: 'Each person shares three statements about themselves; the group guesses which is the lie.', outcome: 'social' },
  { kind: 'icebreaker', title: 'Line up without talking', minutes: 10, details: 'The group lines up by birthday (or height, or first name) using only gestures. Debrief: how did you communicate?', outcome: 'communication' },
  { kind: 'warmup', title: 'Dynamic warm-up', minutes: 10, details: 'Jog, high knees, heel flicks, side steps and arm circles across the space. Build pace gradually.', equipment: ['Cones'], outcome: 'wellbeing' },
  { kind: 'warmup', title: 'Tag with a twist', minutes: 10, details: 'Classic tag; when tagged, freeze with legs apart until a teammate crawls through to free you.', equipment: ['Bibs'], safety: 'Agree boundaries first. Tag on the back or shoulder only.', outcome: 'teamwork' },
  { kind: 'skill', title: 'Passing in pairs', minutes: 15, details: 'Pairs 5 metres apart pass and receive. Progress: one touch, weaker foot, moving.', equipment: ['Balls', 'Cones'], easier: 'Shorten the distance; let them stop the ball first.', harder: 'One touch only; add a defender.', outcome: 'confidence' },
  { kind: 'skill', title: 'Skill stations rotation', minutes: 30, details: 'Three or four stations, about 7 minutes each, rotating on a whistle. One leader per station.', equipment: ['Cones', 'Whistle', 'Timer'], outcome: 'confidence' },
  { kind: 'game', title: 'Small-sided game', minutes: 20, details: 'Short games of 4v4 or 5v5 on small pitches so everyone touches the ball. Rotate teams every 5 minutes.', equipment: ['Balls', 'Bibs', 'Cones'], outcome: 'teamwork' },
  { kind: 'game', title: 'Capture the flag', minutes: 20, details: 'Two teams each defend a flag in their half. Tagged players go to "jail" until freed by a teammate.', equipment: ['Bibs', 'Two flags or cones'], safety: 'Clear boundaries; walk in the jail area.', outcome: 'teamwork' },
  { kind: 'activity', title: 'Team build challenge', minutes: 25, details: 'Small teams build the tallest free-standing tower from limited materials in 15 minutes, then present it.', equipment: ['Paper', 'Tape', 'Straws'], outcome: 'teamwork' },
  { kind: 'activity', title: 'Creative poster', minutes: 30, details: 'In groups, design a poster on a theme (our club, kindness, a goal for the term). Share back to the group.', equipment: ['Paper', 'Pens', 'Glue'], outcome: 'communication' },
  { kind: 'discussion', title: 'Topic talk', minutes: 20, details: 'A short, structured conversation on a theme (online safety, healthy relationships, next steps). Agree ground rules first; use small groups.', safety: 'Signpost support. Follow safeguarding procedure if anything is disclosed.', outcome: 'wellbeing' },
  { kind: 'break', title: 'Water and snack break', minutes: 10, details: 'Everyone has a drink. Check allergies before any food is shared.', safety: 'Check the medical list for allergies.' },
  { kind: 'cooldown', title: 'Stretch and breathe', minutes: 5, details: 'Slow walking, then held stretches for legs and shoulders. Finish with three slow breaths.', outcome: 'wellbeing' },
  { kind: 'reflection', title: 'Rose, thorn, bud', minutes: 10, details: 'Each person shares a rose (something good), a thorn (something hard) and a bud (something they look forward to).', outcome: 'wellbeing' },
  { kind: 'reflection', title: 'Thumbs up, thumbs down', minutes: 5, details: 'Quick show of thumbs for each part of the session, so staff know what to keep and what to change.', outcome: 'communication' },
  { kind: 'admin', title: 'Sign-out and collection', minutes: 10, details: 'Collect equipment together, then sign each young person out to an approved adult.', safety: 'Check collection permissions before anyone leaves.' },
].map(a => ({ ...a, equipment: a.equipment || [], starter: true }))

/** One line for a card or a drawer: how many activities, and how they fit. */
export function planSummary(session) {
  const blocks = normalisePlan(session?.plan)
  const f = fit(blocks, session)
  return {
    count: blocks.length,
    text: f.length ? (f.status === 'over' ? `${f.over} min over` : f.status === 'fits' ? `fills all ${f.length} min` : `${f.total} of ${f.length} min`) : `${f.total} min`,
    titles: blocks.map(b => b.title || kindOf(b.kind).label).join(' → '),
  }
}
