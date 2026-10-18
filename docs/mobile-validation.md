# Initial controls validation

## Verified during development

- Normal signed native Debug build and launch on a Lumen-owned iOS 27 simulator; no Apple account needed for the simulator.
- Certificate enrollment, ordinary-light pairing, SecureStore save/read, room power, slider commit and scene recall against a disposable local HTTPS Hue fixture.
- Replacing the fixture's certificate caused native pin rejection and a visible error; commands were not sent to the changed identity. Restoring the approved leaf allowed retry.
- An external fixture light change appeared immediately through Hue SSE. Background/foreground exercised reconnect and authoritative reads in the simulator.
- Simulator screenshots and a control-interaction video are private, outside git. They show synthetic fixture resources, not household light response or physical TV tuning.
- Node protocol/reconciliation/coordination tests, Python restoration/policy/config/auth tests, Swift trust/parser tests, lint, TypeScript, formatting, secret scan, React Doctor against `origin/main`, and iOS JavaScript export passed locally. The PR records checks for its final commit.
- Read-only checks on the real TV confirmed Python 2 syntax compatibility of the candidate files, TLS 1.2/SSLContext availability, and authenticated JSON TCP access to the full HyperHDR configuration. The accepted 150 ms / 50 Hz baseline was unchanged.

## Still required

Physical iPhone dev-client signing/install and LAN validation are in progress at Shawn's request. Real bridge button pairing, Local Network denial/regrant, Keychain persistence, certificate handling, external Hue/Stream Deck changes and background/foreground must be exercised on that phone before claiming support. The new TV helper is not deployed yet; test its persistent overrides, restoration/handoff, engine recovery and actual tuning in an idle viewing window after preserving private rollback material. Final cold boot, AirPlay playback, HDR and extended reliability remain pending.
