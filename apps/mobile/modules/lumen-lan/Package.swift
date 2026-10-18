// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "LumenLANPolicy", platforms: [.macOS(.v13)], products: [], targets: [
  .target(name: "LANPolicy", path: "ios", exclude: ["LumenLANModule.swift", "LumenLAN.podspec"], sources: ["TrustPolicy.swift"]),
  .testTarget(name: "LANPolicyTests", dependencies: ["LANPolicy"], path: "tests")
])
