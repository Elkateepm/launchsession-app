# Native shell (Capacitor)

The iOS and Android apps are the same React build running in a native WebView.
`src/` is shared — there is no second codebase, and a UI change needs no native
rebuild once the app is installed.

## Everyday workflow

Nothing about the web workflow changes. `git push` still deploys the web app via
Vercel and the native shells are unaffected.

For native work:

```bash
npm run ios:dev        # live-reload against a dev server, on device or simulator
npm run build:native   # production web build + cap sync into both shells
npm run ios            # open Xcode to build/run/archive
npm run android        # open Android Studio
```

`build:native` is the only correct way to prepare a native build. Running
`cap open ios` after editing `src/` without syncing will build the *previous*
bundle and the change will appear to have silently failed.

## What does and doesn't need an App Store release

Because the web layer is interpreted, not compiled, JS/CSS changes can ship
without review — once an over-the-air update channel is in place (see below).

Needs a new binary and review: adding a native plugin, permission or
entitlement changes, app icon, splash screen, deep link config, push
certificates, anything in `ios/` or `android/`.

## Current state and the two gaps

**Biometrics — done.** `src/lib/biometricLock.js` branches on
`isNativeShell()`. In a browser it uses WebAuthn as before; in the shell it
calls the OS biometric API directly, so the passkey chooser never appears —
just the Face ID scan. `NSFaceIDUsageDescription` is set in `Info.plist`; iOS
terminates the app on first Face ID call without it.

**Push — not done, needs a paid Apple Developer account.** The web build uses
VAPID web push through `public/service-worker.js`. Service workers do not run
in a Capacitor WebView, so native needs APNs via `@capacitor/push-notifications`
with device tokens stored alongside the existing subscriptions, and the send
path in `api/` branching on subscription type. APNs is a paid entitlement —
this cannot be started on the free tier. Until then, the shell simply receives
no push, and web push continues to work everywhere else.

**OTA updates — not done, deliberately.** Worth adding when preparing the first
submission, not before; there is no point paying for an update channel while
the only installs are development ones.

## Constraints worth knowing

- Free Apple tier: simulator is unlimited, but a build installed on a real
  device stops launching after 7 days and must be re-run from Xcode. Fine for
  development; not something to put in front of a client.
- `capacitor.config.ts` has no `server.url` on purpose. Pointing the WebView at
  the live site would make deploys instant, but Apple rejects thin URL wrappers
  under guideline 4.2 and a remote origin breaks WebAuthn. Use live-reload for
  iteration instead.
- `ios/` and `android/` are committed; their build artefacts are gitignored.
  If a diff suddenly contains hundreds of files, something regenerated that
  should have been ignored — check `.gitignore` before committing.
- Signing material (`.p12`, `.p8`, `.keystore`, `.mobileprovision`) is
  gitignored and must stay out of the repo.
