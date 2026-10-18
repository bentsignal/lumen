# TV helper

`guard.py` preserves the deployed TV-side Python2.7-compatible helper, with repository-only changes to close configuration/state files explicitly and allow a path override: `LUMEN_TV_CONFIG_DIR` can override its configuration path for offline tests. Live copy: `/var/lib/webosbrew/hue-sync/guard.py`.

It saves/restores writable HueV2 state, subscribes to webOS power events, and reconnects PicCap if priority150 disappears. It is not a mobile control API and does not yet implement persistent Auto/On/Off or pause-until-next-power-on policies. It does not manage HyperHDR credentials.

`init/80-hue-state-guard` is the installed startup wrapper. HyperHDR and PicCap use their upstream startup hooks. Configuration examples are sanitized: fill placeholders privately; never deploy them as-is. Existing live credentials stay outside git. Changes in this repository are not automatically installed on the TV.

Recovery: preserve live files first; stop the active entertainment stream, restore the saved ordinary-light baseline, then replace only the intended app/helper files. Never restore an entire firmware image. See `docs/tv-setup.md` and `docs/operations.md`.
