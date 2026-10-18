# First mobile controls

## Connections and trust

Build the development client with `pnpm ios`; Expo Go does not contain LumenLAN. Manual connection currently accepts private IPv4 or `.local` names. No cloud discovery is used. Enter the bridge's stable 16-character Bridge ID from the official Hue app, verify the displayed SHA-256 certificate fingerprint on a trusted local device, then press the bridge button and trust/pair. Pairing creates an ordinary-light application key only; the phone does not request an Entertainment client key or stream colors.

The native ephemeral URLSession checks the exact host, port, certificate common name and approved leaf fingerprint. A credential-free probe is limited to `/api/config` and the entered Bridge ID. It cannot enroll TV trust. The probe also compares the HTTPS configuration's `bridgeid`. It does not establish manufacturer authenticity: initial fingerprint verification is the user's explicit trust step. Treat an unexpected certificate change as a reason to verify the bridge again. Redirects are refused. No system-wide trust or ATS bypass is installed. Only the paired device receives its key. TV HTTPS uses the separately provisioned `lumen-tv` certificate pin and a random bearer token.

Credentials and pins are stored together in SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Forget removes this phone's stored connections; revoking the bridge's application entry remains a Hue action. Connection failures expose an actionable error and link to iOS Settings. A transport failure does not prove Local Network permission was denied; physical permission denial and LAN behavior require iPhone validation.

## State and interaction

TanStack Query owns bridge resources and TV status. Native Hue SSE applies partial updates, replaces arrays, handles add/delete, and schedules authoritative reads. Reconnect and foreground always refetch. Backgrounding stops SSE; no phone background execution is needed for TV sync. Slow fallback polling remains active in foreground. UI drafts and pending commands are separate from authoritative resources, and failures clear drafts and refetch. Brightness/tuning writes commit at gesture end, with an explicit Apply action for accessibility adjustments. Controls disable while their request is pending. There is no per-pixel reconfiguration.

Rooms, lights and scenes use the bridge's existing IDs and capabilities. They are not recreated or renamed. Manual lighting first reads current Entertainment ownership. For affected TV lights, the app asks the authenticated TV helper to pause and finish restoration, then rechecks the bridge before writing. An unrelated active stream is never stopped. If the TV is offline and an affected stream is still active, the action fails visibly. Ordinary lights with no active stream remain usable while the TV is offline.

## TV policy service

`tv/policy.py` extends the existing guard only when private `control.json` is present. The deployed legacy helper remains unchanged until an operator installs it. Source changes do not enable a working endpoint on an existing TV. Read `tv/README.md` before installation.

The service binds HTTPS port 8766 to a configured LAN address and requires a bearer token for all endpoints. It exposes only status, policy, handoff and bounded tuning; no shell or arbitrary engine commands. It keeps engine admin authentication on the TV. HyperHDR JSON TCP on loopback 19444 supports a connection-scoped login followed by the command. A read-only check on the existing TV confirmed that path can read the full configuration; its HTTP config endpoint rejected an unauthenticated loopback request.

Auto follows active TV power and valid capture; On requests sync under the same safe prerequisites. Neither forces capture while the TV is inactive. Off persists until explicitly changed. Pause persists through helper restart and clears only after an observed off/on boundary or a different kernel boot ID. A restoration journal records whether our stream still owes ordinary-light restoration. Once a handoff succeeds, helper restart cannot restore its old snapshot over a subsequently applied scene. Other-app ownership cancels our restoration obligation and disables our engine output.

All app-originated config changes run through one controller lock. They read a complete fresh config, preserve unrelated values, save a private rollback snapshot, and write the full document. Engine startup output stays disabled so the guard owns safe enabling. Tuning stops/restores our output before device reinitialization and the guard resumes only when policy and capture permit it. This can briefly interrupt sync when applying tuning. There is no cross-client compare-and-swap in HyperHDR: avoid simultaneous config edits through its web UI.

Balanced explicitly selects 150 ms / existing 50 Hz with full brightness and saturation. Calm selects 70% brightness / 75% saturation / 300 ms; Action selects 100% / 100% / 100 ms. These are manual starting points, not measured content classifications. Nothing selects a preset automatically; merely opening the app never retunes the engine.

## Validation boundary

Tests cover partial Hue updates, pairing errors, offline TV independence, handoff ordering/ownership/restart races, persistent policy and restoration debt, full-config preservation, bounded tuning and authentication. Native Swift tests cover device-scoped pins, identities, destinations, and local host validation. Simulator and physical-device results are recorded in the PR after running them; a bundle export alone is not a native build.

Pending physical checks include new Hue button pairing and Keychain persistence, certificate rotation/rejection, Local Network denial/regrant, LAN timeouts, external Hue/Stream Deck changes, background/foreground, TV policy deployment/recovery and real light response. Cold boot, AirPlay playback, extended reliability and HDR remain unverified. mDNS discovery/address migration and finer permission diagnostics are follow-up work; changing an address currently requires reconnecting and verifying the stable bridge identity again.

Protocol references: [Hue pairing](https://developers.meethue.com/develop/get-started-2/), [Hue HTTPS guidance](https://developers.meethue.com/develop/application-design-guidance/using-https/) (developer login required), [HyperHDR 22 API source](https://github.com/awawa-dev/HyperHDR/blob/v22.0.0.0/sources/api/HyperAPI.cpp), [Apple URLSession authentication challenges](<https://developer.apple.com/documentation/foundation/urlsessiondelegate/urlsession(_:didreceive:completionhandler:)>).
