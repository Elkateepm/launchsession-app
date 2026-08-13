import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";

/**
 * LiveRegister — live session register.
 *
 * Perf notes:
 *  - No backdrop-filter or filter:blur (both force expensive off-screen passes
 *    on iOS WebKit). Ambient colour is a static gradient.
 *  - Only transform/opacity are animated, so everything stays on the compositor.
 *  - Ambient loops pause when the tab is hidden and stop after the session card
 *    scrolls away, so a register left open all day doesn't burn battery.
 *  - Rows are memoised and use content-visibility, so a 200-child register
 *    only paints what's on screen.
 */

/* ------------------------------------------------------------------ tokens */
const T = {
  bg: "#F5F3FF", card: "#FFFFFF",
  ink: "#170F2E", ink2: "#584C7A", ink3: "#9990B5", line: "#EAE4FA",
  violet: "#6D28D9", violetLite: "#8B5CF6",
  radius: 20,
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
};

const STATUS = {
  onsite:   { label: "On site",    c: "#00A37A", bg: "#E3F9F1", grad: "linear-gradient(135deg,#00C48C,#00A37A)", emoji: "🎉" },
  expected: { label: "Expected",   c: "#E08700", bg: "#FFF4E0", grad: "linear-gradient(135deg,#FFB627,#E08700)", emoji: "⏳" },
  absent:   { label: "Absent",     c: "#E5326B", bg: "#FFE9F0", grad: "linear-gradient(135deg,#FF6B9D,#E5326B)", emoji: "📩" },
  out:      { label: "Signed out", c: "#4F7BEF", bg: "#E8EFFF", grad: "linear-gradient(135deg,#7BA0FF,#4F7BEF)", emoji: "👋" },
};
const ORDER = ["onsite", "expected", "absent", "out"];

const BUBBLES = {
  Blue:  "linear-gradient(135deg,#6EA8FF,#3B6FE0)",
  Green: "linear-gradient(135deg,#5FE3A1,#12A06B)",
  Amber: "linear-gradient(135deg,#FFCF5C,#F09000)",
  Pink:  "linear-gradient(135deg,#FF9BC4,#E5326B)",
};

const SHEET_ACTIONS = [
  ["📝", "Session notes", "Log what happened today", "#8B5CF6"],
  ["✏️", "Correct attendance", "Fix a sign-in or sign-out time", "#4F7BEF"],
  ["🙌", "Head count", "Confirm everyone on site right now", "#00A37A"],
  ["🏁", "End session", "Sign out everyone and close the register", "#E5326B"],
];

const EMPTY_COPY = {
  onsite:   { e: "👟", h: "Nobody signed in yet", p: "Sign someone in from Expected to start the register." },
  expected: { e: "✅", h: "Everyone is accounted for", p: "Every young person on today's list has been marked." },
  absent:   { e: "🌤️", h: "No absences", p: "Mark someone absent if they don't arrive." },
  out:      { e: "🏠", h: "Nobody has left yet", p: "Sign-outs appear here as people go home." },
};

/* -------------------------------------------------------------- demo data */
const DEMO = {
  title: "Summer Project 2026", dayLabel: "Day 4", venue: "Community Centre",
  start: "10:00", end: "16:00", now: "11:30",
  team: [{ id: "t1", name: "Mohammed Elkateep", role: "Lead", status: "out" }],
  people: [
    { id: "1", name: "Amira Hassan", bubble: "Blue",  age: 12, in: "10:04", status: "onsite", flag: null },
    { id: "2", name: "Kai Osei",     bubble: "Blue",  age: 13, in: "10:06", status: "onsite", flag: "medical" },
    { id: "3", name: "Leila Rahman", bubble: "Green", age: 11, in: "10:11", status: "onsite", flag: null },
    { id: "4", name: "Tomas Nowak",  bubble: "Green", age: 14, in: "10:12", status: "onsite", flag: null },
    { id: "5", name: "Nia Campbell", bubble: "Amber", age: 12, in: "10:31", status: "onsite", flag: "walkin" },
    { id: "6", name: "Jonah Blake",  bubble: "Amber", age: 13, in: null,    status: "expected", flag: null },
    { id: "7", name: "Priya Shah",   bubble: "Pink",  age: 11, in: null,    status: "expected", flag: "medical" },
  ],
};

/* ------------------------------------------------------------- utilities */
const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const initials = (n) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

/** Collects timers so nothing fires after unmount. */
function useTimers() {
  const ids = useRef([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  return useCallback((fn, ms) => { ids.current.push(setTimeout(fn, ms)); }, []);
}

/** Pauses ambient animation when the tab is backgrounded. */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/** Value that flags a change, so CSS can bump it. No rAF loop. */
const Tick = memo(function Tick({ value }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  const after = useTimers();
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setBump(true);
    after(() => setBump(false), 400);
  }, [value, after]);
  return <span className={bump ? "ls-bump" : undefined} style={ST.tick}>{value}</span>;
});

/* ============================================================= component */
export default function LiveRegister({ session = DEMO }) {
  const [filter, setFilter] = useState("onsite");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState(session.people);
  const [team, setTeam] = useState(session.team);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const [burst, setBurst] = useState(false);

  const after = useTimers();
  const pageVisible = usePageVisible();
  const celebrated = useRef(false);

  const counts = useMemo(() => {
    const c = { onsite: 0, expected: 0, absent: 0, out: 0 };
    for (const p of people) c[p.status] += 1;
    return c;
  }, [people]);

  const marked = counts.onsite + counts.absent + counts.out;

  useEffect(() => {
    if (counts.expected > 0) { celebrated.current = false; return; }
    if (!people.length || celebrated.current) return;
    celebrated.current = true;
    setBurst(true);
    after(() => setBurst(false), 1400);
  }, [counts.expected, people.length, after]);

  const timing = useMemo(() => {
    const span = mins(session.end) - mins(session.start);
    const elapsed = mins(session.now) - mins(session.start);
    const left = Math.max(0, span - elapsed);
    return {
      pct: Math.max(0, Math.min(100, (elapsed / span) * 100)),
      label: left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m to go` : `${left}m to go`,
    };
  }, [session.start, session.end, session.now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => p.status === filter && (!q || p.name.toLowerCase().includes(q)));
  }, [people, filter, query]);

  const say = useCallback((name, status) => {
    setToast({ msg: `${name.split(" ")[0]} · ${STATUS[status].label.toLowerCase()}`, c: STATUS[status].c, emoji: STATUS[status].emoji });
    after(() => setToast(null), 1900);
  }, [after]);

  const setStatus = useCallback((person, status) => {
    setLeaving(person.id);
    say(person.name, status);
    after(() => {
      setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, status, in: status === "onsite" ? session.now : p.in } : p)));
      setLeaving(null);
    }, 200);
  }, [after, say, session.now]);

  const toggleTeam = useCallback((m) => {
    const next = m.status === "onsite" ? "out" : "onsite";
    setTeam((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: next } : x)));
    say(m.name, next);
  }, [say]);

  const closeSheet = useCallback(() => setSheet(false), []);

  return (
    <div style={ST.shell} className={pageVisible ? undefined : "ls-still"}>
      <style>{CSS}</style>

      {/* ------------------------------------------------------- header */}
      <header style={ST.header}>
        <div style={ST.headerTop}>
          <button style={ST.back} className="ls-tap" aria-label="Back to registers"><Chevron /></button>
          <div style={ST.headerText}>
            <div style={ST.eyebrow}>{session.dayLabel} · {session.venue}</div>
            <h1 style={ST.title}>{session.title}</h1>
          </div>
          <span style={ST.livePill}>
            <span className="ls-pulse" style={ST.liveDot} />Live
          </span>
        </div>

        <div style={ST.timeline}>
          <div style={ST.timelineHead}>
            <span style={ST.timeMark}>{session.start}</span>
            <span style={ST.timeNow}>{timing.label}</span>
            <span style={ST.timeMark}>{session.end}</span>
          </div>
          <div style={ST.track}>
            <div style={{ ...ST.trackFill, transform: `scaleX(${timing.pct / 100})` }} />
            <div style={{ ...ST.trackHead, left: `calc(${timing.pct}% - 7px)` }}>
              <span style={ST.trackHeadInner} />
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------- attendance spine */}
      <section style={ST.spineWrap}>
        {burst && <Burst />}
        <div style={ST.spineTop}>
          <span style={ST.spineTitle}>Attendance</span>
          <span style={ST.spineCount}>
            <strong style={ST.spineStrong}><Tick value={marked} /></strong>
            <span style={ST.muted}> / {people.length} marked</span>
          </span>
        </div>

        <div style={ST.spine}>
          {ORDER.map((k) =>
            counts[k] > 0 ? (
              <button key={k} onClick={() => setFilter(k)} aria-label={`${counts[k]} ${STATUS[k].label}`}
                style={{
                  ...ST.spineSeg, flexGrow: counts[k], background: STATUS[k].grad,
                  opacity: filter === k ? 1 : 0.34,
                  transform: filter === k ? "scaleY(1.3)" : "scaleY(1)",
                }} />
            ) : null
          )}
          {!people.length && <div style={{ ...ST.spineSeg, flexGrow: 1, background: T.line }} />}
        </div>

        <div style={ST.chipRow} className="ls-scroll">
          {ORDER.map((k) => {
            const on = filter === k, s = STATUS[k];
            return (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={on} className="ls-tap"
                style={{
                  ...ST.chip,
                  background: on ? s.grad : s.bg,
                  color: on ? "#fff" : s.c,
                  boxShadow: on ? `0 5px 14px ${s.c}40` : "none",
                }}>
                <span style={ST.chipNum}><Tick value={counts[k]} /></span>{s.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- toolbar */}
      <div style={ST.toolbar}>
        <div style={ST.searchWrap}>
          <SearchIcon />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this session"
            style={ST.search} enterKeyHint="search" autoCorrect="off" autoCapitalize="words"
            aria-label="Search young people in this session" />
          {query && <button style={ST.clear} onClick={() => setQuery("")} aria-label="Clear search">×</button>}
        </div>
        <button style={ST.addBtn} className="ls-tap" aria-label="Add a walk-in"><PlusIcon /></button>
        <button style={ST.iconBtn} className="ls-tap" onClick={() => setSheet(true)} aria-label="More actions"><DotsIcon /></button>
      </div>

      {/* ----------------------------------------------------------- list */}
      <main style={ST.list}>
        {visible.length === 0 ? (
          <Empty filter={filter} query={query} />
        ) : (
          <div key={filter} className="ls-stagger">
            {visible.map((p) => (
              <PersonRow key={p.id} person={p} filter={filter} leaving={leaving === p.id} onStatus={setStatus} />
            ))}
          </div>
        )}

        <div style={ST.teamCard}>
          <div style={ST.teamHead}>
            <span style={ST.teamTitle}>Session team</span>
            <span style={ST.teamMeta}>{team.filter((m) => m.status === "onsite").length} of {team.length} on site</span>
          </div>
          {team.map((m) => (
            <div key={m.id} style={ST.teamRow}>
              <span style={{ ...ST.avatar, background: "linear-gradient(135deg,#A78BFA,#6D28D9)" }}>{initials(m.name)}</span>
              <div style={ST.grow}>
                <div style={ST.personName}>{m.name}</div>
                <div style={ST.personSub}>{m.role}</div>
              </div>
              <button onClick={() => toggleTeam(m)} className="ls-tap"
                style={m.status === "onsite" ? ST.btnGhost : { ...ST.btnSolid, background: STATUS.onsite.grad }}>
                {m.status === "onsite" ? "Sign out" : "Sign in"}
              </button>
            </div>
          ))}
        </div>
        <div style={ST.tail} />
      </main>

      {toast && (
        <div className="ls-toast" style={{ ...ST.toast, borderColor: `${toast.c}55` }} role="status" aria-live="polite">
          <span style={ST.toastEmoji}>{toast.emoji}</span>
          <span style={ST.toastMsg}>{toast.msg}</span>
        </div>
      )}

      {sheet && (
        <div style={ST.scrim} className="ls-fade" onClick={closeSheet}>
          <div style={ST.sheet} className="ls-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More actions">
            <div style={ST.grabber} />
            {SHEET_ACTIONS.map(([e, label, sub, c]) => (
              <button key={label} className="ls-tap" style={ST.sheetRow} onClick={closeSheet}>
                <span style={{ ...ST.sheetIcon, background: `${c}18` }}>{e}</span>
                <span style={ST.grow}>
                  <span style={ST.sheetLabel}>{label}</span>
                  <span style={ST.sheetSub}>{sub}</span>
                </span>
                <Chevron dir="right" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sub-views */
const PersonRow = memo(function PersonRow({ person, filter, leaving, onStatus }) {
  const grad = BUBBLES[person.bubble] || BUBBLES.Blue;
  const action = filter === "onsite"
    ? { label: "Sign out", to: "out", ghost: true }
    : filter === "out"
    ? { label: "Sign back in", to: "onsite", ghost: true }
    : { label: "Sign in", to: "onsite", ghost: false };
  const s = STATUS[action.to];

  return (
    <div className={leaving ? "ls-item ls-leave" : "ls-item"}
      style={{ ...ST.row, borderLeftColor: STATUS[person.status].c }}>
      <span style={{ ...ST.avatar, background: grad }}>{initials(person.name)}</span>
      <div style={ST.grow}>
        <div style={ST.personName}>
          {person.name}
          {person.flag === "medical" && <span style={ST.flagMed} title="Medical note on file">M</span>}
          {person.flag === "walkin" && <span style={ST.flagWalk}>Walk-in</span>}
        </div>
        <div style={ST.personSub}>
          <span style={{ ...ST.bubbleDot, background: grad }} />
          {person.bubble} · Age {person.age}{person.in && filter === "onsite" ? ` · in ${person.in}` : ""}
        </div>
      </div>
      <button className="ls-tap" onClick={() => onStatus(person, action.to)}
        style={action.ghost ? ST.btnGhost : { ...ST.btnSolid, background: s.grad }}>
        {action.label}
      </button>
    </div>
  );
});

function Empty({ filter, query }) {
  const copy = query
    ? { e: "🔍", h: "No match", p: `Nobody in this list is called “${query}”.` }
    : EMPTY_COPY[filter];
  return (
    <div style={ST.empty} className="ls-item">
      <div style={ST.emptyEmoji}>{copy.e}</div>
      <div style={ST.emptyH}>{copy.h}</div>
      <div style={ST.emptyP}>{copy.p}</div>
    </div>
  );
}

const BURST_COLOURS = ["#00C48C", "#FFB627", "#FF6B9D", "#7BA0FF", "#A78BFA"];
function Burst() {
  return (
    <div style={ST.burst} aria-hidden="true">
      {BURST_COLOURS.map((c, i) => (
        <span key={i} className="ls-bit" style={{
          left: `${14 + i * 18}%`, background: c,
          animationDelay: `${i * 70}ms`,
          borderRadius: i % 2 ? "999px" : "2px",
        }} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- icons */
const Chevron = ({ dir = "left" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
    style={{ transform: dir === "right" ? "rotate(180deg)" : undefined, color: "currentColor" }}>
    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="7" stroke={T.ink3} strokeWidth="2" />
    <path d="M20 20l-3.5-3.5" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
const DotsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
);

/* ---------------------------------------------------------------- styles */
const ST = {
  shell: { fontFamily: T.font, background: T.bg, minHeight: "100%", color: T.ink, WebkitFontSmoothing: "antialiased", overflowX: "hidden" },
  grow: { flex: 1, minWidth: 0 },
  muted: { color: T.ink3 },
  tick: { display: "inline-block", fontVariantNumeric: "tabular-nums" },
  tail: { height: 96 },

  header: { background: "linear-gradient(150deg,#2A1155 0%,#4B1D8F 46%,#7C3AED 78%,#9F5BF0 100%)", color: "#fff", padding: "14px 16px 22px", borderRadius: "0 0 26px 26px" },
  headerTop: { display: "flex", alignItems: "flex-start", gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  back: { width: 34, height: 34, flexShrink: 0, borderRadius: 12, border: "none", cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", display: "grid", placeItems: "center", marginTop: 2 },
  eyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" },
  title: { margin: "3px 0 0", fontSize: 22, fontWeight: 750, letterSpacing: "-.025em", lineHeight: 1.14 },
  livePill: { display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 2, padding: "6px 11px", borderRadius: 999, background: "rgba(0,196,140,.22)", color: "#7DF5C8", fontSize: 12, fontWeight: 750, letterSpacing: ".05em", textTransform: "uppercase" },
  liveDot: { width: 7, height: 7, borderRadius: 999, background: "#00E5A0", display: "block" },

  timeline: { marginTop: 20 },
  timelineHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  timeMark: { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.6)", fontVariantNumeric: "tabular-nums" },
  timeNow: { fontSize: 12.5, fontWeight: 750, fontVariantNumeric: "tabular-nums" },
  track: { position: "relative", height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "visible" },
  trackFill: { position: "absolute", inset: 0, borderRadius: 999, background: "linear-gradient(90deg,#00E5A0,#7BA0FF)", transformOrigin: "left center", transition: "transform .6s cubic-bezier(.2,.9,.25,1)" },
  trackHead: { position: "absolute", top: -4, width: 14, height: 14, display: "grid", placeItems: "center", transition: "left .6s cubic-bezier(.2,.9,.25,1)" },
  trackHeadInner: { width: 11, height: 11, borderRadius: 999, background: "#fff", boxShadow: "0 0 0 3px rgba(255,255,255,.28)" },

  spineWrap: { position: "relative", margin: "-14px 12px 0", background: T.card, borderRadius: T.radius, padding: "14px 14px 13px", boxShadow: "0 8px 24px rgba(60,20,140,.1)", overflow: "hidden" },
  spineTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 11 },
  spineTitle: { fontSize: 12.5, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: T.ink3 },
  spineCount: { fontSize: 13.5, fontWeight: 600 },
  spineStrong: { color: T.ink },
  spine: { display: "flex", gap: 4, height: 10, marginBottom: 13, alignItems: "center" },
  spineSeg: { height: "100%", border: "none", padding: 0, borderRadius: 999, cursor: "pointer", willChange: "flex-grow, transform", transition: "flex-grow .4s cubic-bezier(.2,.9,.25,1), opacity .25s linear, transform .25s cubic-bezier(.2,.9,.25,1)" },
  chipRow: { display: "flex", gap: 7, overflowX: "auto", padding: "3px 0 4px" },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, cursor: "pointer", padding: "8px 13px", borderRadius: 999, border: "none", fontSize: 13.5, fontWeight: 650, fontFamily: "inherit", transition: "background .2s linear, color .2s linear, box-shadow .2s linear" },
  chipNum: { fontWeight: 850, fontSize: 14.5 },

  toolbar: { display: "flex", gap: 8, padding: "14px 12px 10px", position: "sticky", top: 0, zIndex: 5, background: T.bg },
  searchWrap: { flex: 1, display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.line}`, borderRadius: 15, padding: "0 8px 0 12px", height: 46 },
  search: { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", color: T.ink, minWidth: 0 },
  clear: { width: 26, height: 26, flexShrink: 0, borderRadius: 999, border: "none", background: T.line, color: T.ink2, fontSize: 16, lineHeight: 1, cursor: "pointer" },
  iconBtn: { width: 46, height: 46, flexShrink: 0, borderRadius: 15, border: `1px solid ${T.line}`, background: T.card, color: T.ink2, display: "grid", placeItems: "center", cursor: "pointer" },
  addBtn: { width: 46, height: 46, flexShrink: 0, borderRadius: 15, border: "none", background: STATUS.onsite.grad, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 5px 14px #00A37A3D" },

  list: { padding: "0 12px" },
  row: { display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: T.radius, padding: "12px 12px 12px 13px", marginBottom: 9, boxShadow: "0 2px 10px rgba(60,20,140,.06)", borderLeft: "3px solid", contentVisibility: "auto", containIntrinsicSize: "auto 68px" },
  avatar: { width: 42, height: 42, flexShrink: 0, borderRadius: 15, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 750, color: "#fff", letterSpacing: "-.01em" },
  personName: { display: "flex", alignItems: "center", gap: 6, fontSize: 15.5, fontWeight: 650, letterSpacing: "-.012em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  personSub: { display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 13, color: T.ink3, fontVariantNumeric: "tabular-nums" },
  bubbleDot: { width: 7, height: 7, borderRadius: 999, display: "inline-block", flexShrink: 0 },
  flagMed: { width: 18, height: 18, borderRadius: 7, background: STATUS.absent.bg, color: STATUS.absent.c, fontSize: 10.5, fontWeight: 850, display: "grid", placeItems: "center", flexShrink: 0 },
  flagWalk: { padding: "2px 7px", borderRadius: 7, background: STATUS.expected.bg, color: STATUS.expected.c, fontSize: 10.5, fontWeight: 750, letterSpacing: ".04em", textTransform: "uppercase", flexShrink: 0 },

  btnSolid: { flexShrink: 0, padding: "10px 16px", borderRadius: 13, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  btnGhost: { flexShrink: 0, padding: "10px 16px", borderRadius: 13, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14, fontWeight: 650, fontFamily: "inherit", cursor: "pointer" },

  empty: { textAlign: "center", padding: "40px 28px 36px" },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyH: { fontSize: 16.5, fontWeight: 750, letterSpacing: "-.015em" },
  emptyP: { fontSize: 14, color: T.ink3, marginTop: 5, lineHeight: 1.45 },

  teamCard: { background: T.card, borderRadius: T.radius, padding: "13px 12px 8px 14px", marginTop: 14, boxShadow: "0 2px 10px rgba(60,20,140,.06)" },
  teamHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  teamTitle: { fontSize: 12.5, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: T.ink3 },
  teamMeta: { fontSize: 13, color: T.ink3, fontVariantNumeric: "tabular-nums" },
  teamRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0" },

  toast: { position: "fixed", left: "50%", bottom: 26, zIndex: 60, display: "flex", alignItems: "center", gap: 9, padding: "11px 17px", borderRadius: 999, background: "#fff", border: "1.5px solid", boxShadow: "0 10px 28px rgba(60,20,140,.2)", fontSize: 14.5, whiteSpace: "nowrap", pointerEvents: "none" },
  toastEmoji: { fontSize: 17 },
  toastMsg: { fontWeight: 650, color: T.ink },

  burst: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" },

  scrim: { position: "fixed", inset: 0, background: "rgba(23,15,46,.5)", display: "flex", alignItems: "flex-end", zIndex: 40 },
  sheet: { width: "100%", background: T.card, borderRadius: "24px 24px 0 0", padding: "10px 8px calc(16px + env(safe-area-inset-bottom))" },
  grabber: { width: 38, height: 4, borderRadius: 999, background: T.line, margin: "0 auto 10px" },
  sheetRow: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: 16, color: T.ink3 },
  sheetIcon: { width: 40, height: 40, flexShrink: 0, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 18 },
  sheetLabel: { display: "block", fontSize: 15.5, fontWeight: 700, color: T.ink, letterSpacing: "-.012em" },
  sheetSub: { display: "block", fontSize: 13, color: T.ink3, marginTop: 2 },
};

const CSS = `
  .ls-pulse { animation: lsPulse 2s ease-in-out infinite; }
  @keyframes lsPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,229,160,.6); } 60% { box-shadow: 0 0 0 7px rgba(0,229,160,0); } }

  .ls-item { animation: lsIn .34s cubic-bezier(.2,.9,.25,1) both; }
  @keyframes lsIn { from { opacity: 0; transform: translate3d(0,8px,0); } to { opacity: 1; transform: none; } }

  .ls-stagger > .ls-item:nth-child(1) { animation-delay: 0ms }
  .ls-stagger > .ls-item:nth-child(2) { animation-delay: 30ms }
  .ls-stagger > .ls-item:nth-child(3) { animation-delay: 60ms }
  .ls-stagger > .ls-item:nth-child(4) { animation-delay: 90ms }
  .ls-stagger > .ls-item:nth-child(5) { animation-delay: 120ms }
  .ls-stagger > .ls-item:nth-child(n+6) { animation-delay: 150ms }

  .ls-leave { animation: lsOut .2s ease-in forwards; }
  @keyframes lsOut { to { opacity: 0; transform: translate3d(44px,0,0) scale(.95); } }

  .ls-bump { animation: lsBump .4s cubic-bezier(.2,1.6,.4,1); }
  @keyframes lsBump { 0% { transform: scale(1) } 35% { transform: scale(1.28) } 100% { transform: scale(1) } }

  .ls-toast { animation: lsToast .3s cubic-bezier(.2,1.4,.4,1) both; transform: translate3d(-50%,0,0); }
  @keyframes lsToast { from { opacity: 0; transform: translate3d(-50%,12px,0) scale(.94); } to { opacity: 1; transform: translate3d(-50%,0,0) scale(1); } }

  .ls-bit { position: absolute; top: 8px; width: 7px; height: 9px; opacity: 0; animation: lsBit 1.3s cubic-bezier(.25,.9,.3,1) forwards; }
  @keyframes lsBit { 0% { opacity: 0; transform: translate3d(0,0,0) scale(.4) } 15% { opacity: 1 } 100% { opacity: 0; transform: translate3d(0,90px,0) scale(1) rotate(320deg) } }

  .ls-sheet { animation: lsUp .26s cubic-bezier(.2,.95,.25,1) both; }
  @keyframes lsUp { from { transform: translate3d(0,24px,0) } to { transform: none } }
  .ls-fade { animation: lsFade .18s linear both; }
  @keyframes lsFade { from { opacity: 0 } to { opacity: 1 } }

  .ls-tap { transition: transform .1s ease-out; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .ls-tap:active { transform: scale(.95); }

  .ls-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
  .ls-scroll::-webkit-scrollbar { display: none; }

  button:focus-visible { outline: 2px solid ${T.violetLite}; outline-offset: 2px; }

  .ls-still * { animation-play-state: paused !important; }
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  }
`;
