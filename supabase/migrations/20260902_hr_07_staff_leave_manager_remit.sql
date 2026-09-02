-- Applied as hr_07_staff_leave_manager_remit.
--
-- staff_leave was is_org_admin()-only, the same gap hr_staff had: a line
-- manager could not record their own report's absence or close off a
-- return-to-work, which is exactly the person who holds that conversation.
-- Widened to the remit-scoped pattern the rest of HR uses. The restrictive
-- module-gate policies on this table are untouched and still apply on top.
drop policy if exists "org leave access" on public.staff_leave;

drop policy if exists "hr read staff_leave" on public.staff_leave;
create policy "hr read staff_leave" on public.staff_leave for select
  using (org_id = public.get_my_org_id() and public.hr_can_view()
         and public.hr_staff_in_my_remit(staff_id));

drop policy if exists "hr write staff_leave" on public.staff_leave;
create policy "hr write staff_leave" on public.staff_leave for all
  using (org_id = public.get_my_org_id() and public.hr_can_edit()
         and public.hr_staff_in_my_remit(staff_id))
  with check (org_id = public.get_my_org_id() and public.hr_can_edit()
         and public.hr_staff_in_my_remit(staff_id));
