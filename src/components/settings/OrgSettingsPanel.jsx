import React, { useState } from 'react';
import { useOrgSettings } from '../hooks/useOrgSettings';

const PRESET_GROUPS = [
  { label: 'Under 7s', color: '#4F6EF7' },
  { label: 'Under 10s', color: '#10B981' },
  { label: 'Under 12s', color: '#F59E0B' },
  { label: 'Under 14s', color: '#EF4444' },
  { label: 'Under 16s', color: '#8B5CF6' },
  { label: 'Beginners', color: '#06B6D4' },
  { label: 'Intermediate', color: '#F97316' },
  { label: 'Advanced', color: '#EC4899' },
  { label: 'Team A', color: '#4F6EF7' },
  { label: 'Team B', color: '#10B981' },
];

const PRESET_LOCATIONS = [
  'Main Hall', 'Sports Hall', 'Outdoor Pitch', 'Gym', 'Swimming Pool',
  'Court 1', 'Court 2', 'Meeting Room', 'Changing Rooms', 'Car Park',
];

const COLOR_SWATCHES = [
  '#4F6EF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
];

function generateId() {
  return 'id-' + Math.random().toString(36).substr(2, 9);
}

export default function OrgSettingsPanel({ orgId }) {
  const { groups, locations, loading, saveGroups, saveLocations } = useOrgSettings(orgId);
  const [activeTab, setActiveTab] = useState('groups');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Groups state
  const [localGroups, setLocalGroups] = useState(null);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#4F6EF7');

  // Locations state
  const [localLocations, setLocalLocations] = useState(null);
  const [newLocationLabel, setNewLocationLabel] = useState('');

  const workingGroups = localGroups ?? groups;
  const workingLocations = localLocations ?? locations;

  function addGroup() {
    const label = newGroupLabel.trim();
    if (!label) return;
    const updated = [...workingGroups, { id: generateId(), label, color: newGroupColor }];
    setLocalGroups(updated);
    setNewGroupLabel('');
    setNewGroupColor('#4F6EF7');
  }

  function addPresetGroup(preset) {
    if (workingGroups.find(g => g.label === preset.label)) return;
    setLocalGroups([...workingGroups, { id: generateId(), ...preset }]);
  }

  function removeGroup(id) {
    setLocalGroups(workingGroups.filter(g => g.id !== id));
  }

  function updateGroupColor(id, color) {
    setLocalGroups(workingGroups.map(g => g.id === id ? { ...g, color } : g));
  }

  function updateGroupLabel(id, label) {
    setLocalGroups(workingGroups.map(g => g.id === id ? { ...g, label } : g));
  }

  function addLocation() {
    const label = newLocationLabel.trim();
    if (!label) return;
    const updated = [...workingLocations, { id: generateId(), label }];
    setLocalLocations(updated);
    setNewLocationLabel('');
  }

  function addPresetLocation(label) {
    if (workingLocations.find(l => l.label === label)) return;
    setLocalLocations([...workingLocations, { id: generateId(), label }]);
  }

  function removeLocation(id) {
    setLocalLocations(workingLocations.filter(l => l.id !== id));
  }

  function updateLocationLabel(id, label) {
    setLocalLocations(workingLocations.map(l => l.id === id ? { ...l, label } : l));
  }

  async function handleSave() {
    setSaving(true);
    if (localGroups) await saveGroups(localGroups);
    if (localLocations) await saveLocations(localLocations);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div style={styles.loading}>Loading settings...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Groups & Locations</h2>
        <button
          onClick={handleSave}
          disabled={saving || (!localGroups && !localLocations)}
          style={{
            ...styles.saveBtn,
            opacity: (!localGroups && !localLocations) ? 0.4 : 1,
            background: saved ? '#10B981' : '#4F6EF7',
          }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div style={styles.tabs}>
        {['groups', 'locations'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
          >
            {tab === 'groups' ? '👥 Groups' : '📍 Locations'}
          </button>
        ))}
      </div>

      {activeTab === 'groups' && (
        <div>
          <p style={styles.hint}>Define the groups participants are assigned to across your organisation.</p>

          {/* Presets */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Quick add presets</div>
            <div style={styles.presets}>
              {PRESET_GROUPS.map(p => (
                <button
                  key={p.label}
                  onClick={() => addPresetGroup(p)}
                  disabled={!!workingGroups.find(g => g.label === p.label)}
                  style={{
                    ...styles.presetChip,
                    borderColor: p.color,
                    color: p.color,
                    opacity: workingGroups.find(g => g.label === p.label) ? 0.35 : 1,
                  }}
                >
                  + {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current groups */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Your groups</div>
            {workingGroups.length === 0 && (
              <div style={styles.empty}>No groups yet — add one below or use a preset.</div>
            )}
            {workingGroups.map(group => (
              <div key={group.id} style={styles.row}>
                <div style={{ ...styles.colorDot, background: group.color }} />
                <input
                  value={group.label}
                  onChange={e => updateGroupLabel(group.id, e.target.value)}
                  style={styles.labelInput}
                />
                <div style={styles.swatches}>
                  {COLOR_SWATCHES.map(c => (
                    <button
                      key={c}
                      onClick={() => updateGroupColor(group.id, c)}
                      style={{
                        ...styles.swatch,
                        background: c,
                        outline: group.color === c ? '2px solid #fff' : 'none',
                        boxShadow: group.color === c ? `0 0 0 3px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
                <button onClick={() => removeGroup(group.id)} style={styles.removeBtn}>✕</button>
              </div>
            ))}
          </div>

          {/* Add custom */}
          <div style={styles.addRow}>
            <input
              placeholder="Custom group name..."
              value={newGroupLabel}
              onChange={e => setNewGroupLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGroup()}
              style={styles.addInput}
            />
            <div style={styles.swatches}>
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setNewGroupColor(c)}
                  style={{
                    ...styles.swatch,
                    background: c,
                    outline: newGroupColor === c ? '2px solid #fff' : 'none',
                    boxShadow: newGroupColor === c ? `0 0 0 3px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
            <button onClick={addGroup} style={styles.addBtn}>+ Add</button>
          </div>
        </div>
      )}

      {activeTab === 'locations' && (
        <div>
          <p style={styles.hint}>Define the venues and spaces your sessions take place in.</p>

          {/* Presets */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Quick add presets</div>
            <div style={styles.presets}>
              {PRESET_LOCATIONS.map(label => (
                <button
                  key={label}
                  onClick={() => addPresetLocation(label)}
                  disabled={!!workingLocations.find(l => l.label === label)}
                  style={{
                    ...styles.presetChip,
                    borderColor: '#4F6EF7',
                    color: '#4F6EF7',
                    opacity: workingLocations.find(l => l.label === label) ? 0.35 : 1,
                  }}
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          {/* Current locations */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Your locations</div>
            {workingLocations.length === 0 && (
              <div style={styles.empty}>No locations yet — add one below or use a preset.</div>
            )}
            {workingLocations.map(loc => (
              <div key={loc.id} style={styles.row}>
                <span style={styles.locationIcon}>📍</span>
                <input
                  value={loc.label}
                  onChange={e => updateLocationLabel(loc.id, e.target.value)}
                  style={styles.labelInput}
                />
                <button onClick={() => removeLocation(loc.id)} style={styles.removeBtn}>✕</button>
              </div>
            ))}
          </div>

          {/* Add custom */}
          <div style={styles.addRow}>
            <input
              placeholder="Custom location name..."
              value={newLocationLabel}
              onChange={e => setNewLocationLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLocation()}
              style={styles.addInput}
            />
            <button onClick={addLocation} style={styles.addBtn}>+ Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '24px', maxWidth: '680px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #111)' },
  saveBtn: { padding: '8px 20px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '0' },
  tab: { padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary, #6b7280)', borderBottom: '2px solid transparent', marginBottom: '-1px' },
  tabActive: { color: '#4F6EF7', borderBottomColor: '#4F6EF7' },
  hint: { fontSize: '13px', color: 'var(--text-secondary, #6b7280)', marginBottom: '20px' },
  section: { marginBottom: '24px' },
  sectionLabel: { fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary, #9ca3af)', marginBottom: '10px' },
  presets: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  presetChip: { padding: '4px 10px', borderRadius: '20px', border: '1px solid', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 500 },
  row: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border, #f3f4f6)' },
  colorDot: { width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0 },
  locationIcon: { fontSize: '16px', flexShrink: 0 },
  labelInput: { flex: 1, border: '1px solid var(--border, #e5e7eb)', borderRadius: '6px', padding: '6px 10px', fontSize: '14px', background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111)' },
  swatches: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  swatch: { width: '18px', height: '18px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0 },
  removeBtn: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '16px', padding: '0 4px', flexShrink: 0 },
  addRow: { display: 'flex', gap: '10px', alignItems: 'center', padding: '16px', background: 'var(--surface, #f9fafb)', borderRadius: '10px', flexWrap: 'wrap' },
  addInput: { flex: 1, minWidth: '160px', border: '1px solid var(--border, #e5e7eb)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111)' },
  addBtn: { padding: '8px 16px', background: '#4F6EF7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' },
  empty: { fontSize: '13px', color: 'var(--text-secondary, #9ca3af)', fontStyle: 'italic', padding: '8px 0' },
  loading: { padding: '24px', color: 'var(--text-secondary, #9ca3af)' },
};
