
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Hub({ org, session, setTab }) {
  const orgId = org?.id;

  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [children, setChildren] = useState([]);
  const [showSignIn, setShowSignIn] = useState(false);
  const [selectedLiveSession, setSelectedLiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    async function loadHub() {
      setLoading(true);

      const [{ data: sessionData }, { data: attendanceData }, { data: concernData }, { data: childData }] =
        await Promise.all([
          supabase
            .from("sessions")
            .select("*")
            .eq("org_id", orgId)
            .gte("session_date", today)
            .order("session_date", { ascending: true })
            .order("start_time", { ascending: true }),

          supabase
            .from("attendance")
            .select("*")
            .eq("org_id", orgId),

          supabase
            .from("safeguarding_concerns")
            .select("*")
            .eq("org_id", orgId)
            .eq("status", "open"),

          supabase
            .from("children")
            .select("*")
            .eq("org_id", orgId)
            .eq("active", true)
            .order("first_name", { ascending: true }),
        ]);

      if (!alive) return;

      setSessions(sessionData || []);
      setAttendance(attendanceData || []);
      setConcerns(concernData || []);
      setChildren(childData || []);
      setLoading(false);
    }

    loadHub();

    const interval = setInterval(loadHub, 30000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [orgId, today]);

  const todaySessions = useMemo(() => {
    return sessions.filter((item) => item.session_date === today);
  }, [sessions, today]);

  const liveSessions = todaySessions;

  function getSessionAttendance(sessionId) {
    return attendance.filter((item) => item.session_id === sessionId);
  }

  function getSessionStats(sessionId) {
    const sessionAttendance = getSessionAttendance(sessionId);

    return {
      expected: Math.max(children.length, sessionAttendance.length),
      present: sessionAttendance.filter((item) => item.status === "signed_in").length,
      absent: sessionAttendance.filter((item) => item.status === "absent").length,
      left: sessionAttendance.filter((item) => item.status === "signed_out").length,
    };
  }

  const overallStats = liveSessions.reduce(
    (total, item) => {
      const itemStats = getSessionStats(item.id);
      return {
        expected: total.expected + itemStats.expected,
        present: total.present + itemStats.present,
        absent: total.absent + itemStats.absent,
        left: total.left + itemStats.left,
      };
    },
    { expected: 0, present: 0, absent: 0, left: 0 }
  );

  const upcoming = sessions.slice(0, 5);

  function go(tab) {
    if (typeof setTab === "function") setTab(tab);
  }

  function getDurationProgress(item) {
    if (!item.start_time || !item.end_time) return 0;

    const now = new Date();
    const start = new Date(`${item.session_date}T${item.start_time}`);
    const end = new Date(`${item.session_date}T${item.end_time}`);

    if (now <= start) return 0;
    if (now >= end) return 100;

    return Math.round(((now - start) / (end - start)) * 100);
  }

  function getTimeRemaining(item) {
    if (!item.end_time) return "No end time";

    const now = new Date();
    const end = new Date(`${item.session_date}T${item.end_time}`);

    const diff = end - now;

    if (diff <= 0) return "Finished";

    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;

    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }

  if (loading) {
    return (
      <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
        <div style={styles.loading}>Loading today’s hub...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <section style={{ ...styles.welcome, ...(isMobile ? styles.welcomeMobile : {}) }}>
        <div>
          <div style={styles.orgLabel}>{org?.name || "LaunchSession"}</div>
          <h1 style={styles.title}>Good morning, mohammed! 👋</h1>
          <p style={styles.subtitle}>
            Here’s what needs attention across today’s sessions.
          </p>
        </div>

        <div style={{ ...styles.dateCard, ...(isMobile ? styles.dateCardMobile : {}) }}>
          <div style={styles.dateDay}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long" })}
          </div>
          <div style={styles.dateText}>
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </section>

      <section style={{ ...styles.topGrid, ...(isMobile ? styles.topGridMobile : {}) }}>
        <div style={{ ...styles.liveCard, ...(isMobile ? styles.liveCardMobile : {}) }}>
          <div style={styles.liveTop}>
            <span style={styles.liveBadge}>
              {liveSessions.length > 0 ? `● ${liveSessions.length} Live Session${liveSessions.length > 1 ? "s" : ""}` : "No Session Today"}
            </span>

            <span style={styles.timeText}>
              {liveSessions.length} active today
            </span>
          </div>

          {liveSessions.length > 0 ? (
            <>
              <div style={{ ...styles.liveSummaryGrid, ...(isMobile ? styles.liveSummaryGridMobile : {}) }}>
                <Metric label="Checked In" value={overallStats.present} colour="#22c55e" />
                <Metric label="Expected" value={overallStats.expected} colour="#facc15" />
                <Metric label="Absent" value={overallStats.absent} colour="#ef4444" />
                <Metric label="Left" value={overallStats.left} colour="#94a3b8" />
              </div>

              <div style={styles.liveSessionList}>
                {liveSessions.map((item) => {
                  const itemStats = getSessionStats(item.id);
                  const checkedPercent = itemStats.expected > 0
                    ? Math.round((itemStats.present / itemStats.expected) * 100)
                    : 0;

                  return (
                    <div key={item.id} style={{ ...styles.liveSessionRow, ...(isMobile ? styles.liveSessionRowMobile : {}) }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.liveSessionTitle}>{item.title}</div>
                        <div style={styles.liveSessionMeta}>
                          {item.start_time || "No time"}
                          {item.end_time ? ` – ${item.end_time}` : ""}
                          {item.location ? ` · ${item.location}` : ""}
                        </div>

                        <div style={styles.progressGroup}>
                          <div style={styles.progressLabelRow}>
                            <span>Duration</span>
                            <span>{getTimeRemaining(item)}</span>
                          </div>
                          <div style={styles.miniProgressBar}>
                            <div
                              style={{
                                ...styles.durationProgressFill,
                                width: `${getDurationProgress(item)}%`,
                              }}
                            />
                          </div>

                          <div style={styles.progressLabelRow}>
                            <span>Kids signed in</span>
                            <span>{itemStats.present} / {itemStats.expected}</span>
                          </div>
                          <div style={styles.miniProgressBar}>
                            <div
                              style={{
                                ...styles.miniProgressFill,
                                width: `${checkedPercent}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ ...styles.liveSessionStats, ...(isMobile ? styles.liveSessionStatsMobile : {}) }}>
                        <button
                          style={styles.expectedChip}
                          onClick={() => {
                            setSelectedLiveSession(item);
                            setShowSignIn(true);
                          }}
                        >
                          {itemStats.expected} Expected
                        </button>

                        <button
                          style={styles.signInChipButton}
                          onClick={() => {
                            setSelectedLiveSession(item);
                            setShowSignIn(true);
                          }}
                        >
                          Sign In
                        </button>

                        <button
                          style={styles.signOutChipButton}
                          onClick={() => {
                            setSelectedLiveSession(item);
                            setShowSignIn(true);
                          }}
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {todaySessions.length > 15 && (
                <div style={styles.liveLimitNote}>
                  Showing first 15 live sessions. {todaySessions.length - 15} more scheduled today.
                </div>
              )}
            </>
          ) : (
            <div style={styles.emptyLive}>
              <div style={{ fontSize: 34 }}>🌤️</div>
              <h2 style={styles.sessionTitle}>No active sessions</h2>
              <p style={styles.sessionMeta}>
                Plan your next session, trip, mentoring activity or workshop.
              </p>
              <button style={styles.primaryButton} onClick={() => go("sessions")}>
                Open Session Planner →
              </button>
            </div>
          )}
        </div>

        <div style={styles.attentionCard}>
          <h3 style={styles.cardTitle}>Attention Centre</h3>

          <AttentionRow
            icon="📝"
            label="Registers"
            value={overallStats.expected > overallStats.present ? `${overallStats.expected - overallStats.present} waiting` : "All clear"}
            tone={overallStats.expected > overallStats.present ? "amber" : "green"}
            onClick={() => go("registers")}
          />

          <AttentionRow
            icon="🛡️"
            label="Safeguarding"
            value={concerns.length > 0 ? `${concerns.length} open` : "No open concerns"}
            tone={concerns.length > 0 ? "red" : "green"}
            onClick={() => go("safeguarding")}
          />

          <AttentionRow
            icon="💬"
            label="Messages"
            value="Check inbox"
            tone="blue"
            onClick={() => go("messaging")}
          />

          <AttentionRow
            icon="❤️"
            label="Volunteers"
            value="Review cover"
            tone="blue"
            onClick={() => go("volunteers")}
          />
        </div>
      </section>

      <section style={{ ...styles.quickGrid, ...(isMobile ? styles.quickGridMobile : {}) }}>
        <QuickCard icon="📋" title="Take Register" text="Sign children in quickly" onClick={() => go("registers")} />
        <QuickCard icon="📅" title="Calendar" text="View sessions and events" onClick={() => go("sessions")} />
        <QuickCard icon="❤️" title="Volunteers" text="Manage your team" onClick={() => go("volunteers")} />
        <QuickCard icon="🤝" title="Mentoring" text="Track mentoring work" onClick={() => go("mentoring")} />
      </section>

      <section style={{ ...styles.bottomGrid, ...(isMobile ? styles.bottomGridMobile : {}) }}>
        <div style={styles.timelineCard}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.cardTitle}>Coming Up</h3>
            <span style={styles.muted}>Next 30 days · {upcoming.length} sessions</span>
          </div>

          {upcoming.length === 0 ? (
            <EmptyState text="No upcoming sessions yet." />
          ) : (
            upcoming.map((item) => (
              <div key={item.id} style={styles.timelineItem}>
                <div style={styles.dateBox}>
                  <strong>
                    {new Date(item.session_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                    })}
                  </strong>
                  <span>
                    {new Date(item.session_date).toLocaleDateString("en-GB", {
                      month: "short",
                    })}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={styles.timelineTitle}>{item.title}</div>
                  <div style={styles.timelineMeta}>
                    {item.start_time || "No time"} {item.location ? `· ${item.location}` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.activityCard}>
          <h3 style={styles.cardTitle}>Recent Activity</h3>

          <Activity text="Hub refreshed with latest session data" />
          <Activity text="Calendar module is now available" />
          <Activity text="Settings hub updated successfully" />
          <Activity text="Organisation modules loaded" />
        </div>
      </section>

      {showSignIn && selectedLiveSession && (
        <SignInModal
          orgId={orgId}
          session={selectedLiveSession}
          children={children}
          attendance={getSessionAttendance(selectedLiveSession.id)}
          isMobile={isMobile}
          onClose={() => {
            setShowSignIn(false);
            setSelectedLiveSession(null);
          }}
          onSignedIn={(newRecord) => {
            setAttendance((prev) => {
              const exists = prev.some((item) => item.id === newRecord.id);
              if (exists) {
                return prev.map((item) => item.id === newRecord.id ? newRecord : item);
              }
              return [...prev, newRecord];
            });
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, colour, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.metric,
        cursor: onClick ? "pointer" : "default",
        border: onClick ? "1px solid rgba(250,204,21,0.35)" : styles.metric.border,
      }}
    >
      <div style={{ ...styles.metricValue, color: colour }}>{value}</div>
      <div style={styles.metricLabel}>{label}</div>
      {onClick && <div style={styles.metricHint}>Click to sign in</div>}
    </button>
  );
}

function SignInModal({ orgId, session, children, attendance, isMobile, onClose, onSignedIn }) {
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [turboMode, setTurboMode] = useState(false);

  const attendanceByChild = useMemo(() => {
    const map = {};
    attendance.forEach((item) => {
      map[item.child_id] = item;
    });
    return map;
  }, [attendance]);

  const filteredChildren = children.filter((child) => {
    const fullName = `${child.first_name || ""} ${child.last_name || ""}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  async function signOutChild(child) {
    const existing = attendanceByChild[child.id];

    if (!existing?.id) return;

    setSavingId(child.id);

    const { data, error } = await supabase
      .from("attendance")
      .update({
        status: "left",
        signed_out_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (!error && data) onSignedIn(data);
    if (error) console.error("Sign out update error:", error);

    setSavingId(null);
  }

  async function signInChild(child) {
    const existing = attendanceByChild[child.id];
    setSavingId(child.id);

    if (existing?.id) {
      const { data, error } = await supabase
        .from("attendance")
        .update({
          status: "present",
          signed_in_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (!error && data) onSignedIn(data);
      if (error) console.error("Sign in update error:", error);
    } else {
      const { data, error } = await supabase
        .from("attendance")
        .insert({
          org_id: orgId,
          session_id: session.id,
          child_id: child.id,
          status: "present",
          signed_in_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) onSignedIn(data);
      if (error) console.error("Sign in insert error:", error);
    }

    setSavingId(null);
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.signInModal, ...(isMobile ? styles.signInModalMobile : {}) }} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalEyebrow}>Live Register</div>
            <h2 style={styles.modalTitle}>Sign in children</h2>
            <div style={styles.modalSub}>{session.title}</div>
            <div style={styles.turboSummary}>
              {attendance.filter(item => item.status === "present").length} / {children.length} signed in
            </div>
          </div>

          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.turboToolbar}>
          <input
            style={{ ...styles.searchInput, margin: 0, flex: 1 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search children..."
            autoFocus
          />

          <button
            onClick={() => setTurboMode(prev => !prev)}
            style={{
              ...styles.turboButton,
              background: turboMode ? "linear-gradient(135deg,#16a34a,#22c55e)" : "#f1f5f9",
              color: turboMode ? "#fff" : "#0f172a"
            }}
          >
            ⚡ Turbo
          </button>
        </div>

        <div style={styles.childList}>
          {filteredChildren.map((child) => {
            const record = attendanceByChild[child.id];
            const isPresent = record?.status === "present";

            return (
              <div
                key={child.id}
                onClick={() => {
                  if (!turboMode || savingId === child.id) return;
                  if (isPresent) {
                    signOutChild(child);
                  } else {
                    signInChild(child);
                  }
                }}
                style={{
                  ...styles.childRow,
                  ...(isMobile ? styles.childRowMobile : {}),
                  cursor: turboMode ? "pointer" : "default",
                  borderColor: turboMode ? (isPresent ? "#22c55e55" : "#0891b255") : "#e5e7eb"
                }}
              >
                <div style={styles.childAvatar}>
                  {(child.first_name?.[0] || "?")}{(child.last_name?.[0] || "")}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={styles.childName}>
                    {child.first_name} {child.last_name}
                  </div>
                  <div style={styles.childMeta}>
                    {child.group_name || "No group"}
                    {child.allergies ? ` · ⚠️ ${child.allergies}` : ""}
                  </div>
                </div>

                {isPresent ? (
                  <div style={{ ...styles.childActions, ...(isMobile ? styles.childActionsMobile : {}) }}>
                    <span style={styles.signedInChip}>Signed in</span>
                    <button
                      style={styles.signOutButton}
                      onClick={() => signOutChild(child)}
                      disabled={savingId === child.id}
                    >
                      {savingId === child.id ? "Signing..." : "Sign Out"}
                    </button>
                  </div>
                ) : (
                  <button
                    style={styles.signInButton}
                    onClick={() => signInChild(child)}
                    disabled={savingId === child.id}
                  >
                    {savingId === child.id ? "Signing..." : "Sign In"}
                  </button>
                )}
              </div>
            );
          })}

          {filteredChildren.length === 0 && (
            <div style={styles.emptyState}>No children found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttentionRow({ icon, label, value, tone, onClick }) {
  const colours = {
    green: "#16a34a",
    amber: "#d97706",
    red: "#dc2626",
    blue: "#0891b2",
  };

  return (
    <button style={styles.attentionRow} onClick={onClick}>
      <span style={styles.attentionIcon}>{icon}</span>
      <span style={{ flex: 1 }}>
        <strong style={styles.attentionLabel}>{label}</strong>
        <span style={styles.attentionValue}>{value}</span>
      </span>
      <span style={{ ...styles.statusDot, background: colours[tone] }} />
    </button>
  );
}

function QuickCard({ icon, title, text, onClick }) {
  return (
    <button style={styles.quickCard} onClick={onClick}>
      <div style={styles.quickIcon}>{icon}</div>
      <div>
        <div style={styles.quickTitle}>{title}</div>
        <div style={styles.quickText}>{text}</div>
      </div>
      <div style={styles.quickArrow}>→</div>
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.emptyState}>
      <div style={{ fontSize: 28 }}>🗓️</div>
      <div>{text}</div>
    </div>
  );
}

function Activity({ text }) {
  return (
    <div style={styles.activityRow}>
      <span style={styles.activityDot}>✓</span>
      <span>{text}</span>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    background: "#f1f5f9",
    minHeight: "100%",
    color: "#0f172a",
    overflowY: "auto",
  },
  loading: {
    padding: 40,
    background: "#fff",
    borderRadius: 18,
    fontWeight: 800,
    color: "#64748b",
  },
  welcome: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 18,
  },
  orgLabel: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
  },
  subtitle: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  dateCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: "14px 18px",
    textAlign: "right",
    boxShadow: "0 10px 25px rgba(15,23,42,0.04)",
  },
  dateDay: {
    fontWeight: 900,
    fontSize: 14,
  },
  dateText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  liveCard: {
    background: "linear-gradient(135deg,#0f172a,#172554)",
    color: "#fff",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 24px 50px rgba(15,23,42,0.22)",
  },
  liveTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  liveBadge: {
    color: "#5eead4",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  timeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: 800,
  },
  sessionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
  },
  sessionMeta: {
    margin: "6px 0 18px",
    color: "rgba(255,255,255,0.68)",
    fontSize: 14,
  },
  attendanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10,
    marginBottom: 14,
  },
  metric: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    textAlign: "center",
    color: "#fff",
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 900,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
    fontWeight: 900,
    marginTop: 3,
  },
  progressWrap: {
    marginBottom: 16,
  },
  progressBar: {
    height: 7,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg,#22c55e,#14b8a6)",
    borderRadius: 999,
  },
  progressText: {
    marginTop: 7,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    fontWeight: 700,
  },
  primaryButton: {
    width: "100%",
    border: "none",
    background: "linear-gradient(135deg,#0891b2,#14b8a6)",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  },
  emptyLive: {
    textAlign: "center",
    padding: "10px 0 0",
  },
  attentionCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 35px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    margin: "0 0 14px",
    fontSize: 17,
    fontWeight: 900,
  },
  attentionRow: {
    width: "100%",
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    cursor: "pointer",
    textAlign: "left",
  },
  attentionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  attentionLabel: {
    display: "block",
    fontSize: 13,
  },
  attentionValue: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 14,
    marginBottom: 16,
  },
  quickCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 12px 25px rgba(15,23,42,0.04)",
  },
  quickIcon: {
    fontSize: 26,
  },
  quickTitle: {
    fontWeight: 900,
    fontSize: 14,
  },
  quickText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  quickArrow: {
    marginLeft: "auto",
    color: "#94a3b8",
    fontWeight: 900,
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 16,
  },
  timelineCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
  },
  activityCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  muted: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  timelineItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    marginBottom: 10,
  },
  dateBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "#f1f5f9",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineTitle: {
    fontWeight: 900,
    fontSize: 14,
  },
  timelineMeta: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  emptyState: {
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },
  activityRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
  },
  activityDot: {
    color: "#16a34a",
    fontWeight: 900,
  },
  metricHint: {
    marginTop: 5,
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.58)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  signInModal: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "82vh",
    background: "#fff",
    borderRadius: 24,
    boxShadow: "0 30px 90px rgba(15,23,42,0.35)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    padding: 22,
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  modalEyebrow: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0891b2",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  modalTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
  },
  modalSub: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 4,
    fontWeight: 700,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "none",
    background: "#f1f5f9",
    cursor: "pointer",
    fontSize: 22,
    color: "#334155",
  },
  searchInput: {
    margin: "16px 22px",
    padding: "13px 15px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    fontWeight: 700,
  },
  childList: {
    overflowY: "auto",
    padding: "0 22px 22px",
  },
  childRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    marginBottom: 10,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "linear-gradient(135deg,#0891b2,#14b8a6)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    flexShrink: 0,
  },
  childName: {
    fontWeight: 900,
    fontSize: 14,
    color: "#0f172a",
  },
  childMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    marginTop: 3,
  },
  signInButton: {
    border: "none",
    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    minWidth: 92,
  },
  signedInChip: {
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
  },

  liveSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10,
    marginBottom: 14,
  },
  liveSessionList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 430,
    overflowY: "auto",
    paddingRight: 4,
  },
  liveSessionRow: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  liveSessionTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  liveSessionMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: 700,
    marginTop: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  miniProgressBar: {
    marginTop: 9,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  miniProgressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg,#22c55e,#14b8a6)",
  },
  liveSessionStats: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  expectedChip: {
    border: "1px solid rgba(250,204,21,0.35)",
    background: "rgba(250,204,21,0.14)",
    color: "#fde68a",
    borderRadius: 999,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  presentChip: {
    background: "rgba(34,197,94,0.14)",
    color: "#86efac",
    borderRadius: 999,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  liveLimitNote: {
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: 700,
    textAlign: "center",
  },

  signInChipButton: {
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.16)",
    color: "#86efac",
    borderRadius: 999,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  signOutChipButton: {
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.14)",
    color: "#fca5a5",
    borderRadius: 999,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  childActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  signOutButton: {
    border: "none",
    background: "linear-gradient(135deg,#dc2626,#ef4444)",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    minWidth: 92,
  },

  progressGroup: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  progressLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    fontWeight: 800,
  },
  durationProgressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg,#38bdf8,#818cf8)",
  },


pageMobile: {
    padding: 12,
  },
  welcomeMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  dateCardMobile: {
    textAlign: "left",
  },
  topGridMobile: {
    gridTemplateColumns: "1fr",
  },
  liveCardMobile: {
    padding: 16,
    borderRadius: 20,
  },
  liveSummaryGridMobile: {
    gridTemplateColumns: "repeat(2,1fr)",
  },
  liveSessionRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  liveSessionStatsMobile: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
  },
  quickGridMobile: {
    gridTemplateColumns: "1fr",
  },
  bottomGridMobile: {
    gridTemplateColumns: "1fr",
  },
  signInModalMobile: {
    maxWidth: "100%",
    maxHeight: "92vh",
    borderRadius: 20,
  },
  childRowMobile: {
    alignItems: "stretch",
    flexWrap: "wrap",
  },
  childActionsMobile: {
    width: "100%",
    justifyContent: "space-between",
  },

  turboToolbar: {
    display: "flex",
    gap: 10,
    padding: "16px 22px",
    borderBottom: "1px solid #f1f5f9",
  },
  turboButton: {
    border: "none",
    borderRadius: 14,
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  turboSummary: {
    marginTop: 8,
    display: "inline-flex",
    background: "#ecfeff",
    color: "#0891b2",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },

};
