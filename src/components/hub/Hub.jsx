import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Hub({ org, session, setTab, onNavigate, userProfile, onAvatarClick }) {
  const [hubUserName, setHubUserName] = React.useState(() => session?.user?.email?.split('@')[0] || 'there')
  const [search, setSearch] = React.useState('')
  const [searchResults, setSearchResults] = React.useState(null)

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
    return () => { alive = false; clearInterval(interval); };
  }, [orgId]);

  // ── SEARCH ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return }
    const q = search.toLowerCase()
    const timer = setTimeout(() => {
      const matchedChildren = children.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.group_name?.toLowerCase().includes(q)
      ).slice(0, 4)
      const matchedSessions = sessions.filter(s =>
        s.title?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)
      ).slice(0, 4)
      setSearchResults({ children: matchedChildren, sessions: matchedSessions })
    }, 250)
    return () => clearTimeout(timer)
  }, [search, children, sessions])

  const todaySessions = useMemo(() => sessions.filter(s => s.session_date === today), [sessions, today]);
  const upcomingSessions = useMemo(() => sessions.filter(s => s.session_date >= today).slice(0, 4), [sessions, today]);
  const completedWithoutReflection = useMemo(() => {
    const now = new Date();
    return sessions.filter(s => {
      const end = new Date(`${s.session_date}T${s.end_time || "23:59"}`);
      return end < now && !reflections.some(r => r.session_id === s.id);
    }).slice(0, 3);
  }, [sessions, reflections]);

  const signedIn = attendance.filter(a => a.status === "signed_in").length;
  const signedOut = attendance.filter(a => a.status === "signed_out").length;
  const medicalAlerts = children.filter(c => c.allergies || c.medical_notes).length;
  const attendanceRate = children.length > 0 ? Math.round((signedIn / children.length) * 100) : 0;
  const nextSession = upcomingSessions[0];
  const liveHeroSession = todaySessions[0];

  const getLiveSessionStats = (item) => {
    const records = attendance.filter(a => a.session_id === item.id);
    const si = records.filter(a => a.status === "signed_in").length;
    const absent = records.filter(a => a.status === "absent").length;
    const so = records.filter(a => a.status === "signed_out").length;
    const expected = Math.max(children.length, records.length);
    return { signedIn: si, absent, signedOut: so, expected, percent: expected > 0 ? Math.round((si / expected) * 100) : 0 };
  };
  const liveHeroStats = liveHeroSession ? getLiveSessionStats(liveHeroSession) : { signedIn: 0, absent: 0, signedOut: 0, expected: 0, percent: 0 };

  const openRegisterForSession = (sessionId) => {
    try { window.localStorage.setItem("launchsession_selected_session_id", sessionId); } catch (e) {}
    go("registers");
  };

  if (loading) return <div style={styles.page}><div style={styles.loading}>Loading...</div></div>;

  return (
    <div style={styles.page}>
      {/* ── HEADER ── */}
      <header style={{ background: 'var(--surface, #fff)', borderBottom: '1px solid var(--border, #e5e7eb)', padding: '0 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt={orgName} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>{orgName[0]}</div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111)', lineHeight: 1.2 }}>{orgName}</div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: primary, background: primary + '18', borderRadius: 4, padding: '1px 6px' }}>{org?.plan || 'Starter'}</span>
            </div>
          </div>

          {/* SEARCH */}
          <div style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setSearch('')}
              placeholder="Search young people, sessions..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 36px', borderRadius: 10, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface2, #f9fafb)', fontSize: 13, color: 'var(--text, #111)', outline: 'none' }}
            />
            {/* Search dropdown */}
            {searchResults && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
                {searchResults.children.length === 0 && searchResults.sessions.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 13, color: '#6B7280', textAlign: 'center' }}>No results for "{search}"</div>
                ) : (
                  <>
                    {searchResults.children.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, padding: '10px 14px 4px' }}>Young People</div>
                        {searchResults.children.map(c => (
                          <button key={c.id} onClick={() => { go('registers'); setSearch('') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: primary, flexShrink: 0 }}>{c.first_name[0]}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{c.first_name} {c.last_name}</div>
                              {c.group_name && <div style={{ fontSize: 11, color: '#6B7280' }}>{c.group_name}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.sessions.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, padding: '10px 14px 4px' }}>Sessions</div>
                        {searchResults.sessions.map(s => (
                          <button key={s.id} onClick={() => { openRegisterForSession(s.id); setSearch('') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📅</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{s.title}</div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{formatDate(s.session_date)} · {s.start_time || 'No time'}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div style={{ padding: '8px 14px', borderTop: '1px solid #F3F4F6' }}>
                  <button onClick={() => setSearch('')} style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>Press Esc to close</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
            <div style={{ width: 1, height: 20, background: 'var(--border, #e5e7eb)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={onAvatarClick}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', overflow: 'hidden', flexShrink: 0, border: `2px solid ${primary}` }}>
                {userProfile?.photo_url ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : hubUserName[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #111)' }}>{hubUserName}</div>
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border, #e5e7eb)' }} />
            <div style={{ fontSize: 12, color: 'var(--text3, #6b7280)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>

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
            <span style={{ fontSize: 13, color: 'var(--text3, #64748b)' }}>{children.length} young people</span>
            <span style={{ color: 'var(--border, #e5e7eb)' }}>·</span>
            <span style={{ fontSize: 13, color: concerns.length > 0 ? '#F59E0B' : '#10b981', fontWeight: 600 }}>
              {concerns.length > 0 ? `⚠ ${concerns.length} open concern${concerns.length > 1 ? 's' : ''}` : '✓ No safeguarding concerns'}
            </span>
          </div>
        </div>
      </header>

      {/* ── LIVE SESSION HERO ── */}
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
                return (
                  <div key={item.id} style={styles.equalLiveCard}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                      <div>
                        <div style={styles.equalLiveTitle}>{item.title}</div>
                        <div style={styles.equalLiveMeta}>{item.start_time || "No time"}{item.end_time ? ` – ${item.end_time}` : ""}{item.location ? ` · ${item.location}` : ""}</div>
                      </div>
                      <span style={{ background: "#16A34A", color: "#fff", borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 900 }}>LIVE</span>
                    </div>
                    <div style={styles.equalStatsGrid}>
                      <div style={styles.equalStat}><strong style={{ fontSize: 22, color: "#34D399" }}>{itemStats.signedIn}</strong><span style={{ fontSize: 10, color: "#34D399", fontWeight: 900 }}>In</span></div>
                      <div style={styles.equalStat}><strong style={{ fontSize: 22, color: "#60A5FA" }}>{itemStats.expected}</strong><span style={{ fontSize: 10, color: "#60A5FA", fontWeight: 900 }}>Expected</span></div>
                      <div style={styles.equalStat}><strong style={{ fontSize: 22, color: "#FB923C" }}>{itemStats.absent}</strong><span style={{ fontSize: 10, color: "#FB923C", fontWeight: 900 }}>Absent</span></div>
                      <div style={styles.equalStat}><strong style={{ fontSize: 22, color: "#C084FC" }}>{itemStats.signedOut}</strong><span style={{ fontSize: 10, color: "#C084FC", fontWeight: 900 }}>Out</span></div>
                    </div>
                    <div style={styles.progressLabel}><span>Register progress</span><span>{itemStats.percent}%</span></div>
                    <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${itemStats.percent}%`, background: primary }} /></div>
                    <button style={{ ...styles.equalPrimaryButton, marginTop: 14, background: primary }} onClick={() => openRegisterForSession(item.id)}>Open Register →</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div style={styles.liveHeroBody}>
                <div>
                  <h2 style={styles.liveHeroTitle}>{liveHeroSession.title}</h2>
                  <p style={styles.liveHeroMeta}>{liveHeroSession.start_time || "No time"}{liveHeroSession.end_time ? ` – ${liveHeroSession.end_time}` : ""}{liveHeroSession.location ? ` · ${liveHeroSession.location}` : ""}</p>
                </div>
                <button style={styles.liveHeroButton} onClick={() => openRegisterForSession(liveHeroSession.id)}>Open Live Register →</button>
              </div>
              <div style={styles.liveStatsGrid}>
                <div style={styles.liveStat}><strong>{liveHeroStats.signedIn}</strong><span>Signed in</span></div>
                <div style={styles.liveStat}><strong>{liveHeroStats.expected}</strong><span>Expected</span></div>
                <div style={styles.liveStat}><strong>{liveHeroStats.absent}</strong><span>Absent</span></div>
                <div style={styles.liveStat}><strong>{liveHeroStats.signedOut}</strong><span>Signed out</span></div>
              </div>
              <div style={styles.progressLabel}><span>Register progress</span><span>{liveHeroStats.percent}%</span></div>
              <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${liveHeroStats.percent}%`, background: primary }} /></div>
            </>
          )}
        </section>
      ) : (
        <section style={{ ...styles.encouragement, background: `linear-gradient(135deg, ${primary}, #6D28D9)` }}>
          <div style={styles.trophy}>🏆</div>
          <div>
            <h2 style={styles.encouragementTitle}>Keep making an impact, {orgName}! ⭐</h2>
            <p style={styles.encouragementText}>Supporting {children.length} young people across {sessions.length} planned sessions.</p>
          </div>
          <div style={styles.confetti}>✨</div>
        </section>
      )}

      <section style={styles.mainGrid}>
        <div style={styles.leftColumn}>
          {/* TODAY AT A GLANCE */}
          <Panel title="🧭 Today at a glance">
            <div style={{ ...styles.glanceGrid, ...(isMobile ? styles.mobileGrid : {}) }}>
              <StatCard icon="🗓️" title={todaySessions.length > 0 ? `${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today` : "No sessions today"} text={todaySessions.length > 0 ? "Ready for delivery" : "Plan something amazing"} button="Open Planner" onClick={() => go("planner")} colour={primary} />
              <StatCard icon="⚽" title={nextSession ? nextSession.title : "Next Session"} text={nextSession ? `${formatDate(nextSession.session_date)} · ${nextSession.start_time || "No time"}` : "Nothing booked yet"} badge={nextSession ? "Upcoming" : "Plan now"} onClick={() => go("planner")} colour="#7C3AED" />
              <StatCard icon="✅" title={signedIn > 0 ? `${signedIn} signed in` : "Registers"} text={signedOut > 0 ? `${signedOut} signed out` : "Take today's register"} button="Take Register" onClick={() => go("registers")} colour="#16A34A" />
              <StatCard icon="🛡️" title={concerns.length > 0 ? `${concerns.length} open concern${concerns.length > 1 ? 's' : ''}` : "Safeguarding"} text={concerns.length > 0 ? "Needs attention" : "All clear"} button="View concerns" onClick={() => go("safeguarding")} colour={concerns.length > 0 ? "#F59E0B" : "#2563EB"} />
            </div>
          </Panel>

          {/* ACTION CENTRE */}
          <Panel title="⚡ Quick Actions">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <ActionCard icon="📋" title="Take Register" text="Sign young people in/out" onClick={() => go("registers")} colour="#10B981" />
              <ActionCard icon="📅" title="Plan a Session" text="Create or edit sessions" onClick={() => go("planner")} colour="#8B5CF6" />
              <ActionCard icon="❤️" title="Volunteers" text="Manage volunteer cover" onClick={() => go("volunteers")} colour="#E91E63" />
              <ActionCard icon="🛡️" title="Safeguarding" text="Concerns & alerts" onClick={() => go("safeguarding")} colour="#2563EB" />
              <ActionCard icon="🤝" title="Mentoring" text="Track mentoring work" onClick={() => go("mentoring")} colour="#F59E0B" />
              <ActionCard icon="📊" title="Reports" text="View impact & insights" onClick={() => go("reports")} colour="#0EA5E9" />
            </div>
          </Panel>

          {/* COMING UP */}
          <Panel title="📅 Coming Up">
            {upcomingSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>No upcoming sessions</div>
                <button onClick={() => go('planner')} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Plan a session →</button>
              </div>
            ) : (
              upcomingSessions.map(s => (
                <button key={s.id} onClick={() => openRegisterForSession(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #EEF2F7', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📅</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)' }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{formatDate(s.session_date)} · {s.start_time || "No time"}{s.location ? ` · ${s.location.split(',')[0]}` : ''}</div>
                  </div>
                  <span style={{ fontSize: 11, color: primary, fontWeight: 700 }}>→</span>
                </button>
              ))
            )}
          </Panel>

          {/* REFLECTIONS DUE */}
          {completedWithoutReflection.length > 0 && (
            <Panel title={`⭐ Reflection Due (${completedWithoutReflection.length})`}>
              {completedWithoutReflection.map(s => (
                <MiniRow key={s.id} icon="📝" title={s.title} text={formatDate(s.session_date)} badge="Due" />
              ))}
              <button style={styles.yellowButton} onClick={() => go("planner")}>Complete reflections →</button>
            </Panel>
          )}
        </div>

        <div style={styles.rightColumn}>
          {/* ATTENTION CENTRE */}
          <Panel title="🔔 Attention Centre">
            <AttentionRow icon="📋" label="Registers" value={signedIn > 0 ? `${signedIn} signed in today` : "No activity yet"} tone={signedIn > 0 ? "green" : "blue"} onClick={() => go("registers")} />
            <AttentionRow icon="🛡️" label="Safeguarding" value={concerns.length > 0 ? `${concerns.length} open concern${concerns.length > 1 ? "s" : ""}` : "No open concerns"} tone={concerns.length > 0 ? "amber" : "green"} onClick={() => go("safeguarding")} />
            <AttentionRow icon="❤️" label="Volunteers" value="Review session cover" tone="blue" onClick={() => go("volunteers")} />
            <AttentionRow icon="🤝" label="Mentoring" value="View active matches" tone="blue" onClick={() => go("mentoring")} />
            <AttentionRow icon="📊" label="Reports" value="View impact data" tone="blue" onClick={() => go("reports")} />
          </Panel>

          {/* SAFEGUARDING SNAPSHOT */}
          <Panel title="🛡️ Safeguarding Snapshot">
            <div style={styles.snapshotGrid}>
              <SmallMetric label="Open Concerns" value={concerns.length} colour={concerns.length > 0 ? "#F59E0B" : "#059669"} onClick={() => go("safeguarding")} />
              <SmallMetric label="Medical Alerts" value={medicalAlerts} colour="#F59E0B" onClick={() => go("registers")} />
              <SmallMetric label="Reflections Due" value={completedWithoutReflection.length} colour={completedWithoutReflection.length > 0 ? "#DC2626" : "#059669"} onClick={() => go("planner")} />
            </div>
          </Panel>

          {/* IMPACT */}
          <Panel title="💎 Impact This Month">
            <div style={styles.impactGrid}>
              <SmallMetric label="Young People" value={children.length} colour={primary} onClick={() => go("registers")} />
              <SmallMetric label="Sessions" value={sessions.length} colour="#7C3AED" onClick={() => go("planner")} />
              <SmallMetric label="Signed In" value={signedIn} colour="#2563EB" onClick={() => go("registers")} />
              <SmallMetric label="Attendance" value={`${attendanceRate}%`} colour="#059669" onClick={() => go("reports")} />
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
function Panel({ title, children }) {
  return <div style={styles.panel}><h3 style={styles.panelTitle}>{title}</h3>{children}</div>;
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
    <button style={{ ...styles.actionCard, background: `${colour}12` }} onClick={onClick}>
      <div style={{ ...styles.actionIcon, background: colour }}>{icon}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{text}</div>
      </div>
      <span style={{ color: colour, fontSize: 16 }}>→</span>
    </button>
  );
}

function AttentionRow({ icon, label, value, tone, onClick }) {
  const colour = tone === "green" ? "#16A34A" : tone === "amber" ? "#F59E0B" : "#0EA5E9";
  return (
    <button style={styles.attentionRow} onClick={onClick}>
      <span style={{ ...styles.attentionIcon, fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{value}</div>
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111)' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>{text}</div>
      </div>
      {badge && <span style={styles.dueBadge}>{badge}</span>}
    </div>
  );
}

function SmallMetric({ label, value, colour, onClick }) {
  return (
    <button onClick={onClick} style={{ ...styles.smallMetric, cursor: onClick ? 'pointer' : 'default' }}>
      <strong style={{ color: colour, fontSize: 22, fontWeight: 900 }}>{value}</strong>
      <span style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{label}</span>
    </button>
  );
}

function formatDate(date) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const styles = {
  page: { minHeight: "100%", background: "linear-gradient(180deg, #F8FBFF 0%, #EEF4FA 100%)", padding: 22, color: "#0F172A", overflowY: "auto", boxSizing: "border-box" },
  loading: { padding: 50, textAlign: "center", color: "#64748B", fontWeight: 800 },
  liveHero: { background: "linear-gradient(135deg, #081226, #12235A)", borderRadius: 22, color: "#fff", padding: 24, marginBottom: 22, boxShadow: "0 18px 38px rgba(15,23,42,0.25)" },
  liveHeroTop: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 22 },
  liveBadge: { color: "#5EEAD4", fontSize: 12, fontWeight: 950, letterSpacing: 2 },
  liveCount: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 800 },
  liveHeroBody: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 },
  liveHeroTitle: { margin: 0, fontSize: 26, fontWeight: 950 },
  liveHeroMeta: { margin: "8px 0 0", color: "rgba(255,255,255,0.72)", fontSize: 14 },
  liveHeroButton: { border: "none", background: "linear-gradient(135deg, #06B6D4, #14B8A6)", color: "#fff", borderRadius: 14, padding: "13px 18px", fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap" },
  liveStatsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 },
  liveStat: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 4 },
  progressLabel: { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: 800, marginBottom: 8 },
  progressBar: { height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  equalLiveGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginTop: 16 },
  equalLiveCard: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 20 },
  equalLiveTitle: { fontSize: 20, fontWeight: 950, color: "#fff" },
  equalLiveMeta: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontSize: 13 },
  equalStatsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  equalStat: { padding: "12px 8px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 3 },
  equalPrimaryButton: { border: "none", color: "#fff", borderRadius: 12, padding: "12px 14px", fontWeight: 900, cursor: "pointer", fontSize: 13, width: "100%" },
  encouragement: { borderRadius: 18, color: "#fff", padding: "22px 26px", display: "flex", alignItems: "center", gap: 18, boxShadow: "0 16px 34px rgba(79,70,229,0.25)", marginBottom: 22, overflow: "hidden" },
  trophy: { fontSize: 48 },
  encouragementTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  encouragementText: { margin: "7px 0 0", fontWeight: 600, fontSize: 13, opacity: 0.85 },
  confetti: { marginLeft: "auto", fontSize: 26 },
  mainGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 },
  leftColumn: { display: "flex", flexDirection: "column", gap: 18 },
  rightColumn: { display: "flex", flexDirection: "column", gap: 18 },
  panel: { background: "rgba(255,255,255,0.92)", border: "1px solid #E5EAF2", borderRadius: 20, padding: 18, boxShadow: "0 12px 28px rgba(15,23,42,0.06)" },
  panelTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: 'var(--text, #111)' },
  glanceGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  mobileGrid: { gridTemplateColumns: "1fr" },
  statCard: { background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: 16, textAlign: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(15,23,42,0.05)", width: "100%" },
  bigIcon: { fontSize: 36, marginBottom: 8 },
  statTitle: { margin: "0 0 4px", fontSize: 14, fontWeight: 900 },
  cardText: { margin: 0, color: "#64748B", fontSize: 12, lineHeight: 1.45 },
  softBadge: { marginTop: 12, background: "#F5F3FF", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 800 },
  actionCard: { border: "1px solid #E5EAF2", borderRadius: 14, padding: "12px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", width: "100%" },
  actionIcon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, flexShrink: 0 },
  attentionRow: { width: "100%", border: "1px solid #E5EAF2", background: "#F8FAFC", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, textAlign: "left", cursor: "pointer" },
  attentionIcon: { width: 34, height: 34, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  dot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  miniRow: { display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #EEF2F7", padding: "10px 0" },
  dueBadge: { background: "#FEF3C7", color: "#B45309", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 800 },
  yellowButton: { width: "100%", border: "none", background: "#FACC15", color: "#111827", borderRadius: 10, padding: 11, marginTop: 12, fontWeight: 900, cursor: "pointer" },
  smallMetric: { background: "#F8FAFC", border: "1px solid #E5EAF2", borderRadius: 12, padding: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" },
  snapshotGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  impactGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
};
