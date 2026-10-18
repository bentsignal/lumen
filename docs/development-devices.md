# Device development

Shawn wants a reusable development client on his iPhone and a separate Lumen simulator. Prefer wireless installation and LAN Metro. Do not make a fresh feature worktree mean fresh phone trust, Apple login or USB setup. Diagnose actual discovery/signing failures first. Keep device identifiers, team IDs, certificates, profiles, keys, network addresses and build/evidence files outside git.

## Simulator

Create and use a Lumen-owned simulator; do not borrow Vera's devices or leases. The initial feature used an iOS 27 iPhone 17 Pro simulator. Expo prebuild + CocoaPods + a normal Debug `xcodebuild` produced a native app. Use ordinary ad hoc simulator signing: `CODE_SIGNING_ALLOWED=NO` compiled successfully but caused SecureStore entitlement failures at runtime. Rebuilding with standard simulator signing and reinstalling resolved Keychain access without a custom entitlement plugin or Apple account.

Start Metro on a worktree-owned port. In this environment Expo's `--localhost` bound only `::1`, while the development-client launch URL used `127.0.0.1`; that prevented bundle loading. A simulator server started with `--lan` and `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1` accepted the IPv4 launch URL. For the phone, use a real private LAN address rather than loopback. Keep the phone server independent of other projects' Metro processes.

## iPhone

Lumen's app identifier is `com.bentsignal.lumen.dev`; it needs its own native build because it includes LumenLAN. A Vera client cannot load that native module. Use Shawn's personal Apple development team with app-specific provisioning; keep the team selection and signing material in local configuration. A development client and JavaScript server are separate: JavaScript-only changes should reuse the installed compatible client, while native module/plugin/dependency changes need a new native build.

Do not equate Xcode's unavailable-device status with a USB requirement. Xcode's direct wireless debugging path and a signed ad hoc app's wireless install link are distinct workflows. The existing Vera phone workflow uses the latter and is a read-only reference; its assets, credentials, profiles and backend are not Lumen infrastructure.

Apple documents wireless initial pairing for iOS 27 and later through Device Hub → Add Device → Pair Nearby Device. Existing pairing and Developer Mode should be inspected before changing either. Check the selected Xcode version, Bonjour developer advertisements, the phone's current availability and local network reachability. A Mac firewall/VPN should be diagnosed, not disabled speculatively. Leave other worktrees' devices and services running. See [Apple's Device Hub guide](https://developer.apple.com/documentation/xcode/managing-your-simulated-and-physical-devices-in-device-hub) and [connection troubleshooting](https://developer.apple.com/documentation/technotes/tn3158-resolving-xcode-15-device-connection-issues).

Use the released Xcode toolchain. During initial development the system default still pointed to Xcode 27 beta, despite Xcode 27 release already being installed. Shawn requested its removal: after selecting the release command-line tools and quitting beta processes, the beta application was moved to Trash. The selected release is Xcode 27 build 27A266a at `/Applications/Xcode-27.app`; native trust/parser tests pass with it. Do not reintroduce a beta path in scripts or local setup.

Pair the iPhone with the Mac, independently of any app or worktree. A cached Mac-side `paired` entry was insufficient: the phone's own Paired Macs screen showed no paired computers. Opening Device Hub alone does not start nearby pairing; its Pair Nearby Device sheet must be open with the relevant device type selected, while the phone visits Settings → Developer → Paired Macs/Computers. The native desktop automation repeatedly timed out attaching to Device Hub, so Shawn is assisting with that Mac-side sheet. A temporary command-line advertiser was not visible on the phone and was stopped; it is not the adopted Mac-wide pairing workflow. No USB pairing, trust reset, VPN/firewall change or device reboot was performed.

The first feature's iPhone signing/install and wireless repair are in progress. Successful simulator fixtures are not physical LAN validation. Record the actual result when completed.
