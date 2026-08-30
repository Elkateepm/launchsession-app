-- Split "can browse and edit the Young People directory" from "can see a young
-- person's name at all".
--
-- Gating children reads on the 'people' module alone was wrong: half the app
-- renders a child's name. Revoking People emptied the register, the session
-- plan, safeguarding concerns and medical alerts, with no indication why --
-- the modules themselves still resolved 'edit', so the screens loaded and
-- simply had nothing in them. That is worse than a locked screen, because it
-- looks like data loss.
--
-- New meaning of 'people':
--   edit  -> browse the directory, add and edit young people
--   view  -> browse the directory, read-only
--   none  -> no directory; names still appear wherever the person already has
--            access to a module that shows them
--
-- Writes remain governed by 'people' throughout, so "cannot edit young people"
-- still holds everywhere, including the add-child shortcut inside Registers.

create or replace function public.module_can_view_people_record()
returns boolean language sql stable
set search_path to 'pg_catalog', 'public'
as $$
  -- Any module that displays a young person's name or record. Reading the
  -- child row is a prerequisite for these screens working at all, so the read
  -- follows the screen rather than the directory.
  select public.module_can_view('people')
      or public.module_can_view('registers')
      or public.module_can_view('planner')
      or public.module_can_view('safeguarding')
      or public.module_can_view('case_management')
      or public.module_can_view('medical_alerts')
      or public.module_can_view('impact_outcomes')
      or public.module_can_view('events_trips')
      or public.module_can_view('mentoring')
      or public.module_can_view('payments')
      or public.module_can_view('forms')
      or public.module_can_view('reports');
$$;

revoke execute on function public.module_can_view_people_record() from public;
grant execute on function public.module_can_view_people_record() to authenticated, service_role;

do $$
declare t text;
begin
  -- The child's own records, shown inside other modules' screens.
  foreach t in array array['children','child_consents','child_attachments']
  loop
    execute format('drop policy if exists %I on public.%I', 'module gate: people (read)', t);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated '
      || 'using (public.module_can_view_people_record())',
      'module gate: people (read)', t);
  end loop;
end $$;

-- project_participants is a membership record on a project rather than a
-- record about a child, and it is only ever reached from the Projects screen.
-- It belongs with planner, where its reads follow the screen that shows it.
do $$
declare c text;
begin
  foreach c in array array['read','insert','update','delete']
  loop
    execute format('drop policy if exists %I on public.project_participants', 'module gate: people (' || c || ')');
  end loop;
end $$;

create policy "module gate: planner (read)" on public.project_participants
  as restrictive for select to authenticated using (public.module_can_view('planner'));
create policy "module gate: planner (insert)" on public.project_participants
  as restrictive for insert to authenticated with check (public.module_can_edit('planner'));
create policy "module gate: planner (update)" on public.project_participants
  as restrictive for update to authenticated using (public.module_can_edit('planner')) with check (public.module_can_edit('planner'));
create policy "module gate: planner (delete)" on public.project_participants
  as restrictive for delete to authenticated using (public.module_can_edit('planner'));
