# Working on Lumen

## Read first

Read `docs/architecture.md`, `docs/tv-setup.md`, `docs/operations.md`, and `docs/next-steps.md`. Record durable knowledge and decisions in repository Markdown. The user is Shawn. The requested project/app/repository name is **Lumen**. Vera is a reference project on this machine, not Lumen's backend.

## Product constraints

- React Native iOS app; native controls through `@expo/ui`, Expo Router navigation, system appearance and accessible text/controls.
- Local home-network control of the Hue Bridge and TV. No cloud server, hosted database, mandatory account, always-running phone/laptop, Pi, or webcam.
- Preserve the official Hue app, existing scenes/rooms, Stream Deck, Xbox HDMI, AirPlay, audio, and normal TV controls.
- TV sync starts automatically by default. Build explicit overrides that survive helper recovery: Auto/On/Off and pause until the next TV power-on. These policies are planned, not implemented yet.
- Add manual presets/intensity controls before adaptive motion-based tuning. Do not silently change the approved live150ms configuration.
- No explanation footers beneath self-explanatory controls. No fake connection status, fabricated measurements, or nonfunctional controls presented as finished.

## Repository and workflow

- The initial repository bootstrap is the sole direct-main exception. Subsequent work belongs in a dedicated T3 feature thread/worktree and feature branch; preserve the branch T3 assigns.
- Use PRs and review the full diff. Merge/release only after Shawn explicitly approves that PR. User authorization to create the public repository is not blanket authorization to merge later features or ship to the App Store.
- `t3.json` runs `scripts/worktree-setup.sh`; dependencies are pnpm workspaces with a committed lockfile. No Convex/backend scaffolding, Vera auth, telemetry, cloud credentials, push notifications, or payment code.
- Use native UI and React Compiler; avoid manual memoization. Device data belongs in TanStack Query, not fetch-in-effect code. Effects require a specific comment explaining an external subscription. Optimistic actions must roll back/report failures and reconcile device events.
- Keep feature-owned state separate from device-authoritative state. Do not overwrite bridge changes made through other apps. Resubscribe/refetch after reconnect or app foregrounding.

## Validation

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`, `pnpm check:secrets`, and `pnpm bundle:ios` for app/infrastructure changes. App PRs also run `pnpm react-doctor --base origin/main` (use the actual PR base for stacks). Do not suppress diagnostics simply to pass CI. Add meaningful behavior tests for protocols, error handling, ownership, state restoration, and control policy. UI changes need simulator/device screenshots; motion changes need video. Evidence stays outside git. Shut down only your own simulator after validation; don't disturb Vera's running worktrees/devices. Test real LAN, bridge trust, and background/foreground behavior on a physical iPhone before claiming support. Never claim an iOS bundle export is a native build or physical-device validation.

## TV operations

- The existing TV is rooted stock webOS. Do not replace its OS, flash/downgrade firmware, factory reset, reinstall LG Developer Mode, disable unrelated services, or change AirPlay/audio/picture settings.
- Preserve recoverable configuration before live edits. Repository changes do not auto-deploy to the TV. Do not casually restart/disrupt live sync during app development.
- `tv/guard.py` is Python2.7-compatible because that is the TV runtime. Keep dependencies to its available standard library. Root Luna output needs a pseudo-terminal; ordinary SSH commands usually do not.
- HyperHDR config writes must merge the full current configuration; never write a partial document that can reset unrelated settings. Serialize edits and keep a rollback snapshot.
- Only one Hue Entertainment stream may be active. Do not steal a stream from another app. Stop our stream and complete restoration before applying a manual scene, or a delayed restore can overwrite the user's choice.
- The current helper has recovery behavior but no persistent user-disable policy/control API. Merely disabling output in HyperHDR is not sufficient to promise Off survives power-on/restart.

## Secrets and private local knowledge

The public repo contains only sanitized examples and source. Never commit Hue app/client keys, SSH keys, real config DBs, raw bridge inventories/logs, camera frames/recordings, SSIDs, household IPs/resource IDs, signing credentials, or local private handoffs. Do not copy Vera's secrets or app/account IDs.

On the original Mac, private setup material remains at `~/.local/share/lg-hue-setup`, mode700. Read `LUMEN-HANDOFF.md` there for live connection details. This path is outside all repositories. Access secrets through local files without printing values; the mobile app must store keys in SecureStore/Keychain. Public placeholders use RFC5737 addresses. Never globally disable TLS validation in the app. Restrict any bridge trust exception to the paired device with explicit identity verification. Legacy diagnostic scripts are historical source and need configuration review before execution.
