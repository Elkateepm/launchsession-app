-- Applied as branding_typeface_and_login_style.
--
-- login_background_url, welcome_message and ui_density already existed as
-- columns and were already collected by the Branding screen -- but nothing in
-- the app read any of them. An organisation paying for branding could upload a
-- sign-in background, write a welcome message and pick an interface style, and
-- all three did nothing. They are wired up in this change; no new columns were
-- needed for them.
--
-- brand_font is new. It resolves to the --font / --font-display tokens
-- index.css already uses everywhere, so choosing one changes the workspace.
--
-- login_background_style decides what to do with an uploaded image: cover the
-- screen, sit behind the starfield at low opacity, or be ignored. Both new
-- columns are CHECK-constrained rather than free text -- brand_font becomes a
-- font-family and a Google Fonts request.
alter table public.organisations
  add column if not exists brand_font text,
  add column if not exists login_background_style text not null default 'cover';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organisations_login_bg_style_chk') then
    alter table public.organisations add constraint organisations_login_bg_style_chk
      check (login_background_style in ('cover', 'muted', 'tint'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organisations_brand_font_chk') then
    alter table public.organisations add constraint organisations_brand_font_chk
      check (brand_font is null or brand_font in (
        'default', 'plus-jakarta', 'inter', 'nunito', 'source-sans', 'poppins', 'lora'));
  end if;
end $$;
