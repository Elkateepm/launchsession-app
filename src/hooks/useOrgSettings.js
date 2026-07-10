import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeTable } from '../lib/useRealtimeTable';

const DEFAULT_GROUPS = [
  { id: 'group-1', label: 'Group A', color: '#4F6EF7' },
  { id: 'group-2', label: 'Group B', color: '#10B981' },
  { id: 'group-3', label: 'Group C', color: '#F59E0B' },
];

const DEFAULT_LOCATIONS = [
  { id: 'loc-1', label: 'Main Hall' },
  { id: 'loc-2', label: 'Sports Hall' },
  { id: 'loc-3', label: 'Outdoor Pitch' },
];

export function useOrgSettings(orgId) {
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchSettings();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any change to this org's row (from any component, any tab) refreshes every consumer of this hook —
  // so adding/removing a group in Registers shows up immediately in Session Planner, the Home hero, etc.
  useRealtimeTable('organisations', fetchSettings, { filter: orgId ? `id=eq.${orgId}` : undefined, enabled: !!orgId, pollInterval: 5000 });

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('organisations')
      .select('custom_groups, custom_locations')
      .eq('id', orgId)
      .single();

    if (!error && data) {
      // Once the org has ever saved custom groups/locations, trust that value fully — including
      // an empty array (all groups removed) — rather than silently falling back to stale/default data.
      if (data.custom_groups !== null && data.custom_groups !== undefined) {
        setGroups(data.custom_groups);
      } else if (!hasLoadedOnce) {
        setGroups(DEFAULT_GROUPS);
      }
      if (data.custom_locations !== null && data.custom_locations !== undefined) {
        setLocations(data.custom_locations);
      } else if (!hasLoadedOnce) {
        setLocations(DEFAULT_LOCATIONS);
      }
      setHasLoadedOnce(true);
    }
    setLoading(false);
  }

  async function saveGroups(newGroups) {
    setGroups(newGroups);
    await supabase
      .from('organisations')
      .update({ custom_groups: newGroups })
      .eq('id', orgId);
  }

  async function saveLocations(newLocations) {
    setLocations(newLocations);
    await supabase
      .from('organisations')
      .update({ custom_locations: newLocations })
      .eq('id', orgId);
  }

  return { groups, locations, loading, saveGroups, saveLocations, refetch: fetchSettings };
}
