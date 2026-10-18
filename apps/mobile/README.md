# Lumen mobile

Expo SDK 57 / React Native 0.86 / React 19.2. The app includes local device connections, Hue pairing and lighting, bridge events, and TV policy controls. Read [mobile controls](../../docs/mobile-controls.md) and [device development](../../docs/development-devices.md) for trust, deployment and validation boundaries.

Run `pnpm install` at the root, then `pnpm ios` for a local iOS development build or `pnpm dev` for Metro. Native Expo UI and LumenLAN require Lumen's own development client. Physical builds need Shawn's personal Apple team, configured privately. No store release is authorized, and no Vera bundle IDs, provisioning profiles or credentials belong in Lumen.

Use `@expo/ui` native controls, Expo Router navigation, TanStack Query for device data, and SecureStore for keys. The SDK 57/iOS 27 scene-lifecycle plugin comes from Vera; remove only after confirming the SDK template handles scenes. LumenLAN implements per-device certificate identity/pin checks; no global certificate bypass is installed.
