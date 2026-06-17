
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Hub({ org, session, setTab }) {
  const orgId = org?.id;

  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    async function loadHub() {
      setLoading(true);

      const [{ data: sessionData }, { data: attendanceData }, { data: concernData }] =
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
        ]);

      if (!alive) return;

      setSessions(sessionData || []);
      setAttendance(attendanceData || []);
      setConcerns(concernData || []);
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

  const liveSession = todaySessions[0] || null;

  const liveAttendance = useMemo(() => {
    if (!liveSession) return [];

    return attendance.filter((item) => item.session_id === liveSession.id);
  }, [attendance, liveSession]);

  const stats = {
    expected: liveAttendance.length,
    present: liveAttendance.filter((item) => item.status === "present").length,
    absent: liveAttendance.filter((item) => item.status === "absent").length,
    left: liveAttendance.filter((item) => item.status === "left").length,
  };

  const checkedPercent =
    stats.expected > 0 ? Math.round((stats.present / stats.expected) * 100) : 0;

  const upcoming = sessions.slice(0, 5);

  function go(tab) {
    if (typeof setTab === "function") setTab(tab);
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading today’s hub...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <section style={styles.welcome}>
        <div>
          <div style={styles.orgLabel}>{org?.name || "LaunchSession"}</div>
          <h1 style={styles.title}>Good morning, mohammed! 👋</h1>
          <p style={styles.subtitle}>
            Here’s what needs attention across today’s sessions.
          </p>
        </div>

        <div style={styles.dateCard}>
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

      <section style={styles.topGrid}>
        <div style={styles.liveCard}>
          <div style={styles.liveTop}>
            <span style={styles.liveBadge}>
              {liveSession ? "● Session Live" : "No Session Today"}
            </span>

            {liveSession?.start_time && (
              <span style={styles.timeText}>
                {liveSession.start_time}
                {liveSession.end_time ? ` – ${liveSession.end_time}` : ""}
              </span>
            )}
          </div>

          {liveSession ? (
            <>
              <h2 style={styles.sessionTitle}>{liveSession.title}</h2>
              <p style={styles.sessionMeta}>
                {liveSession.location || "No location set"}
              </p>

              <div style={styles.attendanceGrid}>
                <Metric label="Checked In" value={stats.present} colour="#22c55e" />
                <Metric label="Expected" value={stats.expected} colour="#facc15" />
                <Metric label="Absent" value={stats.absent} colour="#ef4444" />
                <Metric label="Left" value={stats.left} colour="#94a3b8" />
              </div>

              <div style={styles.progressWrap}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${checkedPercent}%` }} />
                </div>
                <div style={styles.progressText}>
                  {checkedPercent}% checked in · {stats.expected} total
                </div>
              </div>

              <button style={styles.primaryButton} onClick={() => go("registers")}>
                Open Register →
              </button>
            </>
          ) : (
            <div style={styles.emptyLive}>
              <div style={{ fontSize: 34 }}>🌤️</div>
              <h2 style={styles.sessionTitle}>Nothing scheduled right now</h2>
              <p style={styles.sessionMeta}>
                Use Calendar or Sessions to plan upcoming activities.
              </p>
              <button style={styles.primaryButton} onClick={() => go("calendar")}>
                Open Calendar →
              </button>
            </div>
          )}
        </div>

        <div style={styles.attentionCard}>
          <h3 style={styles.cardTitle}>Attention Centre</h3>

          <AttentionRow
            icon="📝"
            label="Registers"
            value={stats.expected > stats.present ? `${stats.expected - stats.present} waiting` : "All clear"}
            tone={stats.expected > stats.present ? "amber" : "green"}
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

      <section style={styles.quickGrid}>
        <QuickCard icon="📋" title="Take Register" text="Sign children in quickly" onClick={() => go("registers")} />
        <QuickCard icon="📅" title="Calendar" text="View sessions and events" onClick={() => go("calendar")} />
        <QuickCard icon="❤️" title="Volunteers" text="Manage your team" onClick={() => go("volunteers")} />
        <QuickCard icon="🤝" title="Mentoring" text="Track mentoring work" onClick={() => go("mentoring")} />
      </section>

      <section style={styles.bottomGrid}>
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
    </div>
  );
}

function Metric({ label, value, colour }) {
  return (
    <div style={styles.metric}>
      <div style={{ ...styles.metricValue, color: colour }}>{value}</div>
      <div style={styles.metricLabel}>{label}</div>
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
};
