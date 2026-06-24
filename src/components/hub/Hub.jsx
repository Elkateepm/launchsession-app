import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Hub({ org, session, setTab, onNavigate, userProfile, onAvatarClick }) {
  const [hubUserName, setHubUserName] = React.useState(() => session?.user?.email?.split('@')[0] || 'there')

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  React.useEffect(() => {
    if (!session?.user?.id) return
    import('../../lib/supabase').then(({ supabase }) => {
      supabase.from('user_profiles').select('full_name').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.full_name) setHubUserName(data.full_name) })
    })
  }, [session?.user?.id])
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
  const signedOut = attendance.filter(a => a.status === "signed_out").length;
  const medicalAlerts = children.filter(c => c.allergies || c.medical_notes).length;
  const attendanceRate = children.length > 0 ? Math.round((signedIn / children.length) * 100) : 0;

  const nextSession = upcomingSessions[0];

  const liveHeroSession = todaySessions[0];
  const getLiveSessionStats = (item) => {
    const records = attendance.filter(a => a.session_id === item.id);
    const signedIn = records.filter(a => a.status === "signed_in").length;
    const absent = records.filter(a => a.status === "absent").length;
    const signedOut = records.filter(a => a.status === "signed_out").length;
    const expected = Math.max(children.length, records.length);
    const percent = expected > 0 ? Math.round((signedIn / expected) * 100) : 0;

    return { signedIn, absent, signedOut, expected, percent };
  };
  const liveHeroStats = liveHeroSession
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
            {/* ── PREMIUM HEADER ─────────────────────────────── */}
      <header style={{ background: 'var(--surface, #fff)', borderBottom: '1px solid var(--border, #e5e7eb)', padding: '0 28px', flexShrink: 0 }}>

        {/* STATUS BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt={orgName} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>
                {orgName[0]}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111)', lineHeight: 1.2 }}>{orgName}</div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: primary, background: primary + '18', borderRadius: 4, padding: '1px 6px' }}>
                {org?.plan || 'Starter'}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>🔍</span>
            <input placeholder="Search young people, sessions, volunteers..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 36px', borderRadius: 10, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface2, #f9fafb)', fontSize: 13, color: 'var(--text, #111)', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
            <button onClick={() => setTab('messaging')} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Messages">💬</button>
            <div style={{ width: 1, height: 20, background: 'var(--border, #e5e7eb)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={onAvatarClick}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', overflow: 'hidden', flexShrink: 0, border: `2px solid ${primary}` }}>
                {userProfile?.photo_url
                  ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : hubUserName[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #111)' }}>{hubUserName}</div>
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border, #e5e7eb)' }} />
            <div style={{ fontSize: 12, color: 'var(--text3, #6b7280)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>

        {/* WELCOME ROW */}
        <div style={{ padding: '14px 0 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: primary, marginBottom: 4 }}>{orgName}</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text, #0f172a)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            {getGreeting()}, {hubUserName}
          </h1>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text3, #64748b)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: todaySessions.length > 0 ? '#10b981' : '#9ca3af', fontSize: 8 }}>●</span>
              {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''} today
            </span>
            <span style={{ color: 'var(--border, #e5e7eb)' }}>·</span>
            <span style={{ fontSize: 13, color: 'var(--text3, #64748b)' }}>{liveHeroStats?.expected || 0} young people expected</span>
            <span style={{ color: 'var(--border, #e5e7eb)' }}>·</span>
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>✓ No safeguarding concerns</span>
          </div>
        </div>
      </header>

      {liveHeroSession ? (
        <section style={styles.liveHero}>
          <div style={styles.liveHeroTop}>
            <span style={styles.liveBadge}>● LIVE SESSION TODAY</span>
            <span style={styles.liveCount}>{todaySessions.length} active today</span>
          </div>

          {todaySessions.length > 1 ? (
            <div style={styles.equalLiveGrid}>
              {todaySessions.map(item => {
                const itemStats = getLiveSessionStats(item);
                const hasRegister = itemStats.expected > 0 || itemStats.signedIn > 0 || itemStats.absent > 0 || itemStats.signedOut > 0;

                return (
                  <div key={item.id} style={styles.equalLiveCard}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                          width: 64,
                          height: 64,
                          borderRadius: 20,
                          background: "linear-gradient(135deg, #06B6D4, #14B8A6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 30,
                          boxShadow: "0 12px 24px rgba(20,184,166,0.25)"
                        }}>
                          {item.session_type === "trip" ? "🚌" : item.session_type === "mentoring" ? "🤝" : item.session_type === "workshop" ? "🛠️" : "🏃"}
                        </div>
                        <div>
                          <div style={styles.equalLiveTitle}>{item.title}</div>
                          <div style={styles.equalLiveMeta}>
                        {item.start_time || "No time"}
                        {item.end_time ? ` – ${item.end_time}` : ""}
                        {item.location ? ` · ${item.location}` : ""}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        background: "#16A34A",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "7px 13px",
                        fontSize: 12,
                        fontWeight: 950,
                        boxShadow: "0 8px 18px rgba(22,163,74,0.24)"
                      }}>
                        LIVE
                      </span>
                    </div>

                    <div style={styles.equalStatsGrid}>
                      <div style={styles.equalStat}><strong style={{ fontSize: 24, color: "#34D399" }}>{itemStats.signedIn}</strong><span style={{ fontSize: 11, color: "#34D399", fontWeight: 900 }}>Signed in</span></div>
                      <div style={styles.equalStat}><strong style={{ fontSize: 24, color: "#60A5FA" }}>{itemStats.expected}</strong><span style={{ fontSize: 11, color: "#60A5FA", fontWeight: 900 }}>Expected</span></div>
                      <div style={styles.equalStat}><strong style={{ fontSize: 24, color: "#FB923C" }}>{itemStats.absent}</strong><span style={{ fontSize: 11, color: "#FB923C", fontWeight: 900 }}>Absent</span></div>
                      <div style={styles.equalStat}><strong style={{ fontSize: 24, color: "#C084FC" }}>{itemStats.signedOut}</strong><span style={{ fontSize: 11, color: "#C084FC", fontWeight: 900 }}>Out</span></div>
                    </div>

                    <div style={styles.progressLabel}>
                      <span>Register progress</span>
                      <span>{itemStats.percent}%</span>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${itemStats.percent}%`, background: primary }} />
                    </div>

                    <div style={styles.equalActions}>
                      <button style={styles.equalPrimaryButton} onClick={() => openRegisterForSession(item.id)}>
                        Open Register →
                      </button>

                      {hasRegister && (
                        <>
                          <button style={styles.equalGhostButton} onClick={() => openRegisterForSession(item.id)}>
                            ⇥ Sign In
                          </button>
                          <button style={styles.equalGhostButton} onClick={() => openRegisterForSession(item.id)}>
                            ⇤ Sign Out
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div style={styles.liveHeroBody}>
                <div>
                  <h2 style={styles.liveHeroTitle}>{liveHeroSession.title}</h2>
                  <p style={styles.liveHeroMeta}>
                    {liveHeroSession.start_time || "No time"}
                    {liveHeroSession.end_time ? ` – ${liveHeroSession.end_time}` : ""}
                    {liveHeroSession.location ? ` · ${liveHeroSession.location}` : ""}
                  </p>
                </div>

                <button style={styles.liveHeroButton} onClick={() => openRegisterForSession(liveHeroSession.id)}>
                  Open Live Register →
                </button>
              </div>

              <div style={styles.liveStatsGrid}>
                <div style={styles.liveStat}><strong>{liveHeroStats.signedIn}</strong><span>Signed in</span></div>
                <div style={styles.liveStat}><strong>{liveHeroStats.expected}</strong><span>Expected</span></div>
                <div style={styles.liveStat}><strong>{liveHeroStats.absent}</strong><span>Absent</span></div>
                <div style={styles.liveStat}><strong>{liveHeroStats.signedOut}</strong><span>Signed out</span></div>
              </div>

              <div style={styles.progressLabel}>
                <span>Register progress</span>
                <span>{liveHeroStats.percent}%</span>
              </div>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${liveHeroStats.percent}%`, background: primary }} />
              </div>
            </>
          )}
        </section>
      ) : (
        <section style={{ ...styles.encouragement, background: `linear-gradient(135deg, ${primary}, #6D28D9)` }}>
          <div style={styles.trophy}>🏆</div>
          <div>
            <h2 style={styles.encouragementTitle}>Keep making an impact, {orgName}! ⭐</h2>
            <p style={styles.encouragementText}>
              You’ve supported {children.length} young people across {sessions.length} planned sessions.
            </p>
            <p style={styles.encouragementSmall}>❤️ Every session. Every child. Every opportunity.</p>
          </div>
          <div style={styles.confetti}>✨ 🎉 🌈</div>
        </section>
      )}

      <section style={styles.mainGrid}>
        <div style={styles.leftColumn}>
          <Panel title="🧭 Today at a glance">
            <div style={{ ...styles.glanceGrid, ...(isMobile ? styles.mobileGrid : {}) }}>
              <StatCard
                icon="🗓️"
                title={todaySessions.length > 0 ? `${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today` : "No sessions today"}
                text={todaySessions.length > 0 ? "Ready for delivery" : "Plan something amazing"}
                button="Open Session Planner"
                onClick={() => go("planner")}
                colour={primary}
              />

              <StatCard
                icon="⚽"
                title={nextSession ? nextSession.title : "Next Session"}
                text={nextSession ? `${formatDate(nextSession.session_date)} · ${nextSession.start_time || "No time"}` : "Nothing booked yet"}
                badge={nextSession ? "Upcoming" : "Plan now"}
                onClick={() => go("planner")}
                colour="#7C3AED"
              />

              <StatCard
                icon="✅"
                title={signedIn > 0 ? `${signedIn} signed in` : "Registers"}
                text={signedOut > 0 ? `${signedOut} signed out` : "All clear"}
                button="Take Register"
                onClick={() => go("registers")}
                colour="#16A34A"
              />

              <StatCard
                icon="⭐"
                title={`${completedWithoutReflection.length} due`}
                text="Sessions need reflection"
                button="Complete now"
                onClick={() => go("planner")}
                colour="#F59E0B"
              />
            </div>
          </Panel>

          <Panel title="⚡ Action Centre">
            <div style={{ ...styles.actionGrid, ...(isMobile ? styles.mobileGrid : {}) }}>
              <ActionCard icon="📋" title="Start Register" text="Take attendance in one tap" onClick={() => go("registers")} colour="#10B981" />
              <ActionCard icon="🟣" title="Open Session Planner" text="Plan your next great session" onClick={() => go("planner")} colour="#8B5CF6" />
              <ActionCard icon="🧒" title="Add Child" text="Register a young person" onClick={() => go("registers")} colour="#F59E0B" />
              <ActionCard icon="🛡️" title="Safeguarding" text="Check concerns and alerts" onClick={() => go("safeguarding")} colour="#2563EB" />
              <ActionCard icon="🤝" title="Mentoring" text="Track mentoring work" onClick={() => go("mentoring")} colour="#E91E63" />
            </div>
          </Panel>

          <div style={{ ...styles.bottomGrid, ...(isMobile ? styles.mobileGrid : {}) }}>
            <Panel title="💙 Encouragement for you">
              <div style={styles.encourageCard}>
                <h2 style={styles.bigMessage}>Small steps.<br />Big change. ❤️</h2>
                <p style={styles.cardText}>
                  Your commitment this month has helped create safe spaces, build confidence and inspire brighter futures.
                </p>
                <button style={{ ...styles.greenButton, background: primary }}>Keep going, you’re making a difference! 🌱</button>
              </div>
            </Panel>

            <Panel title="📅 Coming Up">
              {upcomingSessions.length === 0 ? (
                <Empty text="No upcoming sessions yet." />
              ) : (
                upcomingSessions.map(s => (
                  <MiniRow key={s.id} icon="⚽" title={s.title} text={`${formatDate(s.session_date)} · ${s.start_time || "No time"}`} />
                ))
              )}
            </Panel>

            <Panel title={`⭐ Reflection Due (${completedWithoutReflection.length})`}>
              {completedWithoutReflection.length === 0 ? (
                <Empty text="No reflections due. Great work!" />
              ) : (
                <>
                  {completedWithoutReflection.map(s => (
                    <MiniRow key={s.id} icon="📝" title={s.title} text={formatDate(s.session_date)} badge="Due" />
                  ))}
                  <button style={styles.yellowButton} onClick={() => go("planner")}>Complete reflections →</button>
                </>
              )}
            </Panel>
          </div>
        </div>

        <div style={styles.rightColumn}>
          <Panel title="🔔 Attention Centre">
            <AttentionRow icon="📝" label="Registers" value={signedIn > 0 ? `${signedIn} signed in` : "All clear"} tone="green" onClick={() => go("registers")} />
            <AttentionRow icon="🛡️" label="Safeguarding" value={concerns.length > 0 ? `${concerns.length} open concern${concerns.length > 1 ? "s" : ""}` : "No open concerns"} tone={concerns.length > 0 ? "amber" : "green"} onClick={() => go("safeguarding")} />
            <AttentionRow icon="💬" label="Messages" value="Check inbox" tone="blue" onClick={() => go("messages")} />
            <AttentionRow icon="❤️" label="Volunteers" value="Review cover" tone="blue" onClick={() => go("volunteers")} />
          </Panel>

          <Panel title="💪 You’re doing amazing work!">
            <div style={styles.rocketCard}>
              <div>
                <h2 style={styles.bigMessage}>Consistency is changing lives.</h2>
                <p style={styles.cardText}>Thank you for showing up for {orgName}.</p>
              </div>
              <div style={styles.rocket}>🚀</div>
            </div>
          </Panel>

          <Panel title="🛡️ Safeguarding Snapshot">
            <div style={styles.snapshotGrid}>
              <SmallMetric label="Open Concerns" value={concerns.length} colour="#059669" />
              <SmallMetric label="Medical Alerts" value={medicalAlerts} colour="#F59E0B" />
              <SmallMetric label="Needs Attention" value={completedWithoutReflection.length} colour="#DC2626" />
            </div>
          </Panel>

          <Panel title="💎 Our Impact This Month">
            <div style={styles.impactGrid}>
              <SmallMetric label="Young People" value={children.length} colour={primary} />
              <SmallMetric label="Sessions" value={sessions.length} colour="#7C3AED" />
              <SmallMetric label="Signed In" value={signedIn} colour="#2563EB" />
              <SmallMetric label="Attendance" value={`${attendanceRate}%`} colour="#059669" />
            </div>
          </Panel>

          <div style={styles.quote}>
            “Alone we can do so little; together we can do so much.”
            <br />
            <strong>— Helen Keller</strong>
          </div>
        </div>
      </section>

      <div style={styles.footerBanner}>
        🌱 Building stronger communities through sport, mentoring and opportunity.
        <br />
        <strong>Thank you for being part of the {orgName} family! 💚</strong>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>{title}</h3>
      {children}
    </div>
  );
}

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

function SmallMetric({ label, value, colour }) {
  return (
    <div style={styles.smallMetric}>
      <strong style={{ color: colour }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

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
