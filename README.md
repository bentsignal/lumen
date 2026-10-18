# Lumen

A local-first iOS app for Hue lights and TV-native video syncing. React Native + Expo, using native UI components. The working TV setup is already installed; the mobile app currently has its native scaffold and development checks. Pairing and usable lighting/sync controls are the next milestone.

## Development

Node24, pnpm10.32.1, Python3. Install with `pnpm install --frozen-lockfile`.

- `pnpm check`: lint, types, TV-helper regression tests, formatting, secret hygiene.
- `pnpm bundle:ios`: validate the iOS JavaScript bundle.
- `pnpm ios`: create/run a local iOS development build (Xcode required).
- `pnpm dev`: serve the development app on your LAN.

Start with [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [verified TV setup](docs/tv-setup.md), and [next development steps](docs/next-steps.md).

## Layout

- `apps/mobile`: Expo/React Native iOS scaffold.
- `tv`: source of our deployed state-restoration/recovery helper and sanitized configuration examples.
- `tools/archive`: custom diagnostic source from setup, anonymized and documented.
- `docs`: decisions, hardware compatibility, operating instructions, evidence, and development handoff.

No cloud backend, account system, or hosted database is planned. Hue remains authoritative for lighting. TV capture and processing continue with the app closed. Existing Hue and Stream Deck integrations remain in place, subject to Entertainment streaming's exclusive control of participating lights.

Inspired by the development practices of Vera. The iOS scene-lifecycle plugin is reused from Vera; see [attribution](docs/attribution.md). Lumen is independent of Philips Hue, LG, PicCap, HyperHDR, and Vera.
