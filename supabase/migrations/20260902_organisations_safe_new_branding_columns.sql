-- Applied as organisations_safe_carries_new_branding_columns.
--
-- organisations_safe is a fixed column list, and the whole app reads the org
-- through it -- OrgContext selects from this view, not from organisations. So
-- brand_font and login_background_style never reached the client: the chosen
-- typeface silently stayed on the default and the sign-in background style
-- always fell back to 'cover'.
--
-- Found by loading the sign-in screen and seeing the typeface had not changed.
-- Nothing in the client was wrong; the data never arrived. Worth remembering
-- for any future column on organisations that the UI needs.
--
-- Built from the view's own current column order so CREATE OR REPLACE is legal
-- (it may append columns, never reorder), rather than retyping 63 names. The
-- excluded columns stay excluded: three module password hashes, which must
-- never reach a browser, and the two SMS limits.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'organisations_safe';

  execute format(
    'create or replace view public.organisations_safe as
       select %s, brand_font, login_background_style
       from public.organisations
       where status = any (array[%L, %L])',
    cols, 'active', 'trial');
end $$;
