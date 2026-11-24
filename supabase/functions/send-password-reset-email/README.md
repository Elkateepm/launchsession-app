# Password reset email

Source for the shared `ssahcqeqrxawmwtjpwvh` Edge Function. Requires the existing
`RESEND_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` secrets.

## Release order

1. Deploy the app changes that accept `/reset-password#token_hash=…&type=recovery`.
   The page also accepts previously sent implicit recovery links.
2. Deploy this function with JWT verification enabled, matching the existing
   deployment. Signed-out requests use the app's existing anon JWT.
3. Using a controlled account, request a reset from Login, Settings, Team, and
   the Volunteer portal. Confirm receipt, open the email in another browser,
   press Continue, set the password, and sign in with it. Verify the old
   password fails. Reopening the consumed link should offer a new email.

New links always use `https://app.launchsession.co.uk/reset-password`, preserve
the explicit organisation and volunteer portal, and are not dependent on the
shared Supabase Site URL or a preview-origin redirect allowlist. Token hashes
stay in the URL fragment until the page removes them. Merely fetching the
email link does not consume it.

Run the delivery contract tests with:

```sh
node --test supabase/functions/send-password-reset-email/handler.test.mjs
```

No database migration or extra Vercel function is needed. This change touches
authentication; after release, merge main into `native/capacitor-shell`.

## Hardening (24 Nov 2026, deployed as v4)

The caller is usually anonymous (Login's "Forgot password" calls this with the
public anon key), so nothing about the email is taken from the request except
the address, the organisation slug and the volunteer-portal flag:

- The organisation's name, logo and colour come from its `organisations` row,
  looked up by slug, and appear only when `branding_enabled` (as on the sign-in
  page). `org_name`, `org_logo` and `org_color` in the request are ignored; the
  previously deployed version put them into the email unescaped.
- `check_rate_limit`: 5 requests per address per 15 minutes and 120 overall per
  10 minutes, checked before any link is made, the same for every address
  (HTTP 429). If the limiter is unavailable, resets still work.
