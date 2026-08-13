# Design prototypes

Visual prototypes only. **Not wired into the app.**

These files sit outside `src/`, so Create React App never compiles them and they
have zero effect on the production bundle or the build.

| File | Redesigns | Status |
|---|---|---|
| `LiveRegister.preview.jsx` | `src/components/registers/LiveRegister.jsx` | Visual layer only |
| `NotificationCentre.preview.jsx` | the notifications panel inside `src/components/hub/Hub.jsx` | Visual layer only |

## What they contain

Layout, colour system, motion, and copy. Each runs standalone on hardcoded demo
data so the design can be reviewed without a Supabase session.

## What they do NOT contain

None of the real logic. The production `LiveRegister.jsx` is ~830 lines covering
Supabase queries, realtime subscriptions, `useTerms()`, payment badges, the
attendance correction modal, collection types, absence reasons, note types and
staff ratio checks. The prototype has none of it.

**Do not swap these in as drop-in replacements.** The intended path is to port
the visual layer onto the existing components, keeping every handler and query
intact.

## Design decisions worth keeping

**Live register**
- Stat chips, progress bar and tab row collapse into one segmented "attendance
  spine" that doubles as the filter.
- Session timeline in the header shows elapsed/remaining, replacing the raw
  `10:00:00–16:00:00` string.
- Default tab is On site rather than Expected, so the screen isn't empty on open.
- Status colour is consistent across spine, chips, row edge and action button.

**Notification centre**
- Bottom sheet instead of a bell-anchored dropdown. The dropdown overflows the
  viewport on phones, which clips the title, day headers and icons.
- Identical repeats collapse into one expandable card with a count badge.
- Every row carries an inline action (Finish register, Write it up, Approve).
- Filters: All / Unread / Needs action / Safeguarding.
- `env(safe-area-inset-bottom)` padding so the bottom nav stops overlapping the
  last row.

## Performance notes

No `backdrop-filter` and no `filter: blur()` — both force off-screen compositing
passes and are the main source of jank on iOS WebKit. Only `transform` and
`opacity` are animated. Ambient animation pauses when the tab is backgrounded.
Rows are memoised and use `content-visibility`.
