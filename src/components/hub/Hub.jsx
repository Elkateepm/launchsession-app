import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Hub({ org, session, setTab, onNavigate }) {
  const orgId = org?.id;
  const primary = org?.primary_color || "#1B9AAA";
  const orgName = org?.name || "LaunchSession";

  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [children, setChildren] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const today = new Date().toISOString().split("T")[0];

  function go(tab) {
    if (typeof onNavigate === "function") onNavigate(tab);
    else if (typeof setTab === "function") setTab(tab);
  }

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    async function loadHub() {
      setLoading(true);

      const [
        { data: sessionData },
        { data: attendanceData },
        { data: concernData },
        { data: childData },
        { data: reflectionData },
      ] = await Promise.all([
        supabase.from("sessions").select("*").eq("org_id", orgId).order("session_date", { ascending: true }).order("start_time", { ascending: true }),
        supabase.from("attendance").select("*").eq("org_id", orgId),
        supabase.from("safeguarding_concerns").select("*").eq("org_id", orgId).eq("status", "open"),
        supabase.from("children").select("*").eq("org_id", orgId).eq("active", true).order("first_name", { ascending: true }),
        supabase.from("session_reflections").select("*").eq("org_id", orgId),
      ]);

      if (!alive) return;

      setSessions(sessionData || []);
      setAttendance(attendanceData || []);
      setConcerns(concernData || []);
      setChildren(childData || []);
      setReflections(reflectionData || []);
      setLoading(false);
    }

    loadHub();
    const interval = setInterval(loadHub, 30000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [orgId]);

  const todaySessions = useMemo(() => sessions.filter(s => s.session_date === today), [sessions, today]);
  const upcomingSessions = useMemo(() => sessions.filter(s => s.session_date >= today).slice(0, 4), [sessions, today]);

  const completedWithoutReflection = useMemo(() => {
    const now = new Date();
    return sessions
      .filter(s => {
        const endTime = s.end_time || "23:59";
        const end = new Date(`${s.session_date}T${endTime}`);
        const hasReflection = reflections.some(r => r.session_id === s.id);
        return end < now && !hasReflection;
      })
      .slice(0, 3);
  }, [sessions, reflections]);

  const signedIn = attendance.filter(a => a.status === "signed_in").length;
  const _signedOut = attendance.filter(a => a.status === "signed_out").length;
  const _medicalAlerts = children.filter(c => c.allergies || c.medical_notes).length;
  const attendanceRate = children.length > 0 ? Math.round((signedIn / children.length) * 100) : 0;

  const _nextSession = upcomingSessions[0];

  const liveHeroSession = todaySessions[0];
  const getLiveSessionStats = (item) => {
    const records = attendance.filter(a => a.session_id === item.id);
    const signedIn = records.filter(a => a.status === "signed_in").length;
    const absent = records.filter(a => a.status === "absent").length;
    const _signedOut = records.filter(a => a.status === "signed_out").length;
    const expected = Math.max(children.length, records.length);
    const percent = expected > 0 ? Math.round((signedIn / expected) * 100) : 0;

    return { signedIn, absent, signedOut, expected, percent };
  };
  const _liveHeroStats = liveHeroSession
    ? getLiveSessionStats(liveHeroSession)
    : { signedIn: 0, absent: 0, signedOut: 0, expected: 0, percent: 0 };

  const openRegisterForSession = (sessionId) => {
    try {
      window.localStorage.setItem("launchsession_selected_session_id", sessionId);
    } catch (e) {
      // ignore storage issues
    }
    go("registers");
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading mission control...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{orgName}</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: 14, margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => go('registers')} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            📋 Take Register
          </button>
          <button onClick={() => go('planner')} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            + Plan Session
          </button>
        </div>
      </div>

      {/* TODAY'S SESSIONS */}
      {todaySessions.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#16A34A', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', boxShadow: '0 0 8px #16A34A' }} />
            {todaySessions.length} LIVE SESSION{todaySessions.length > 1 ? 'S' : ''} TODAY
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: todaySessions.length > 1 ? '1fr 1fr' : '1fr', gap: 14 }}>
            {todaySessions.map(s => {
              const stats = getLiveSessionStats(s)
              return (
                <div key={s.id} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {s.session_type === 'trip' ? '🚌' : s.session_type === 'mentoring' ? '🤝' : s.session_type === 'workshop' ? '🛠️' : '🏃'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.start_time || ''}{s.end_time ? ` – ${s.end_time}` : ''}{s.location ? ` · ${s.location}` : ''}</div>
                      </div>
                    </div>
                    <span style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 800 }}>LIVE</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {[['Signed In', stats.signedIn, '#2DD4BF'], ['Expected', stats.expected, '#60A5FA'], ['Absent', stats.absent, '#FB923C'], ['Signed Out', stats.signedOut, '#C084FC']].map(([label, val, col]) => (
                      <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: col }}>{val}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                      <span>Register progress</span><span style={{ fontWeight: 700 }}>{stats.percent}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.percent}%`, background: primary, borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <button onClick={() => openRegisterForSession(s.id)} style={{ padding: '12px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                    Open Register →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 16, padding: '28px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>No sessions today</div>
            <div style={{ fontSize: 14, color: 'var(--text3)' }}>Plan your next session to get started.</div>
          </div>
          <button onClick={() => go('planner')} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            + Plan a Session
          </button>
        </div>
      )}

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20 }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* UPCOMING SESSIONS */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>📅 Upcoming Sessions</div>
              <button onClick={() => go('planner')} style={{ fontSize: 12, fontWeight: 700, color: primary, background: 'none', border: 'none', cursor: 'pointer' }}>+ New →</button>
            </div>
            {upcomingSessions.length === 0 ? (
              <div style={{ padding: '24px 20px', color: 'var(--text3)', fontSize: 14, textAlign: 'center' }}>No upcoming sessions. <span style={{ color: primary, cursor: 'pointer', fontWeight: 700 }} onClick={() => go('planner')}>Plan one now →</span></div>
            ) : (
              upcomingSessions.map(s => (
                <div key={s.id} onClick={() => go('registers')} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {s.session_type === 'trip' ? '🚌' : s.session_type === 'mentoring' ? '🤝' : '🏃'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatDate(s.session_date)} · {s.start_time || 'No time'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>→</span>
                </div>
              ))
            )}
          </div>

          {/* REFLECTIONS DUE */}
          {completedWithoutReflection.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>⭐ {completedWithoutReflection.length} Reflection{completedWithoutReflection.length > 1 ? 's' : ''} Due</div>
                <button onClick={() => go('planner')} style={{ fontSize: 12, fontWeight: 700, color: '#D97706', background: 'none', border: 'none', cursor: 'pointer' }}>Complete all →</button>
              </div>
              {completedWithoutReflection.slice(0, 3).map(s => (
                <div key={s.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
                  <span style={{ fontWeight: 700 }}>{s.title}</span> <span style={{ color: 'var(--text3)' }}>· {formatDate(s.session_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* QUICK ACTIONS */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '📋', label: 'Take Register', tab: 'registers', bg: '#10B981' },
                { icon: '📅', label: 'Plan a Session', tab: 'planner', bg: '#8B5CF6' },
                { icon: '🧒', label: 'Add Child', tab: 'registers', bg: '#F59E0B' },
                { icon: '🛡️', label: 'Safeguarding', tab: 'safeguarding', bg: '#2563EB' },
              ].map(a => (
                <button key={a.label} onClick={() => go(a.tab)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${a.bg}18`; e.currentTarget.style.borderColor = `${a.bg}40` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: `${a.bg}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* ATTENTION CENTRE */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>🔔 Attention Centre</div>
            {[
              { icon: '📝', label: 'Registers', value: signedIn > 0 ? `${signedIn} signed in` : 'All clear', tone: signedIn > 0 ? '#16A34A' : '#94A3B8', tab: 'registers' },
              { icon: '🛡️', label: 'Safeguarding', value: concerns.length > 0 ? `${concerns.length} open` : 'No concerns', tone: concerns.length > 0 ? '#F59E0B' : '#94A3B8', tab: 'safeguarding' },
              { icon: '👥', label: 'Young People', value: `${children.length} registered`, tone: primary, tab: 'registers' },
              { icon: '📊', label: 'Attendance', value: `${attendanceRate}%`, tone: '#2563EB', tab: 'registers' },
            ].map(row => (
              <div key={row.label} onClick={() => go(row.tab)} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{row.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: row.tone }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

  );
}

// eslint-disable-next-line no-unused-vars
function Panel({ title, children }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>{title}</h3>
      {children}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function StatCard({ icon, title, text, button, badge, onClick, colour }) {
  return (
    <button style={styles.statCard} onClick={onClick}>
      <div style={styles.bigIcon}>{icon}</div>
      <h3 style={{ ...styles.statTitle, color: colour }}>{title}</h3>
      <p style={styles.cardText}>{text}</p>
      {(button || badge) && <div style={{ ...styles.softBadge, color: colour }}>{button || badge}</div>}
    </button>
  );
}

// eslint-disable-next-line no-unused-vars
function ActionCard({ icon, title, text, onClick, colour }) {
  return (
    <button style={{ ...styles.actionCard, background: `${colour}15` }} onClick={onClick}>
      <div style={{ ...styles.actionIcon, background: colour }}>{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <span style={{ color: colour }}>→</span>
    </button>
  );
}

// eslint-disable-next-line no-unused-vars
function AttentionRow({ icon, label, value, tone, onClick }) {
  const colour = tone === "green" ? "#16A34A" : tone === "amber" ? "#F59E0B" : "#0EA5E9";
  return (
    <button style={styles.attentionRow} onClick={onClick}>
      <span style={styles.attentionIcon}>{icon}</span>
      <div style={{ flex: 1 }}>
        <strong>{label}</strong>
        <p>{value}</p>
      </div>
      <span style={{ ...styles.dot, background: colour }} />
    </button>
  );
}

// eslint-disable-next-line no-unused-vars
function MiniRow({ icon, title, text, badge }) {
  return (
    <div style={styles.miniRow}>
      <span>{icon}</span>
      <div style={{ flex: 1 }}>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {badge && <span style={styles.dueBadge}>{badge}</span>}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function SmallMetric({ label, value, colour }) {
  return (
    <div style={styles.smallMetric}>
      <strong style={{ color: colour }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function Empty({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

function formatDate(date) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const styles = {
  page: {
    minHeight: "100%",
    background: "linear-gradient(180deg, #F8FBFF 0%, #EEF4FA 100%)",
    padding: 22,
    color: "#0F172A",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  loading: {
    padding: 50,
    textAlign: "center",
    color: "#64748B",
    fontWeight: 800,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  heroMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  orgPill: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    margin: 0,
    fontWeight: 950,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: 15,
  },
  dateCard: {
    background: "#fff",
    borderRadius: 18,
    padding: "16px 22px",
    boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 140,
  },
  liveHero: {
    background: "linear-gradient(135deg, #081226, #12235A)",
    borderRadius: 22,
    color: "#fff",
    padding: 24,
    marginBottom: 22,
    boxShadow: "0 18px 38px rgba(15,23,42,0.25)",
  },
  liveHeroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 22,
  },
  liveBadge: {
    color: "#5EEAD4",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 2,
  },
  liveCount: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: 800,
  },
  liveHeroBody: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
  },
  liveHeroTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
  },
  liveHeroMeta: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
  },
  liveHeroButton: {
    border: "none",
    background: "linear-gradient(135deg, #06B6D4, #14B8A6)",
    color: "#fff",
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  liveStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 18,
  },
  liveStat: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  progressLabel: {
    display: "flex",
    justifyContent: "space-between",
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
  },
  progressBar: {
    height: 10,
    background: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  equalLiveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 20,
    marginTop: 18,
  },
  equalLiveCard: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 16px 34px rgba(0,0,0,0.18)",
  },
  equalLiveTitle: {
    fontSize: 24,
    fontWeight: 950,
    color: "#fff",
  },
  equalLiveMeta: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
  },
  equalStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 18,
  },
  equalStat: {
    padding: "15px 10px",
    textAlign: "center",
    borderRight: "1px solid rgba(255,255,255,0.10)",
  },
  equalActions: {
    display: "grid",
    gridTemplateColumns: "1.25fr 1fr 1fr",
    gap: 10,
    marginTop: 16,
  },
  equalPrimaryButton: {
    border: "none",
    background: "linear-gradient(135deg, #06B6D4, #14B8A6)",
    color: "#fff",
    borderRadius: 14,
    padding: "13px 14px",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 14,
  },
  equalGhostButton: {
    border: "1px solid rgba(255,255,255,0.26)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 14,
    padding: "13px 14px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  },
  multiLiveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  multiLiveCard: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
  },
  multiLiveTitle: {
    fontSize: 14,
    fontWeight: 950,
  },
  multiLiveMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.68)",
    marginTop: 4,
  },
  multiLiveStats: {
    background: "rgba(20,184,166,0.18)",
    border: "1px solid rgba(94,234,212,0.28)",
    color: "#5EEAD4",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
  },
  multiLiveArrow: {
    color: "#5EEAD4",
    fontWeight: 950,
  },
  encouragement: {
    borderRadius: 18,
    color: "#fff",
    padding: "22px 26px",
    display: "flex",
    alignItems: "center",
    gap: 18,
    boxShadow: "0 16px 34px rgba(79,70,229,0.25)",
    marginBottom: 22,
    overflow: "hidden",
  },
  trophy: {
    fontSize: 54,
  },
  encouragementTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 900,
  },
  encouragementText: {
    margin: "7px 0 0",
    fontWeight: 700,
  },
  encouragementSmall: {
    margin: "8px 0 0",
    fontSize: 13,
    fontWeight: 800,
  },
  confetti: {
    marginLeft: "auto",
    fontSize: 26,
    opacity: 0.9,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 18,
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  panel: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #E5EAF2",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
  },
  panelTitle: {
    margin: "0 0 14px",
    fontSize: 16,
    fontWeight: 950,
  },
  glanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 14,
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 12,
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 18,
  },
  mobileGrid: {
    gridTemplateColumns: "1fr",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #E5EAF2",
    borderRadius: 18,
    padding: 18,
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
  },
  bigIcon: {
    fontSize: 42,
    marginBottom: 10,
  },
  statTitle: {
    margin: "0 0 5px",
    fontSize: 15,
    fontWeight: 950,
  },
  cardText: {
    margin: 0,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 1.45,
  },
  softBadge: {
    marginTop: 14,
    background: "#F5F3FF",
    borderRadius: 12,
    padding: "9px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  actionCard: {
    border: "1px solid #E5EAF2",
    borderRadius: 16,
    padding: 14,
    cursor: "pointer",
    display: "flex",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    color: "#0F172A",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 20,
    flexShrink: 0,
  },
  attentionRow: {
    width: "100%",
    border: "1px solid #E5EAF2",
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    textAlign: "left",
    cursor: "pointer",
  },
  attentionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  rocketCard: {
    background: "linear-gradient(135deg, #F5E8FF, #E0F2FE)",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  rocket: {
    fontSize: 58,
  },
  bigMessage: {
    margin: "0 0 10px",
    fontSize: 22,
    fontWeight: 950,
  },
  encourageCard: {
    background: "linear-gradient(180deg, #F0FDFA, #ECFDF5)",
    borderRadius: 16,
    padding: 16,
  },
  greenButton: {
    border: "none",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 12px",
    marginTop: 14,
    width: "100%",
    fontWeight: 900,
    cursor: "pointer",
  },
  miniRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #EEF2F7",
    padding: "11px 0",
  },
  dueBadge: {
    background: "#FEF3C7",
    color: "#B45309",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
  },
  yellowButton: {
    width: "100%",
    border: "none",
    background: "#FACC15",
    color: "#111827",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
  smallMetric: {
    background: "#F8FAFC",
    border: "1px solid #E5EAF2",
    borderRadius: 14,
    padding: 12,
    textAlign: "center",
  },
  snapshotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  impactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  empty: {
    textAlign: "center",
    padding: 28,
    color: "#64748B",
    fontWeight: 800,
  },
  quote: {
    background: "#fff",
    borderRadius: 18,
    padding: 18,
    color: "#334155",
    lineHeight: 1.6,
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  },
  footerBanner: {
    marginTop: 18,
    textAlign: "center",
    background: "linear-gradient(135deg, #ECFEFF, #ECFDF5)",
    border: "1px solid #CCFBF1",
    borderRadius: 18,
    padding: 18,
    fontSize: 16,
  },
};
