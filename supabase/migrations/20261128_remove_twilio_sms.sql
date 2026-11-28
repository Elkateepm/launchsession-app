-- Twilio is not used and has been removed. These held SMS sends and opt-outs
-- for an integration that was never wired to any code; both were empty when
-- dropped (28 Nov 2026), nothing referenced them, and no foreign keys or
-- views depended on them. sms_usage_this_month() only counted sms_messages.

drop function if exists public.sms_usage_this_month(uuid);
drop table if exists public.sms_messages;
drop table if exists public.sms_opt_outs;
