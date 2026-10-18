# Verified TV setup and findings

## Hardware and root

LG 70UM6970PUA, 2019 model manufactured January 2020. Firmware 05.40.97 is NOT the webOS version. Installed SDK 4.10.0, core 4.10.2-29 goldilocks2-grampians; originally a webOS 4.5-generation unit. Board K5LP_ATSC / K5LP_ATSC_KR, hardware/OTA HE_DTV_W19P_AFADATAA, rtd287o ARMv7, kernel 4.4.84-p.649.grampians.k5lp.1, about 964 MB RAM. App partition 617 MB, about 230 MB free after both engines were installed.

The exact firmware/core combination was checked against cani.rootmy.tv compatibility data, not inferred from the model year. Reviewed faultmanager-autoroot and verified its download before execution. Payload reported root uid0 and completion. Homebrew Channel 0.7.3 installed. LG Developer Mode was removed with appInstallService after successful root and BEFORE the first reboot. Do not reinstall it. Root SSH uses port 22 and a private key; the pre-root prisoner 9922 connection is obsolete. Root survived first reboot. Telnet disabled, SSH enabled, TV automatic firmware updates off. Stock webOS retained; no flash, downgrade, factory reset, or Hue bridge modification occurred. Root is not guaranteed across firmware updates/reset.

## Apps and configuration

PicCap 0.5.3, HyperHDR loader 22.0.1 / engine 22.0.0. Hyperion.NG loader 0.1.11 / engine 2.0.16 remains installed as stopped rollback, not the selected startup engine.

PicCap: libdile_vt video backend, HDMI 2 Xbox One S, 192x108, 30 fps, software pacing (`vsync=false`), quirk2 no-frame-freeze, UI capture off, `nohdr=true`, local TCP FlatBuffers 127.0.0.1:19400. Native capture reports about 29.9 fps. This is a low-resolution color-analysis feed, not a display resolution change. Native vsync on this Realtek platform returned immediately and caused a roughly 500 fps loop; software pacing fixed that load. No custom kernel modules installed.

HyperHDR local HTTP/WebSocket 8090, FlatBuffers 19400. JSON TCP 19444 is NOT its WebSocket endpoint. Node builtin WebSocket failed with1006 on HyperHDR; npm ws worked. Current RGB interpolation 150 ms, 50 Hz, continuous output. Gamma 1; no extra linearRGB conversion; startup effects disabled; eight zones; Hue Entertainment V2. Full sanitized config examples live in `tv/config`. HDR/tone-mapping behavior is not validated; the tests were SDR. Picture mode, audio and AirPlay settings were not modified. QuickStart+ was changed from on to off and original options backed up.

Configuration `/home/root/.config/HyperHDR/db/hyperhdr.db`, directory 700/database 600. Prior engine DB `/home/root/.hyperion/db/hyperion.db`. Root startup hooks `/var/lib/webosbrew/init.d/80-hue-state-guard`, `90-start_hyperhdr`, `piccapautostart`. Old 90-start_hyperiond symlink moved outside init.d to the helper folder with `.disabled` suffix. Only one engine should bind 8090/19400 at startup.

## Hue capabilities and mapping

Square second-generation Hue Bridge. Gradient TV light is LCX002 Hue Play Gradient Lightstrip: seven entertainment segments, not twenty independently addressable zones. Bottom strip named Tv stand is LCL001, one non-gradient zone. A separate LG TV Sync area was created with two fixtures/eight channels; original Hue areas remain unchanged. Bridge limits: one simultaneous stream, up to ten fixtures/twenty channels. Two fixtures/eight channels are within those limits.

Channel order: left-bottom, left-middle, top-left, top-middle, top-right, right-middle, right-bottom, then bottom average. Normalized scan rectangles are in `tv/config/hyperhdr.example.json`. Identify resources/capabilities through the bridge before applying mapping; do not use household UUIDs from another installation.

## Restoration and recovery

Our Python 2.7 helper lives in `/var/lib/webosbrew/hue-sync`. It stores private bridge.json and normal-state.json, uses a lock and root Luna power subscription, snapshots ordinary state while inactive, restores on active->inactive and power-off, and reconnects PicCap if priority 150 disappears. The TV has os.openpty but no pty module. Root Luna stdout required a pseudo-TTY; non-TTY calls sometimes looked blank even after success.

The old native Hue restoration sent read-only gradient fields and empty gradient points, causing bridge errors and asynchronous device disable during config changes. Native restoreOriginalState was disabled; the helper restores only writable on/brightness/color-temperature-or-xy and nonempty valid gradient points/mode. A restore must not stop a newly reactivated stream; the helper checks ownership/activity before restoring. Tests protect this race. Capture could report connected after engine restart while its TCP input was stale; explicit stop/start reconnects, now handled by the helper. The helper currently does not honor a persistent app-controlled Off policy.

## Performance investigation

Initial output physically changed about 1–2 times/sec, although capture, LED counters and outbound UDP indicated roughly 30 updates/sec. The user was correct; internal counters were insufficient. A temporary Logitech C920 (occasionally called C922 in conversation) recorded the TV and wall, video-only, confirming roughly one-second physical jumps. Pure-color output through the TV bypassed capture and still jumped. Mac direct DTLS output was smooth. A brief ping-traffic test did not fix it.

TV Wi-Fi was 2.4 GHz with strong signal and power-save reported off. TV->bridge ping varied about 1–450 ms, mean 107–123 ms; Mac->bridge about 1 ms. HyperHDR's 500 ms REST timeout also caused failures on Wi-Fi. Ethernet was then connected; disabling Wi-Fi removed its still-preferred local route. TV Ethernet->bridge averaged0.415 ms with no loss. HyperHDR connected and webcam/user confirmed an enormous improvement and continuous changes. Ethernet and engine changed in the overall investigation, so don't attribute every improvement to a separately isolated variable. Keep wired Ethernet for the validated setup.

No smoothing exposed visible steps/corner flashes.75 ms improved motion; user requested gentler pause-overlay dimming.150 ms was accepted as pretty good; a sitcom could still feel aggressive while Andor action looked good. This motivated manual presets and an optional future adaptive mode. Camera ROI correlation was approximate and position-dependent, not a calibrated end-to-end latency measurement.

## Validation boundary

Verified changing protected Xbox HDMI capture while Peacock played The Office; HBO/YouTube subsequently exercised output. Physical bright red/green/blue confirmed color/channel control, not frame rate. Added bottom strip was identified by bridge model and a temporary blue test. Disabling output restored both fixtures' exact writable normal state. User physically turned TV off: lights stopped then ordinary lighting returned. User turned it on: sync resumed automatically after a startup delay, without a laptop command. Logs recorded ActiveStandby restoration and Active recovery.150 ms config persisted through app restarts.

Still pending: a full cold boot with the final selected startup engine, physical AirPlay playback test, extended reliability, HDR video/tone mapping. Do not mark these passed. Native sync requires neither webcam nor running laptop. Homebrew/root and all third-party apps are upstream software; only our helper/diagnostics/configuration were custom work.

## Sources

- https://github.com/throwaway96/faultmanager-autoroot
- https://cani.rootmy.tv/
- https://webostv.developer.lge.com/develop/getting-started/developer-mode-app
- https://github.com/webosbrew/webos-homebrew-channel
- https://github.com/TBSniller/piccap
- https://github.com/webosbrew/hyperion-webos
- https://github.com/webosbrew/hyperion.ng-webos-loader
- https://github.com/webosbrew/hyperhdr-webos-loader
- https://docs.hyperion-project.org/user/leddevices/network/philipshue.html
- https://developers.meethue.com/develop/hue-api-v2/
