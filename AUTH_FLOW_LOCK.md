# LaunchSession Auth Flow Lock

This workflow must not be changed without intentional review.

Correct user journey:

1. Landing page
2. Sign In button
3. Organisation search
4. Email/password login
5. Dashboard
6. Sign out
7. Back to landing page

Rules:
- /org-search must always clear any saved organisation.
- /login must only load after an organisation has been selected.
- Sign out must clear Supabase session and launchsession_org_slug.
- Do not default users into Solidarity Sports or any other organisation.
- Do not bypass organisation search for existing users.
