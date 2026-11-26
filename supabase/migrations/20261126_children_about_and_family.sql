-- About a young person, and who they live with.
--
-- The Add young person form asks the questions funders and safeguarding leads
-- ask for: gender, ethnicity, first language, faith, home postcode, year
-- group, disability, free school meals, young carer, looked-after. Every one
-- is optional and every choice list has a "prefer not to say" answer.
--
-- family_id ties siblings added together in one go. It is just a shared id
-- (no table), so it inherits the children table's RLS and grants unchanged.
--
-- Nothing here changes a grant or a policy: children has table-level grants,
-- so the new columns are covered by what is already there.

alter table public.children
  add column if not exists gender text,
  add column if not exists pronouns text,
  add column if not exists ethnicity text,
  add column if not exists first_language text,
  add column if not exists religion text,
  add column if not exists address text,
  add column if not exists postcode text,
  add column if not exists year_group text,
  add column if not exists disability text,
  add column if not exists free_school_meals text,
  add column if not exists young_carer text,
  add column if not exists looked_after text,
  add column if not exists family_id uuid;

do $$
declare c text;
begin
  foreach c in array array['disability', 'free_school_meals', 'young_carer', 'looked_after'] loop
    execute format(
      'alter table public.children drop constraint if exists children_%1$s_answer;
       alter table public.children add constraint children_%1$s_answer check (%1$s is null or %1$s in (''yes'', ''no'', ''not_sure''))', c);
  end loop;
end $$;

-- Keep free text short enough that nobody pastes an essay into a field
-- that ends up in a report total.
alter table public.children drop constraint if exists children_about_lengths;
alter table public.children add constraint children_about_lengths check (
  coalesce(length(gender), 0) <= 60 and coalesce(length(pronouns), 0) <= 40
  and coalesce(length(ethnicity), 0) <= 120 and coalesce(length(first_language), 0) <= 60
  and coalesce(length(religion), 0) <= 60 and coalesce(length(address), 0) <= 300
  and coalesce(length(postcode), 0) <= 10 and coalesce(length(year_group), 0) <= 40
);

create index if not exists children_family_idx on public.children (org_id, family_id) where family_id is not null;

comment on column public.children.family_id is 'Shared by siblings (added together on the Add young person form). Not a foreign key.';
comment on column public.children.ethnicity is 'ONS 2021 category, or Prefer not to say. Optional; only reported as totals.';
