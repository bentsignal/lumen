# Operations and private handoff

The public examples use 192.0.2.10 for TV and192.0.2.20 for bridge; these are documentation addresses. Live addresses, household resource IDs and recovery instructions remain in `~/.local/share/lg-hue-setup/LUMEN-HANDOFF.md` on the original Mac, outside git. Keys, backups, captured content and raw configuration stay there. Do not upload that directory, even to a private issue or CI artifact.

## Read-only checks

Use the existing private SSH config to inspect processes, init links, free space, PicCap status and HyperHDR serverinfo. Root Luna calls may need `ssh -tt`. HyperHDR HTTP/WebSocket 8090 uses its own login/token, not Hue pairing and not root SSH. Full config/log responses can contain credentials: parse locally and print only non-sensitive fields. The bridge is HTTPSV2 with an application key; Entertainment also uses a client key and application-auth resource identity.

## Editing config

Read current full config, save private backup, change only intended keys, write the full merged document, wait for device initialization, then confirm active input150, device enabled, stream ownership and physical response. Device initialization may take seconds. Do not treat an API success response or capture FPS counter alone as physical success. Save before/after evidence privately only when relevant and authorized.

For manual scene handoff, stop our output and await helper restoration BEFORE applying the scene. Stopping a bridge stream alone while a retry/recovery policy still wants sync can allow restart. Implement the desired-state policy before offering a reliable Off button.

## Startup and rollback

Keep the helper startup before the engine, and exactly one HyperHDR/Hyperion engine hook. Before live helper edits back up helper/config/init files; keep existing keys/permissions and validate Python2 compatibility. Restore only known app configuration or helper files; don't flash firmware or replace protected OS files. A repository checkout is not a replacement for the private credential/database backups.

Do not enable LG Developer Mode again after root. Firmware/root changes are outside mobile-app scope. AirPlay and cold-boot final verification remain open items; a running airplay process is not proof of functional playback.
