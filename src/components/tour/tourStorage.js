// Which welcome tour is waiting to be shown, if any. Kept apart from
// WelcomeTour so the dashboard can check for one without loading the tour
// itself, which is lazy.
//
// Session storage, not the database: the tour belongs to the moment someone
// finishes signing up. It survives a refresh mid-tour and is gone once they
// close it. Anyone can replay it from their profile.
const KEY = 'ls_welcome_tour'

export function startTour(role) {
  try { sessionStorage.setItem(KEY, role) } catch (e) { /* storage blocked: no tour */ }
}

export function pendingTour() {
  try { return sessionStorage.getItem(KEY) } catch (e) { return null }
}

export function clearTour() {
  try { sessionStorage.removeItem(KEY) } catch (e) { /* nothing to clear */ }
}
