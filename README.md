# Prisma

Screen, camera and voice recorder with a floating widget, VDO.Ninja phone camera, zoom, teleprompter and local transcription. Everything runs on your PC. Windows only.

> **License:** [PolyForm Noncommercial 1.0.0](LICENSE). You can use and modify Prisma freely. You may **not** sell it or use it commercially.

## Run

```
npm install
npm start
```

Needs `ffmpeg` in the PATH (`winget install Gyan.FFmpeg`). Without ffmpeg, a `.webm` is saved instead of `.mp4`.

`npm run shortcut` creates a Desktop shortcut. `npm test` records a few seconds and checks the mp4 (a locked screen records black).

## Features

**Source**
- Modes: screen + camera, screen only, or camera only.
- Full screen, one window, or an area you drag with the mouse.
- 720p / 1080p / 1440p at 30 or 60 fps.
- Optional background (gradient, rounded corners, shadow).

**Camera**
- Show or hide, mirror on/off.
- Shape: circle, square or 16:9. White, black or no border. Size slider.
- Drag it in the preview. Only the screen zooms, not the camera bubble.

**Audio**
- Raw mic by default (for pro mics). "Noise removal" option for normal mics.
- Optional system audio, mixed with the mic into one track.
- Mute mic with `Ctrl+Shift+M`.

**Zoom and clicks**
- Auto zoom on click (level and duration adjustable).
- Manual zoom with a hotkey, smoothly follows the cursor.
- Highlight clicks with a red circle.

**Recording**
- 3 s countdown or none. Pause, resume, discard.
- System tray icon (record / stop, show, quit).
- mp4 output (H.264 + AAC). Opens the folder when done.

The app window, the widget and the teleprompter **do not appear in the video** (Windows excludes them from capture). Videos are saved in `Videos\Prisma`.

## Floating widget

The widget stays on top of other windows. It has camera, timer, **Record / Stop**, **Pause**, **Mic**, **Camera**, **Zoom**, **Teleprompter**, **Transcription**, **Discard**, **Settings**, **Open app** and **Hide**. Drag the bar anywhere. Restore it with `Ctrl+Shift+W` or from the tray.

## Local transcription

Click **Transcription** in the widget or **Transcribe** in the app. Pick the last recording or any file. Language can be auto-detected or fixed. It saves a `.transcript.txt` and, when timestamps exist, a `.transcript.srt` next to the video.

- **Speaches (Docker)**: default engine, local server `http://127.0.0.1:8001` with `Systran/faster-whisper-small`. Only local servers are accepted (`localhost`, `127.0.0.1`, `::1`).
- **Built-in Whisper**: works without Docker. Click **Prepare transcription** once (needs Python 3.9+; downloads the model). After that it works offline. Or run `npm run setup:transcription`.

No API key is needed and no recording leaves your PC.

Extra tests: `npm run test:widget`, `npm run test:vdo`, `npm run test:design`.

## Phone camera and mic with VDO.Ninja

1. Click **Create phone link**, copy it and open it in the phone browser.
2. Allow camera and mic, pick the camera, tap **Start**. Keep the page open and the phone unlocked.
3. Wait for **Phone connected · camera ready · mic ready**.
4. Click **Record**.

You can also paste your own `https://vdo.ninja/?view=ID` link and click **Connect**. If the phone drops mid-recording, the screen keeps recording and camera/audio return when the signal comes back. Links are new each session: share them only with people who should see the stream.

OBS Virtual Camera also works (use VB-Cable for audio).

## Hotkeys (work with any app in front)

| Key | Action |
|---|---|
| `Ctrl+Shift+R` | record / stop |
| `Ctrl+Shift+P` | pause / resume |
| `Ctrl+Shift+M` | mute / unmute mic |
| `Ctrl+Shift+Z` | zoom to cursor (1x → 1.6x → 2.4x → 1x) |
| `Ctrl+Shift+X` | reset zoom |
| `Ctrl+Shift+W` | show / hide widget |
| `Ctrl+Shift+Space` | teleprompter play / pause |
| `Ctrl+Shift+↑ / ↓` | teleprompter speed |

Change them in `HOTKEYS` at the top of `main.js`.

## Files

| File | Purpose |
|---|---|
| `main.js` | windows, tray, hotkeys, click detector, area picker, ffmpeg |
| `index.html` / `app.css` | recorder UI, zoom canvas, camera bubble |
| `widget.html` | floating controls |
| `teleprompter.html` | teleprompter |
| `overlay.html` | area selection overlay |
| `speaches.js` / `transcription.js` / `transcribe.py` | local transcription |
| `brand.js` / `brand.svg` / `make-icon.js` | name and icons |
| `shortcut.ps1` / `setup-transcription.ps1` | helper scripts |
| `smoke.js`, `*-test.js` | automated tests |

## License

[PolyForm Noncommercial License 1.0.0](LICENSE). Use and modify for any noncommercial purpose. Selling the app or using it commercially is not allowed.
