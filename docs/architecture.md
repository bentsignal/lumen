# Architecture and product decisions

The app is Lumen. Build native-feeling React Native iOS first, with computer control possible later. Keep the existing Philips Hue app, bridge, scenes, Stream Deck controls, and TV firmware. Custom TV OS work is explicitly deferred.

## Responsibilities

Hue Bridge owns lights, rooms, scenes, capabilities, and ordinary-light state. The mobile client pairs locally, reads real resources, performs ordinary-light commands, and follows bridge V2 server-sent events. Initial fetch + incremental events + refetch on reconnect/foreground avoids a competing app database. Store app keys in SecureStore, not Expo public environment variables or a source file. UI preferences can be local; bridge state remains authoritative.

The TV runs PicCap -> local FlatBuffers -> HyperHDR -> Hue Entertainment V2. The phone controls the engine; it never transports video or streams the frame colors. Closing the phone app must not stop TV sync. When the TV is off, the app should still control ordinary lights directly through the bridge and honestly show TV sync as unavailable.

HyperHDR's local API supplies engine state, config, component control, and tuning. A small TV-side policy service may be needed for durable user overrides; extend the existing helper rather than introducing a separate always-on computer. The current helper is NOT already that service. Keep any new control endpoint authenticated and local; apps should never receive unrestricted root shell access.

## Coordination

Entertainment streaming takes exclusive control of the participating lights. Other lights remain controllable. The custom app should explicitly release our stream, await restoration, and only then apply a scene. Stream Deck can later call the same handoff action; its existing ordinary-light controls cannot be assumed to override active entertainment. One bridge supports one simultaneous entertainment stream. Never automatically reclaim a stream owned by another application.

Desired policy: Auto follows TV activity; On requests sync when a valid capture/TV is available; Off remains off through retries/restarts until changed; pause-this-session suppresses sync until the next real off/on boundary. Define Off/restore versus lights-off as separate operations. The current auto-start is verified, but these user controls are not implemented yet.

## UI and tuning

First controls: bridge/TV connections, real sync status, Auto/On/Off, pause this session, Calm/Balanced/Action presets, brightness ceiling, saturation/intensity, transition softness, and ordinary Hue scenes/lights. Native forms, menus, sliders, switches and navigation; concise labels; no instructional filler. Show genuine connection errors, pairing-needed state, and unsupported capabilities.

User approved150 ms RGB smoothing at50 Hz as a starting point.75 ms was responsive but pause-overlay dimming remained harsh. Do not assume every movie wants the same response. Adaptive tuning is future research: frame differences/brightness/cut detection plus bounded, slowly changing parameters and hysteresis. Do not call simple frame difference optical flow or promise it identifies genres. Tune manual presets first; retain user overrides.

## Networking and trust

No cloud backend or hosted database is required for local control. Discover devices by stable identities/mDNS when possible; IPs can change. Provide manual host entry as a fallback. Native iOS must request local-network permission and handle denied permission, unavailable TV, reconnects, timeouts, cancellation, foreground/background lifecycle, and bridge certificate trust. Test this on a physical phone. Existing operator diagnostics used curl -k; that is not an acceptable blanket app trust policy. No global certificate bypass or broad unrestricted ATS exception.

## Reference stack

Vera's Expo SDK 57/React Native 0.86/React 19.2, native `@expo/ui`, Expo Router, React Compiler, TanStack Query, pnpm, and quality gates are reference points. Lumen deliberately excludes Vera's decentralized messaging/backend/auth infrastructure. No signing credentials or production EAS project has been created.
