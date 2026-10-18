# Setup diagnostic archive

These are the custom scripts written during the original TV setup, preserved for their techniques and provenance. Addresses, home-directory paths, and household resource IDs are replaced with documentation placeholders. They are reference source, not turnkey production tools. Some contain old Hyperion defaults and Python2 TV imports. Do not run until adapting configuration and reading the script.

- `hue.py`: HTTPS HueV2 requests using private pairing data.
- `hyperhdr-api.cjs`, `hyperhdr-stream.cjs`, `hyperhdr-frame-rate-probe.cjs`: JSON control, logs, JPEG and LED stream measurements. HyperHDR needs npm `ws` on this Mac; Node's built-in WebSocket failed.
- `hyperion-*`, `frame-rate-probe.cjs`: earlier-engine diagnostics, retained for rollback context.
- `tvctl.py`: pre-root prisoner access; obsolete after rooting. Never reinstall Developer Mode to use it.
- `tv-color-output-test.py`: temporary Python2 localhost color test, bypassing capture.
- `direct-hue-test.py`: temporary Mac DTLS test that takes exclusive control of the entertainment area. Its old-engine restoration logic must be adapted before reuse.
- `CameraTest.swift`: explicitly authorized, video-only twelve-second webcam capture; no audio input. User-specific output path is a placeholder. This was a test tool, not a sync dependency.
- `analyze-timing.py`: approximate camera ROI analysis, requiring NumPy/Pillow and ffmpeg. Original ROIs fit the original camera position and do not measure calibrated latency.

No recordings, raw logs, bridge keys, SSH keys, LG exploit downloads, vendor binaries, or live configuration databases are included. Upstream code belongs to its original projects; links are in the docs.
