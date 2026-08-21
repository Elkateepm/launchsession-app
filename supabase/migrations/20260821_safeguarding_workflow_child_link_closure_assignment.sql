-- Safeguarding workflow gaps. Three related problems, one migration.

-- 1. CONCERNS WERE NOT LINKED TO CHILDREN
--
-- child_name was free text. A child's profile could not show their concern
-- history, two spellings of the same name became two people, and the pattern
-- across incidents -- usually the thing that actually matters in safeguarding
-- -- was invisible.
--
-- child_name is KEPT, not dropped. A concern can legitimately name someone who
-- is not on the register (a sibling, a member of the public, a child who has
-- since left), and the name as written at the time is part of the record. The
-- link is an addition to it, never a replacement.
alter table public.cause_for_concern
  add column if not exists child_id uuid references public.children(id) on delete set null;

create index if not exists idx_cfc_child on public.cause_for_concern(child_id);

-- Backfill only where exactly one child in the same org matches the recorded
-- name. Anything ambiguous is left null rather than guessed: attaching a
-- safeguarding concern to the wrong child is far worse than leaving it
-- unlinked, and the name is still there to resolve by hand.
update public.cause_for_concern c
set child_id = m.child_id
from (
  select c2.id as concern_id, min(ch.id::text)::uuid as child_id
  from public.cause_for_concern c2
  join public.children ch
    on ch.org_id = c2.org_id
   and lower(trim(ch.first_name || ' ' || ch.last_name)) = lower(trim(c2.child_name))
  where c2.child_id is null and c2.child_name is not null
  group by c2.id
  having count(ch.id) = 1
) m
where c.id = m.concern_id;

-- 2. CLOSURE LEFT NO RECORD
--
-- The status picker offered both 'resolved' and 'closed', but only 'resolved'
-- stamped resolved_at. Every closed concern in this database has a null
-- resolved_at, which is why the Resolved counter reads zero while five
-- concerns sit closed. Nobody can say when a concern was closed or by whom.
--
-- Historical rows are deliberately NOT backfilled. updated_at is the closest
-- available guess and it is only a guess -- inventing a closure date on a
-- safeguarding record is worse than admitting it was never captured. The UI
-- says "date not recorded" for these.
alter table public.cause_for_concern
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null;

update public.cause_for_concern
set closed_at = resolved_at, closed_by = resolved_by
where resolved_at is not null and closed_at is null;

-- 3. NOTHING WAS EVER ASSIGNED, AND FOLLOW-UPS HAD NO DEADLINE
--
-- assigned_to existed as a column with no UI, so every concern was unowned.
-- follow_up_required was a boolean with no date, so a follow-up could sit
-- forever without ever becoming overdue -- which is why "Needs attention"
-- could only ever say there was nothing to do.
alter table public.cause_for_concern
  add column if not exists follow_up_due date;

-- 4. DSL NOTIFICATION WAS NOT EVIDENCE
--
-- dsl_notified_time was free text: unsortable, unverifiable, and exactly the
-- field an inspection asks about. The text column stays for what was already
-- typed into it; new records stamp a real timestamp.
alter table public.cause_for_concern
  add column if not exists dsl_notified_at timestamptz,
  add column if not exists dsl_notified_by uuid references auth.users(id) on delete set null;

comment on column public.cause_for_concern.child_name is
  'The name as recorded by the reporter. Kept even when child_id is set: the concern may name someone not on the register, and the original wording is part of the record.';
comment on column public.cause_for_concern.dsl_notified_time is
  'Legacy free-text time. Superseded by dsl_notified_at; retained so existing entries are not lost.';
