# Stripe setup for LaunchSession

The code is done; this is the part that has to happen in the Stripe dashboard
and in Vercel. Nothing here can be automated from the repo — the keys must be
pasted by a human.

Until these steps are finished, Billing shows the plans and the buttons return
*"Billing is not configured for the Starter plan yet"*. The trial, the countdown
and the read-only lock all work without Stripe.

Vercel project `prj_dP5obec89txYpd8w9W9L3BtItrYJ`, team
`team_BE7wS8rw38ccA4IU6fo9Zhl1`.

---

## 1. Products and prices

Currency **GBP**. Three products, two prices each. The annual price is charged
once a year — the app divides by 12 for display, which is why the yearly amount
is 12x the advertised monthly figure and not the monthly figure itself.

| Product  | Price                        | Interval | Goes in                         |
|----------|------------------------------|----------|---------------------------------|
| Starter  | £29.00                       | monthly  | `STRIPE_PRICE_STARTER_MONTHLY`  |
| Starter  | £276.00  (£23/mo)            | yearly   | `STRIPE_PRICE_STARTER_ANNUAL`   |
| Advanced | £59.00                       | monthly  | `STRIPE_PRICE_ADVANCED_MONTHLY` |
| Advanced | £564.00  (£47/mo)            | yearly   | `STRIPE_PRICE_ADVANCED_ANNUAL`  |
| Pro+     | £99.00                       | monthly  | `STRIPE_PRICE_PRO_PLUS_MONTHLY` |
| Pro+     | £948.00  (£79/mo)            | yearly   | `STRIPE_PRICE_PRO_PLUS_ANNUAL`  |

Copy each **price** ID (`price_...`, not the `prod_...` product ID).

**The variable names are the mapping.** `api/stripe-webhook.js` turns a price
back into a plan by finding which `STRIPE_PRICE_<PLAN>_<CYCLE>` variable holds
that ID — there is no second lookup table to keep in step. A price sitting in a
misnamed variable means the webhook records the subscription but refuses to
guess the plan, and logs `no STRIPE_PRICE_* variable matches price`.

`PRO_PLUS` matches the `pro_plus` row in `plan_entitlements`. Do not rename
either half without the other.

## 2. Environment variables

Add all eight in Vercel → Settings → Environment Variables, for **Production
and Preview**, as *Sensitive*:

```
STRIPE_SECRET_KEY               sk_live_... (or sk_test_... first)
STRIPE_WEBHOOK_SECRET           whsec_...   (from step 3)
STRIPE_PRICE_STARTER_MONTHLY    price_...
STRIPE_PRICE_STARTER_ANNUAL     price_...
STRIPE_PRICE_ADVANCED_MONTHLY   price_...
STRIPE_PRICE_ADVANCED_ANNUAL    price_...
STRIPE_PRICE_PRO_PLUS_MONTHLY   price_...
STRIPE_PRICE_PRO_PLUS_ANNUAL    price_...
```

Test and live mode have **different** price IDs. Switching `STRIPE_SECRET_KEY`
between modes without also swapping the six price IDs produces
`No such price` at checkout.

A redeploy is needed after adding them — Vercel only injects env vars at build.

## 3. Webhook endpoint

Stripe → Developers → Webhooks → Add endpoint.

**URL:** `https://app.launchsession.co.uk/api/stripe-webhook`

Events to send:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Then copy the endpoint's **signing secret** (`whsec_...`) into
`STRIPE_WEBHOOK_SECRET`. Without it every delivery fails signature
verification with a 400 and no organisation is ever marked as paying.

## 4. Customer portal

Stripe → Settings → Billing → Customer portal → **Save/activate**. The
"Manage Billing" button calls `billingPortal.sessions.create`, which throws
until the portal has been configured once. Enable at minimum: update payment
method, cancel subscription, invoice history.

## 5. Check it works

With test keys and card `4242 4242 4242 4242`:

1. Settings → Billing → *Choose Advanced*. Stripe Checkout opens.
2. Pay. You land back on `?section=billing&checkout=success`.
3. Within a few seconds the plan should read **Advanced** and the status
   **Active** — the screen refetches five times over ~7s waiting for the
   webhook.
4. In Supabase, the organisation row should now have `plan = 'advanced'`,
   `billing_cycle`, `stripe_price_id`, `stripe_subscription_id`,
   `current_period_end`, and `modules` replaced by Advanced's set.
5. Cancel the subscription in Stripe. The org should drop to
   `plan = 'expired'`, go read-only, and show the plan-ended wall.

If the plan never changes, check the Vercel function logs for
`stripe-webhook:` lines — every failure path logs one.

## Not done yet

- **Child limits are displayed, not enforced.** `plan_entitlements.child_limit`
  says 100 for Starter and the Billing screen shows it, but nothing blocks the
  101st child. Enforcing it needs a decision about what happens to an
  organisation that is already over the limit when it downgrades.
- **No trial reminder emails.** The countdown is in the app only; nothing emails
  an organisation on day 11 or day 14.
- **Medical Alerts is included in Starter** even though the marketing page does
  not list it. Withholding medical alerts from a paying youth organisation
  looked indefensible — change the `starter` row in `plan_entitlements` if you
  disagree.
