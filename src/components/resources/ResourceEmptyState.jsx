import React from 'react'

export default function ResourceEmptyState({ icon = '📦', title, description, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: '#F8FAFC', borderRadius: 16, border: '1px dashed #E2E8F0' }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 380, margin: '0 auto 18px', lineHeight: 1.6 }}>{description}</div>}
      {actionLabel && (
        <button onClick={onAction} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
