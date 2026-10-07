# Prisma portfolio captures

`capture-app.js` captures the existing Prisma application with Electron's
`BrowserWindow.webContents.capturePage()`. It does not edit application files.

Run from the repository root with the installed Electron binary:

```powershell
$captureProcess = Start-Process -FilePath "$PWD/node_modules/electron/dist/electron.exe" -ArgumentList "website/tools/capture-app.js" -WorkingDirectory $PWD -WindowStyle Hidden -PassThru
```

The harness creates an isolated profile in `test-output`, denies screen,
camera, and microphone capture, supplies an empty source inventory, and keeps
the application idle. It never creates a mobile connection, recording, or
transcription. The transcription view uses the real integrated Whisper engine
status. A public demonstration script is entered into the real teleprompter.

`studio-demo.png` shows the application's actual renderer previewing a generated
public canvas presentation clearly labelled **DEMOSTRACIÓN**. It has no camera
or microphone stream and is not recording. `studio.png` preserves the empty
studio view.

The studio captures are 1360 × 900 pixels. Widget and teleprompter captures use
their native window sizes. `assets/screenshots/manifest.json` records provenance,
descriptions, and dimensions. All ten screenshots were visually inspected.

The local harness uses software rendering and disables Chromium's child-process
sandbox to operate under the workspace runner. It loads only the local app
files; these switches do not change Prisma's regular startup or its code.

Exclude this tools directory from the public static deployment.
