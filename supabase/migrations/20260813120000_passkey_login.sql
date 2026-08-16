-- Passkey (WebAuthn) sign-in.
--
-- Two tables, both service-role only. Nothing here is readable by the
-- browser: a public key is not a secret, but the mapping of credential IDs
-- to users is an account-enumeration vector, and the challenge table is a
-- replay-protection mechanism that the client must never be able to write.

create table if not exists public.webauthn_credentials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  org_id            uuid references public.organisations(id) on delete cascade,
  credential_id     text not null unique,          -- base64url, from the authenticator
  public_key        text not null,                 -- base64url COSE key
  counter           bigint not null default 0,     -- signature counter, clone detection
  transports        text[],                        -- ['internal'], ['hybrid'], ...
  device_label      text,                          -- "iPhone", "Windows Hello"
  backed_up         boolean not null default false,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz
);

create index if not exists webauthn_credentials_user_idx
  on public.webauthn_credentials (user_id);

-- Short-lived, single-use challenges. A challenge that is never consumed
-- expires; one that is consumed is deleted, so an intercepted assertion
-- cannot be replayed.
create table if not exists public.webauthn_challenges (
  id            uuid primary key default gen_random_uuid(),
  challenge     text not null,
  kind          text not null check (kind in ('registration', 'authentication')),
  user_id       uuid references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists webauthn_challenges_expiry_idx
  on public.webauthn_challenges (expires_at);

-- RLS on, no policies: service role bypasses RLS, everyone else is denied.
-- This is deliberate. Do not add a "users can read their own credentials"
-- policy without first deciding what the client would do with them.
alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_challenges  enable row level security;

revoke all on public.webauthn_credentials from anon, authenticated;
revoke all on public.webauthn_challenges  from anon, authenticated;

-- Housekeeping: expired challenges are dead weight. Called opportunistically
-- by the API rather than scheduled, so there's no new cron to maintain.
create or replace function public.purge_expired_webauthn_challenges()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.webauthn_challenges where expires_at < now();
$$;

revoke all on function public.purge_expired_webauthn_challenges() from anon, authenticated;
