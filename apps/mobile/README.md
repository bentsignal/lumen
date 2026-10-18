# Lumen mobile

Expo SDK57 / React Native0.86 / React19.2, aligned with Vera. The current app is a native UI bootstrap; pairing and controls are the next milestone. Do not present its unconnected state as a discovery result.

Run `pnpm install` at the root, then `pnpm ios` for a local iOS development build or `pnpm dev` for Metro. Native Expo UI requires a development build, not an assumed Expo Go runtime. No EAS project, Apple signing identity, production bundle ID, or store release is provisioned yet. No Vera account identifiers, secrets, or hosted backend are reused.

Use `@expo/ui` native controls, Expo Router navigation, TanStack Query for device data, and SecureStore for keys. The SDK57 iOS27 scene-lifecycle plugin comes from Vera; remove only after confirming the SDK template handles scenes. The app has local-network purpose and Bonjour declarations. TLS trust for the Hue Bridge still needs an explicit native implementation; do not globally disable certificate validation.
