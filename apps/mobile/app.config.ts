import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Lumen",
  slug: "lumen",
  scheme: "lumen",
  version: "0.1.0",
  platforms: ["ios"],
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.bentsignal.lumen.dev",
    supportsTablet: true,
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Lumen connects to your Hue Bridge and TV to control your lights and video sync.",
      NSBonjourServices: ["_hue._tcp", "_hyperhdr._tcp"],
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "./plugins/with-ios-scene-lifecycle.cjs",
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};
export default config;
