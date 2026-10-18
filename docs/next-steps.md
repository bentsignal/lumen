# Development handoff

## Accepted scope

Build Lumen: a React Native iOS companion app that pairs locally with existing Hue Bridge and TV, supports ordinary Hue lighting and TV sync controls, and coexists with Hue/Stream Deck. No cloud backend or database service. Native UI and robust development/CI practices based on Vera. Public GitHub repository under Shawn's bentsignal account. Working files in the Mac's Dev/lumen directory. Custom TV OS work is deferred.

The first mobile feature implements trusted manual bridge entry, Hue button pairing, Keychain storage, native lights/rooms/scenes, bridge events/reconciliation, and TV controls backed by a new optional HTTPS policy helper. See [mobile controls](mobile-controls.md) for semantics and validation boundaries. The live legacy TV helper has not been auto-deployed or silently retuned. Physical iPhone signing, LAN testing and deliberate TV helper installation remain next steps before claiming household support.

## First implementation

1. Read this repo's AGENTS/docs, then inspect Vera read-only for relevant native forms/navigation/query/storage and test patterns. Never transplant its backend/auth/accounts/secrets.
2. Build device connection flow with manual host entry initially, stable identities and discovery when supported, Hue button pairing, secure credentials, TV token/auth, real connection errors and capabilities. Handle Hue certificate trust explicitly and narrowly on native iOS; no blanket TLS bypass.
3. Add actual light/room on-off/dimming and scenes. Subscribe to bridge events with initial fetch and reconnect/foreground reconciliation. Optimistic controls must handle failures. Keep ordinary lighting usable with TV offline.
4. Add actual sync status and tuning. Preserve150 ms baseline, save named presets separately, serialize full merged config writes, and add tests for config preservation. Avoid sending a full engine reconfiguration on every slider pixel; debounce/commit changes.
5. Add TV desired-state persistence and authenticated API for Auto/On/Off and pause-this-session, with one clear owner coordinating power/retry/manual handoff. Prevent the current recovery helper from overriding explicit Off. Handle startup order, alternate streamer ownership, stop/restore/scene races, unavailable bridge and TV power transitions.
6. Verify simulator native UI and physical iPhone LAN behavior. Obtain user testing before merge/release. No production EAS/Apple app/signing setup has been done for Lumen.

Later: computer app/control surface, Stream Deck action using the same TV policy endpoint, optional bounded motion-aware response, wider hardware support. Complete outstanding final cold-boot and AirPlay checks when the user is available; do not interrupt viewing unnecessarily.

## Vera reference map

Local `/Users/shawn/Dev/vera`, T3 project title vera. Reference stack Expo 57, RN 0.86, React 19.2; `apps/mobile/src/components` contains NativeHost/FieldList/ListItem/optimistic controls; `apps/mobile/src/app` navigation; `.github/workflows/ci.yml` quality/bundle checks; `scripts` contains worktree/phone/simulator workflows. Vera is active: don't change its checkout, signing identities, servers or simulator leases. Rebuild the relevant workflow for Lumen rather than importing scripts that still target Vera devices/backend paths.
