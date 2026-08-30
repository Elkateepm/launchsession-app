-- Which sidebar entries an organisation has switched off.
--
-- Distinct from `modules`, which is what the organisation has bought or been
-- granted. This is a display preference over the top of that: a youth club on a
-- plan that includes Mentoring, which simply does not run mentoring, should be
-- able to stop the row appearing without giving up access to it. Folding the
-- two together would mean "I don't use this" and "I can't use this" wrote to
-- the same field, and turning a tab back on would look like a purchase.
--
-- Holds nav item ids from navConfig.js (`mentoring`, `gallery`, ...), not tab
-- names or module keys. The routes are untouched: a hidden tab stays reachable
-- by direct link, exactly as a module-gated one does.
--
-- Additive on a live table, and empty means nothing is hidden, so existing
-- organisations are unaffected until somebody turns something off.
--
-- Applied 2026-08-31.

alter table public.organisations
  add column if not exists hidden_nav_items text[] not null default '{}';

comment on column public.organisations.hidden_nav_items is
  'Sidebar entries this organisation has switched off in Settings > Display. Nav item ids from navConfig.js. A display preference only -- access is governed by modules and per-member module_access, and hidden tabs remain reachable by direct link.';

-- The app reads the organisation through organisations_safe, not through the
-- table. Postgres expands SELECT * when a view is created, so a column added to
-- organisations afterwards does not appear here on its own -- and a setting the
-- client can save but never read back is a feature that silently does nothing.
--
-- The column list is the previous view definition with hidden_nav_items
-- appended. Every column shipped code already reads is still present, in the
-- same order.

create or replace view public.organisations_safe as
 SELECT id, name, slug, type, logo_url, city, country, plan, status, created_at,
    contact_name, contact_email, contact_phone, brand_color, notes,
    primary_color, slogan, modules, subdomain, trial_started_at,
    trial_expires_at, size, focus, onboarding_data, branding_enabled,
    custom_groups, custom_locations, enabled_portals, onboarding_complete,
    secondary_color, dsl_name, dsl_phone, dsl_email, safeguarding_policy_url,
    safeguarding_review_freq, safeguarding_alert_prefs, stripe_customer_id,
    stripe_subscription_id, subscription_status, current_period_end,
    billing_cycle, stripe_price_id, icon_url, accent_color, background_color,
    appearance_mode, ui_density, login_background_url, welcome_message,
    email_logo_url, email_footer_text, hide_powered_by, custom_domain,
    email_sender_name, recent_colors, logo_transform, icon_transform,
    default_staff_ratio, collection_recording_required, identity_check_required,
    register_retention_months, register_deletion_grace_months,
    hidden_nav_items
   FROM organisations
  WHERE status = ANY (ARRAY['active'::text, 'trial'::text]);

-- No new policy. "Admins can update own org" already gates every write to
-- organisations on id = get_user_org_id() and is_org_admin(), so this setting
-- is admin-only in the database and not only in the UI.
