
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const typeConfig = {
  sports: { label: "Sport", emoji: "⚽", color: "#16a34a", bg: "#dcfce7" },
  arts: { label: "Arts", emoji: "🎨", color: "#9333ea", bg: "#f3e8ff" },
  mentoring: { label: "Mentoring", emoji: "🤝", color: "#7c3aed", bg: "#ede9fe" },
  trip: { label: "Trip", emoji: "🚌", color: "#0891b2", bg: "#cffafe" },
  workshop: { label: "Workshop", emoji: "🛠️", color: "#ea580c", bg: "#ffedd5" },
  holiday: { label: "Holiday", emoji: "🏖️", color: "#db2777", bg: "#fce7f3" },
  activity: { label: "Activity", emoji: "🏃", color: "#2563eb", bg: "#dbeafe" },
};

function getConfig(type) {
  return typeConfig[type] || typeConfig.activity;
}

function toDateKey(date) {
  return date.toISOString().split("T")[0];
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export default function Calendar({ org, session }) {
  const orgId = org?.id;

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    async function loadSessions() {
      setLoading(true);

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("org_id", orgId)
        .order("session_date", { ascending: true });

      if (!alive) return;

      if (error) {
        
        setSessions([]);
      } else {
        setSessions(data || []);
      }

      setLoading(false);
    }

    loadSessions();

    const interval = setInterval(loadSessions, 30000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [orgId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const days = useMemo(() => {
    const result = [];
    const startPad = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;

    for (let i = 0; i < startPad; i += 1) {
      result.push(null);
    }

    for (let d = 1; d <= monthEnd.getDate(); d += 1) {
      result.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
    }

    return result;
  }, [currentMonth, monthEnd, monthStart]);

  const sessionsByDate = useMemo(() => {
    const grouped = {};

    sessions.forEach((item) => {
      if (!item.session_date) return;

      const key = item.session_date;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    return grouped;
  }, [sessions]);

  const todayKey = toDateKey(new Date());

  function changeMonth(amount) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>LaunchSession Calendar</div>
          <h1 style={styles.title}>Calendar</h1>
          <p style={styles.subtitle}>
            View sessions, trips, mentoring, workshops and key organisation dates.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.secondaryButton}>Today</button>
          <button style={styles.primaryButton}>+ New Event</button>
        </div>
      </div>

      <div style={styles.calendarShell}>
        <div style={styles.calendarTop}>
          <button style={styles.monthButton} onClick={() => changeMonth(-1)}>
            ‹
          </button>

          <div style={{ textAlign: "center" }}>
            <div style={styles.monthTitle}>
              {currentMonth.toLocaleDateString("en-GB", { month: "long" })}
            </div>
            <div style={styles.monthYear}>{currentMonth.getFullYear()}</div>
          </div>

          <button style={styles.monthButton} onClick={() => changeMonth(1)}>
            ›
          </button>
        </div>

        <div style={styles.daysHeader}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} style={styles.dayName}>
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={styles.loading}>Loading calendar...</div>
        ) : (
          <div style={styles.grid}>
            {days.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} style={styles.emptyCell} />;

              const key = toDateKey(day);
              const daySessions = sessionsByDate[key] || [];
              const isToday = key === todayKey;

              return (
                <div key={key} style={{ ...styles.dayCell, ...(isToday ? styles.todayCell : {}) }}>
                  <div style={styles.dayNumber}>{day.getDate()}</div>

                  <div style={styles.eventList}>
                    {daySessions.slice(0, 3).map((item) => {
                      const cfg = getConfig(item.session_type);

                      return (
                        <button
                          key={item.id}
                          style={{
                            ...styles.eventPill,
                            background: cfg.bg,
                            color: cfg.color,
                            borderColor: `${cfg.color}33`,
                          }}
                          onClick={() => setSelectedSession(item)}
                        >
                          <span>{cfg.emoji}</span>
                          <span style={styles.eventText}>{item.title}</span>
                        </button>
                      );
                    })}

                    {daySessions.length > 3 && (
                      <div style={styles.moreEvents}>+{daySessions.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedSession && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSession(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <button style={styles.closeButton} onClick={() => setSelectedSession(null)}>
              ×
            </button>

            <div style={styles.modalIcon}>
              {getConfig(selectedSession.session_type).emoji}
            </div>

            <h2 style={styles.modalTitle}>{selectedSession.title}</h2>

            <div style={styles.detailRow}>
              <strong>Date:</strong> {selectedSession.session_date || "Not set"}
            </div>

            <div style={styles.detailRow}>
              <strong>Time:</strong>{" "}
              {selectedSession.start_time || "No start time"}
              {selectedSession.end_time ? ` - ${selectedSession.end_time}` : ""}
            </div>

            <div style={styles.detailRow}>
              <strong>Location:</strong> {selectedSession.location || "Not set"}
            </div>

            {selectedSession.description && (
              <div style={styles.description}>{selectedSession.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    background: "#f8fafc",
    minHeight: "100%",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "flex-start",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0891b2",
    marginBottom: 6,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  headerActions: {
    display: "flex",
    gap: 10,
  },
  primaryButton: {
    border: "none",
    background: "linear-gradient(135deg, #0f766e, #0891b2)",
    color: "#fff",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  calendarShell: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.06)",
  },
  calendarTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  monthButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    fontSize: 28,
    cursor: "pointer",
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: 900,
  },
  monthYear: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  daysHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: 8,
  },
  dayName: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    padding: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8,
  },
  emptyCell: {
    minHeight: 118,
  },
  dayCell: {
    minHeight: 118,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: 10,
    overflow: "hidden",
  },
  todayCell: {
    border: "2px solid #0891b2",
    background: "#ecfeff",
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 8,
  },
  eventList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  eventPill: {
    border: "1px solid",
    borderRadius: 10,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    gap: 5,
    alignItems: "center",
    width: "100%",
    textAlign: "left",
  },
  eventText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  moreEvents: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
  },
  loading: {
    padding: 40,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 800,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    position: "relative",
    boxShadow: "0 30px 80px rgba(15, 23, 42, 0.35)",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "none",
    background: "#f1f5f9",
    fontSize: 22,
    cursor: "pointer",
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    margin: "0 0 16px",
    fontSize: 24,
    fontWeight: 900,
  },
  detailRow: {
    fontSize: 14,
    marginBottom: 10,
    color: "#334155",
  },
  description: {
    marginTop: 14,
    padding: 14,
    background: "#f8fafc",
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.5,
  },
};
