# send-volunteer-verification

Sends the double opt-in link for a volunteer application. Deployed to the live
project; the source of record is the deployed function.

Takes **only** an `application_id`. The recipient address and the token are
read server-side with the service key via `get_volunteer_verification_payload`,
never accepted from the caller — otherwise the endpoint could be asked to post
a valid confirmation token to any address, which is the exact problem
verification exists to solve.

Note for reference: `send-volunteer-registration-invite` takes both `email` and
`registration_url` from the request body, and `verify_jwt: true` is satisfied
by the public anon key, so it can be driven as a mail relay. Worth revisiting.

Resends are throttled to one per five minutes per application by
`mark_volunteer_verification_sent`. Unknown or already-verified ids return
success without sending, so the endpoint cannot be used to probe which
applications exist.
