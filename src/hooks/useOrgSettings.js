import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    if (!orgId) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchSettings();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('organisations')
      .select('custom_groups, custom_locations')
      .eq('id', orgId)
      .single();

    if (!error && data) {
      if (data.custom_groups && data.custom_groups.length > 0) {
        setGroups(data.custom_groups);
      }
      if (data.custom_locations && data.custom_locations.length > 0) {
        setLocations(data.custom_locations);
      }
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
