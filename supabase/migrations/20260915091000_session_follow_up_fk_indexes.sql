-- Cover every follow-up foreign key used for joins and cascades.
create index if not exists session_follow_up_actions_reflection_idx
  on public.session_follow_up_actions (reflection_id);
create index if not exists session_follow_up_actions_owner_idx
  on public.session_follow_up_actions (owner_id) where owner_id is not null;
create index if not exists session_follow_up_actions_completed_by_idx
  on public.session_follow_up_actions (completed_by) where completed_by is not null;
create index if not exists session_follow_up_actions_created_by_idx
  on public.session_follow_up_actions (created_by) where created_by is not null;

