import React, { useState, useMemo, useRef, useCallback, useEffect, memo } from "react";

/**
 * NotificationCentre — mobile-first bottom sheet.
 *
 * Replaces the desktop dropdown panel, which overflows the viewport on phones.
 * Key behaviours: drag-to-dismiss, swipe-to-clear rows, repeat notifications
 * collapsed into one expandable card, and an inline action on every row.
 */

/* ------------------------------------------------------------------ tokens */
const T = {
  card: "#FFFFFF", sheetBg: "#F7F5FF",
  ink: "#170F2E", ink2: "#584C7A", ink3: "#9990B5", line: "#EDE8FB",
  violet: "#6D28D9", violetLite: "#8B5CF6",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
};

/** One entry per notification type: icon, colour, and what the action does. */
const KIND = {
  session_soon:   { icon: "⏰", c: "#6D28D9", bg: "#F1E9FE", action: "Open session" },
  register_open:  { icon: "📋", c: "#E08700", bg: "#FFF4E0", action: "Finish register" },
  reflection:     { icon: "✍️", c: "#4F7BEF", bg: "#E8EFFF", action: "Write it up" },
  risk:           { icon: "🛡️", c: "#00A37A", bg: "#E3F9F1", action: "Review" },
  registration:   { icon: "🙋", c: "#E5326B", bg: "#FFE9F0", action: "Approve" },
  consent:        { icon: "📄", c: "#E08700", bg: "#FFF4E0", action: "Chase consent" },
  cover:          { icon: "🧑‍🤝‍🧑", c: "#4F7BEF", bg: "#E8EFFF", action: "Find cover" },
  security:       { icon: "🔒", c: "#E5326B", bg: "#FFE9F0", action: "View alert" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "action", label: "Needs action" },
  { key: "safeguarding", label: "Safeguarding" },
];

/* -------------------------------------------------------------- demo data */
const NOW = Date.now();
const h = (n) => NOW - n * 3600e3;
const DEMO = [
  { id: "n1", kind: "session_soon", title: "Session starting soon", body: "Summer Project 2026 — Day 4 starts in 30 minutes.", at: h(2), read: false, needsAction: true, safeguarding: false },
  { id: "n2", kind: "risk", title: "Risk assessment due", body: "Knitting is due for review on 20 August.", at: h(10), read: false, needsAction: true, safeguarding: true },
  { id: "n3", kind: "register_open", title: "Register left open", body: "Evening Football Session closed with 40 children unmarked.", at: h(50), read: false, needsAction: true, safeguarding: true },
  { id: "n4", kind: "reflection", title: "Reflection due", body: "Horse Riding is ready for its reflection to be written up.", at: h(51), read: false, needsAction: true, safeguarding: false },
  { id: "n5", kind: "reflection", title: "Reflection due", body: "Horse Riding is ready for its reflection to be written up.", at: h(51.5), read: false, needsAction: true, safeguarding: false },
  { id: "n6", kind: "register_open", title: "Register left open", body: "Summer Project 2026 — Day 3 closed with 5 children unmarked.", at: h(74), read: false, needsAction: true, safeguarding: true },
  { id: "n7", kind: "register_open", title: "Register left open", body: "Thorpe Park closed with 5 children unmarked.", at: h(75), read: true, needsAction: true, safeguarding: true },
  { id: "n8", kind: "registration", title: "New child registration", body: "Priya Shah has been registered by a parent and needs approving.", at: h(76), read: true, needsAction: true, safeguarding: true },
  { id: "n9", kind: "consent", title: "Consent expiring", body: "Photo consent for 3 children expires this month.", at: h(96), read: true, needsAction: false, safeguarding: true },
];

/* ------------------------------------------------------------- utilities */
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}
function dayBucket(ts) {
  const d = new Date(ts), n = new Date();
  const days = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400e3);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

/* ============================================================= component */
export default function NotificationCentre({ items = DEMO, onClose = () => {} }) {
  const [list, setList] = useState(items);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef(null);
  const scrollRef = useRef(null);

  const unread = useMemo(() => list.filter((n) => !n.read).length, [list]);

  const filtered = useMemo(() => {
    if (filter === "unread") return list.filter((n) => !n.read);
    if (filter === "action") return list.filter((n) => n.needsAction);
    if (filter === "safeguarding") return list.filter((n) => n.safeguarding);
    return list;
  }, [list, filter]);

  /* Collapse identical repeats into one stacked card, then group by day. */
  const groups = useMemo(() => {
    const stacks = [];
    const byKey = new Map();
    for (const n of [...filtered].sort((a, b) => b.at - a.at)) {
      const key = `${n.kind}|${n.title}|${n.body}`;
      const hit = byKey.get(key);
      if (hit && dayBucket(hit.at) === dayBucket(n.at)) { hit.items.push(n); continue; }
      const stack = { key: n.id, ...n, items: [n] };
      byKey.set(key, stack);
      stacks.push(stack);
    }
    const out = [];
    for (const s of stacks) {
      const label = dayBucket(s.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(s);
      else out.push({ label, rows: [s] });
    }
    return out;
  }, [filtered]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  const markAllRead = useCallback(() => setList((p) => p.map((n) => ({ ...n, read: true }))), []);
  const dismiss = useCallback((ids) => setList((p) => p.filter((n) => !ids.includes(n.id))), []);
  const markRead = useCallback((ids) => setList((p) => p.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))), []);

  /* Drag the sheet down to dismiss — only when the list is scrolled to top. */
  const onDragStart = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
    startY.current = e.touches ? e.touches[0].clientY : e.clientY;
  };
  const onDragMove = (e) => {
    if (startY.current == null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setDrag(Math.max(0, y - startY.current));
  };
  const onDragEnd = () => {
    if (drag > 110) close();
    else setDrag(0);
    startY.current = null;
  };

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [close]);

  return (
    <div style={S.scrim} className={closing ? "ls-fadeOut" : "ls-fade"} onClick={close}>
      <section
        role="dialog" aria-label="Notifications"
        className={closing ? "ls-sheetOut" : "ls-sheetIn"}
        style={{ ...S.sheet, transform: drag ? `translate3d(0,${drag}px,0)` : undefined, transition: drag ? "none" : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* --------------------------------------------------- grab area */}
        <div style={S.grabArea}
          onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
          onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd}>
          <div style={S.grabber} />
        </div>

        {/* ------------------------------------------------------ header */}
        <header style={S.header}>
          <div style={S.headRow}>
            <h2 style={S.title}>Notifications</h2>
            {unread > 0 && <span style={S.badge}>{unread} new</span>}
            <span style={{ flex: 1 }} />
            <button style={S.close} className="ls-tap" onClick={close} aria-label="Close notifications">×</button>
          </div>

          <div style={S.chipRow} className="ls-scroll">
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button key={f.key} className="ls-tap" onClick={() => setFilter(f.key)} aria-pressed={on}
                  style={{ ...S.chip, background: on ? T.violet : "#fff", color: on ? "#fff" : T.ink2, borderColor: on ? T.violet : T.line }}>
                  {f.label}
                  {f.key === "unread" && unread > 0 && <span style={{ ...S.chipCount, background: on ? "rgba(255,255,255,.25)" : T.line, color: on ? "#fff" : T.ink2 }}>{unread}</span>}
                </button>
              );
            })}
            {unread > 0 && (
              <button className="ls-tap" onClick={markAllRead} style={{ ...S.chip, ...S.chipGhost }}>Mark all read</button>
            )}
          </div>
        </header>

        {/* -------------------------------------------------------- list */}
        <div style={S.scroll} ref={scrollRef} className="ls-scroll">
          {groups.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}>🌤️</div>
              <div style={S.emptyH}>You're all caught up</div>
              <div style={S.emptyP}>Nothing here right now. New alerts land at the top.</div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <div style={S.dayHead}>{g.label}</div>
                {g.rows.map((row) => (
                  <Row key={row.key} row={row}
                    expanded={expanded === row.key}
                    onExpand={() => setExpanded(expanded === row.key ? null : row.key)}
                    onDismiss={dismiss} onRead={markRead} />
                ))}
              </div>
            ))
          )}
          <div style={S.tail} />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- row */
const Row = memo(function Row({ row, expanded, onExpand, onDismiss, onRead }) {
  const k = KIND[row.kind] || KIND.session_soon;
  const count = row.items.length;
  const ids = row.items.map((i) => i.id);
  const [x, setX] = useState(0);
  const [gone, setGone] = useState(false);
  const startX = useRef(null);
  const locked = useRef(false);

  const begin = (e) => { startX.current = e.touches[0].clientX; locked.current = false; };
  const move = (e) => {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (!locked.current && Math.abs(dx) > 8) locked.current = true;
    if (locked.current && dx < 0) setX(Math.max(dx, -140));
  };
  const end = () => {
    if (x < -92) { setGone(true); setTimeout(() => onDismiss(ids), 180); }
    else setX(0);
    startX.current = null;
  };

  return (
    <div style={S.rowWrap} className={gone ? "ls-rowGone" : undefined}>
      <div style={S.swipeHint}><span style={S.swipeText}>Clear</span></div>
      <div
        style={{ ...S.row, transform: x ? `translate3d(${x}px,0,0)` : undefined, transition: startX.current ? "none" : "transform .22s cubic-bezier(.2,.9,.25,1)" }}
        onTouchStart={begin} onTouchMove={move} onTouchEnd={end}
      >
        {!row.read && <span style={{ ...S.unreadBar, background: k.c }} />}
        <span style={{ ...S.icon, background: k.bg }}>
          {k.icon}
          {count > 1 && <span style={{ ...S.stack, background: k.c }}>{count}</span>}
        </span>

        <div style={S.body}>
          <div style={S.rowTop}>
            <span style={{ ...S.rowTitle, fontWeight: row.read ? 600 : 750 }}>{row.title}</span>
            <span style={S.time}>{ago(row.at)}</span>
          </div>
          <p style={S.rowBody}>{row.body}</p>

          {count > 1 && (
            <button className="ls-tap" style={S.moreBtn} onClick={onExpand}>
              {expanded ? "Hide" : `Show all ${count}`}
            </button>
          )}
          {expanded && count > 1 && (
            <div style={S.subList}>
              {row.items.map((i) => (
                <div key={i.id} style={S.subRow}>
                  <span style={{ ...S.subDot, background: k.c }} />
                  <span style={S.subText}>{i.body}</span>
                  <span style={S.subTime}>{ago(i.at)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={S.actions}>
            <button className="ls-tap" style={{ ...S.primary, background: k.c }}
              onClick={() => onRead(ids)}>{k.action}</button>
            {!row.read && (
              <button className="ls-tap" style={S.secondary} onClick={() => onRead(ids)}>Mark read</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------- styles */
const S = {
  scrim: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(23,15,46,.5)", display: "flex", alignItems: "flex-end", fontFamily: T.font },
  sheet: { width: "100%", maxHeight: "92dvh", display: "flex", flexDirection: "column", background: T.sheetBg, borderRadius: "26px 26px 0 0", boxShadow: "0 -12px 40px rgba(23,15,46,.28)", overflow: "hidden", willChange: "transform" },

  grabArea: { padding: "9px 0 3px", flexShrink: 0, cursor: "grab", touchAction: "none" },
  grabber: { width: 40, height: 4.5, borderRadius: 999, background: T.line, margin: "0 auto" },

  header: { flexShrink: 0, padding: "6px 14px 10px", background: T.sheetBg },
  headRow: { display: "flex", alignItems: "center", gap: 9 },
  title: { margin: 0, fontSize: 21, fontWeight: 780, letterSpacing: "-.025em", color: T.ink },
  badge: { padding: "4px 9px", borderRadius: 999, background: "#F1E9FE", color: T.violet, fontSize: 12, fontWeight: 750, whiteSpace: "nowrap" },
  close: { width: 34, height: 34, flexShrink: 0, borderRadius: 12, border: "none", background: "#fff", color: T.ink2, fontSize: 20, lineHeight: 1, cursor: "pointer", boxShadow: "0 1px 4px rgba(60,20,140,.08)" },

  chipRow: { display: "flex", gap: 7, overflowX: "auto", marginTop: 12, paddingBottom: 2 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "1px solid", fontSize: 13.5, fontWeight: 650, fontFamily: "inherit", cursor: "pointer", transition: "background .18s linear, color .18s linear" },
  chipGhost: { background: "transparent", borderColor: "transparent", color: T.violet, marginLeft: "auto" },
  chipCount: { padding: "1px 6px", borderRadius: 999, fontSize: 11.5, fontWeight: 800 },

  scroll: { flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "0 12px" },
  dayHead: { position: "sticky", top: 0, zIndex: 2, padding: "12px 2px 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.ink3, background: `linear-gradient(${T.sheetBg} 76%, transparent)` },

  rowWrap: { position: "relative", marginBottom: 9, borderRadius: 18, overflow: "hidden" },
  swipeHint: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 22, background: "linear-gradient(90deg,#FFE9F0,#FF6B9D)", borderRadius: 18 },
  swipeText: { color: "#fff", fontSize: 13.5, fontWeight: 750 },

  row: { position: "relative", display: "flex", gap: 12, padding: "13px 13px 12px 15px", background: T.card, borderRadius: 18, boxShadow: "0 2px 10px rgba(60,20,140,.06)", willChange: "transform", contentVisibility: "auto", containIntrinsicSize: "auto 132px" },
  unreadBar: { position: "absolute", left: 0, top: 12, bottom: 12, width: 3.5, borderRadius: "0 999px 999px 0" },

  icon: { position: "relative", width: 40, height: 40, flexShrink: 0, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 18 },
  stack: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", border: "2px solid #fff" },

  body: { flex: 1, minWidth: 0 },
  rowTop: { display: "flex", alignItems: "baseline", gap: 8 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 15.5, letterSpacing: "-.012em", color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  time: { flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: T.ink3, fontVariantNumeric: "tabular-nums" },
  rowBody: { margin: "3px 0 0", fontSize: 14, lineHeight: 1.42, color: T.ink2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },

  moreBtn: { marginTop: 8, padding: "5px 10px", borderRadius: 9, border: "none", background: "#F4F1FE", color: T.violet, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  subList: { marginTop: 8, paddingLeft: 2, borderLeft: `2px solid ${T.line}` },
  subRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px 10px" },
  subDot: { width: 5, height: 5, borderRadius: 999, flexShrink: 0 },
  subText: { flex: 1, minWidth: 0, fontSize: 13, color: T.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subTime: { fontSize: 12, color: T.ink3, flexShrink: 0 },

  actions: { display: "flex", gap: 8, marginTop: 11 },
  primary: { padding: "8px 14px", borderRadius: 11, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  secondary: { padding: "8px 14px", borderRadius: 11, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13.5, fontWeight: 650, fontFamily: "inherit", cursor: "pointer" },

  empty: { textAlign: "center", padding: "60px 30px" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyH: { fontSize: 16.5, fontWeight: 750, color: T.ink },
  emptyP: { fontSize: 14, color: T.ink3, marginTop: 5, lineHeight: 1.45 },

  tail: { height: "calc(28px + env(safe-area-inset-bottom))" },
};

const CSS = `
  .ls-fade { animation: nFade .2s linear both }
  .ls-fadeOut { animation: nFade .2s linear reverse both }
  @keyframes nFade { from { opacity: 0 } to { opacity: 1 } }

  .ls-sheetIn { animation: nUp .3s cubic-bezier(.2,.95,.25,1) both }
  @keyframes nUp { from { transform: translate3d(0,100%,0) } to { transform: none } }
  .ls-sheetOut { animation: nDown .22s ease-in both }
  @keyframes nDown { to { transform: translate3d(0,100%,0) } }

  .ls-rowGone { animation: nGone .18s ease-in forwards }
  @keyframes nGone { to { opacity: 0; transform: translate3d(-40px,0,0); max-height: 0; margin-bottom: 0 } }

  .ls-tap { transition: transform .1s ease-out; -webkit-tap-highlight-color: transparent; touch-action: manipulation }
  .ls-tap:active { transform: scale(.95) }

  .ls-scroll { scrollbar-width: none }
  .ls-scroll::-webkit-scrollbar { display: none }

  button:focus-visible { outline: 2px solid ${T.violetLite}; outline-offset: 2px }

  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: .01ms !important; transition-duration: .01ms !important }
  }
`;

/* inject once */
if (typeof document !== "undefined" && !document.getElementById("ls-notif-css")) {
  const el = document.createElement("style");
  el.id = "ls-notif-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
