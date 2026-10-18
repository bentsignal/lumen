# TV helper

`guard.py` is the Python 2.7-compatible TV helper. `LUMEN_TV_CONFIG_DIR` overrides its configuration path for offline tests. Live path: `/var/lib/webosbrew/hue-sync/guard.py`.

It saves/restores writable Hue V2 state, subscribes to webOS power events, and reconnects PicCap if priority 150 disappears. With private `control.json`, `policy.py` adds authenticated HTTPS policy, restoration handoff and bounded manual tuning. Without that file, it retains legacy recovery behavior and exposes no control API. The existing deployed helper has not been upgraded just because this source changed.

`init/80-hue-state-guard` is the installed startup wrapper. HyperHDR and PicCap use their upstream startup hooks. Configuration examples are sanitized: fill placeholders privately; never deploy them as-is. Existing live credentials stay outside git. Changes in this repository are not automatically installed on the TV.

Recovery: preserve live files first; stop the active entertainment stream, restore the saved ordinary-light baseline, then replace only the intended app/helper files. Never restore an entire firmware image. See `docs/tv-setup.md` and `docs/operations.md`.

## Prepare and install deliberately

1. Choose an idle testing window. Privately back up the live helper, init hook, `bridge.json`, normal-state snapshot, engine DB and full engine config. Record which engine is running. Do not publish backups or raw responses.
2. On the Mac, run `python3 scripts/prepare-tv-control.py --output <new-private-directory-outside-all-checkouts> --bind <TV-Ethernet-address>`. Enter the HyperHDR admin password at the hidden prompt. This only prepares files; it does not contact or change the TV. Keep the directory mode 700 and generated files mode 600. No certificate signing account is required for this local pin.
3. Check TV Python's `ssl.SSLContext` / TLS 1.2 support before installation. The current TV was checked read-only and has OpenSSL 1.0.2p and SSLContext. Use the private SSH configuration to copy `guard.py`, `policy.py`, the generated control JSON/certificate/private key into `/var/lib/webosbrew/hue-sync`, preserving root ownership and restrictive permissions. Add the verified stable `bridge_id` and a new persistent random `device_id` to the private existing `bridge.json`; preserve every other value. Example files are not deployable credentials.
4. Before restarting the helper, disable our engine output, wait until our Entertainment stream is inactive, and finish restoration using the previous helper. Do not stop another application's stream. Stop only the existing helper process after restoration. Retain the saved baseline. With an authenticated HyperHDR connection, save a rollback snapshot and merge `general.disableLedsStartup=true` into the full current configuration. This prevents autonomous engine startup from racing policy. Do not write a partial config. Do not alter smoothing or unrelated TV settings.
5. Start the new helper through its existing init hook. Confirm startup, initial power subscription, HTTPS certificate fingerprint and authenticated `/v1/status`. Enter the generated private `phone-connection.txt` values in Lumen. Never expose port 8766 through a router or bind to a public interface. The phone needs no root SSH key or HyperHDR admin password.
6. Validate Off across engine/helper restart, pause across helper restart and real power-off/on, another-app ownership, restoration before scenes, bridge outage and tuning/recovery. Watch actual lights and preserve private evidence. Final cold-boot, AirPlay and physical iPhone validation remain required.

Rollback in the same idle window: stop/restore our stream, stop the new helper, restore the previous helper/config/init files and full engine configuration from private backups, remove only the new control endpoint files as appropriate, then use the original startup hook. Do not reset the bridge, TV firmware, AirPlay or picture/audio settings.

## API v1

Every route requires `Authorization: Bearer <private-token>` over pinned HTTPS. `GET /v1/status` returns sanitized policy/ownership/capture/tuning data. `POST /v1/policy` accepts `mode` (`auto`, `on`, `off`) and/or boolean `paused`. `POST /v1/handoff` accepts `{}`, durably pauses and returns only after restoration. `POST /v1/tuning` accepts a named `preset` or bounded `brightness`, `intensity`, `softness` values. Configuration and policy writes are serialized with the recovery loop. Failures keep the desired policy and return an error; they never claim a successful handoff. Unknown routes and fields are rejected. No command execution endpoint is provided.

The helper persists `policy.json`, restoration debt, and `config-rollback.json` privately. Do not delete these to “fix” a failure: a pending restore may be necessary to recover ordinary lighting. See [mobile controls](../docs/mobile-controls.md) for semantics and limitations.
