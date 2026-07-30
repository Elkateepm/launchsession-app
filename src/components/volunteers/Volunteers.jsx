import VolunteersMain from './VolunteersMain'

export default function Volunteers({ org, session, autoOpenInvite }) {
  return <VolunteersMain org={org} session={session} autoOpenInvite={autoOpenInvite} />
}
