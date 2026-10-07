# Prisma Windows distribution

The installer bundles the recorder and a portable local transcription runtime. It does not include a Whisper model or an external FFmpeg command-line executable. Recording works immediately as WebM. A user can prepare transcription from Prisma to download the model once, then transcribe offline.

## Build

1. Run `npm ci` in the repository root.
2. Run `pwsh -File packaging/restore-runtime.ps1` to prepare the exact Windows x64 Python runtime in `packaging/python`. All wheels, the official Python archive and the included Microsoft runtime files are checked against frozen hashes. Existing runtime trees are preserved in an ignored backup. See [runtime-build-notes.md](runtime-build-notes.md) for provenance; keep the included licenses and notices.
3. Ensure `packaging/THIRD-PARTY-NOTICES.txt` exists and corresponding third-party sources are available for the public release.
4. Run `npm run dist:win` on Windows. Electron Builder creates `release/Prisma-Setup-0.1.0-Windows-x64.exe` and `release/win-unpacked/Prisma.exe`.

The NSIS installer installs for the current user, adds desktop and Start menu shortcuts, and does not request administrator rights. It preserves user data on uninstall. This build is unsigned; use an appropriate publisher certificate for a signed release.

Application files are explicitly allowlisted in `package.json`. Python and `transcribe.py` are external resources, outside the ASAR archive. The packaged app writes models and its ready marker to `.transcription` in Electron's per-user data directory, so it works independently of the launch directory and does not write into its installation directory.

## Validate

`npm run test:packaged` launches the actual unpacked executable with an isolated profile and synthetic canvas media. Its PATH contains Windows system tools only. It checks recording, zoom, pause/resume, widget, teleprompter and decoding of the saved WebM without recording a real screen or using a webcam.

`node packaging/runtime-check.cjs` generates local synthetic speech, prepares a model with the bundled Python runtime, then validates offline transcription and TXT/SRT output. Its model and results are stored in ignored `test-output/runtime-check`.

Public release assets include the installer, SHA256 checksum, third-party notices, the exact runtime manifest and source archives for bundled third-party binaries. Never upload local profiles, recordings, API tokens or Vercel's `.vercel`/`.env` files.
