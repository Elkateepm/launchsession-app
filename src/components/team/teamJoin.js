import { supabase } from '../../lib/supabase'

// Shared by the Invite someone modal and the join requests on the Team page,
// so an approved request is the exact same invite as one typed in by hand.

// Which roles each role may hand out. api/invite-volunteer enforces the same
// table server-side; this copy only decides what the screen offers.
export const INVITABLE = {
  owner: ['staff', 'manager', 'admin', 'volunteer'],
  admin: ['staff', 'manager', 'admin', 'volunteer'],
  manager: ['staff', 'volunteer'],
  staff: ['volunteer'],
}
export const ROLE_NAMES = { staff: 'Staff', manager: 'Manager', admin: 'Admin', volunteer: 'Volunteer' }

// The roles that run the team: they see the join link and decide requests.
// Matches can_manage_team() in 20261010_team_join_link.sql.
export const canManageTeam = role => ['owner', 'admin', 'manager'].includes(role)

export const joinLinkUrl = code => `${window.location.origin}/join-team/${code}`

// Returns { existingUser } or throws with the API's own message.
export async function sendTeamInvite({ org, email, name, role }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/invite-volunteer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ email, name, org_id: org.id, org_slug: org.slug, role }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return { existingUser: !!json.existing_user }
}
