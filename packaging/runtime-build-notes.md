# Prisma portable transcription runtime

Target: Windows x64, CPython 3.12.10. No transcription model is included. The application downloads its model once when the user chooses to prepare transcription.

## Python origin and verification

- Official release page: https://www.python.org/downloads/release/python-31210/
- Official embeddable archive: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip
- SHA256: `4acbed6dd1c744b0376e3b1cf57ce906f9dc9e95e68824584c8099a63025a3c3`
- Official SHA256 source/SBOM: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip.spdx.json

The archive was downloaded from python.org, checked against its published SHA256, then extracted into `packaging/python`. The original Python license and a local copy of the SBOM are retained there.

The `python312._pth` file contains:

```text
python312.zip
.
Lib/site-packages
import site
```

This uses relative paths and works independently of the Python installation used to prepare the bundle. No virtual environment or Codex runtime was copied.

## Dependencies

The entry dependencies are `faster-whisper==1.2.1` and `av==15.1.0`. Their resolved Windows wheels, exact versions, SHA256 hashes, PyPI download URLs, source archives and license metadata are recorded in `python/runtime-manifest.json`. Every wheel was checked against its matching SHA256 in the versioned PyPI JSON metadata before completion.

Build with any existing CPython 3.12 and pip:

```powershell
& $prismaBuilderPython -m pip download --disable-pip-version-check --no-cache-dir --dest $prismaWheels --platform win_amd64 --python-version 3.12 --implementation cp --abi cp312 --only-binary=:all: --index-url https://pypi.org/simple faster-whisper==1.2.1 av==15.1.0
& $prismaBuilderPython -m pip install --disable-pip-version-check --no-index --find-links $prismaWheels --target $prismaSitePackages --platform win_amd64 --python-version 3.12 --implementation cp --abi cp312 --only-binary=:all: --no-compile faster-whisper==1.2.1 av==15.1.0
```

For reproducible rebuilds, use `restore-runtime.ps1` and the frozen `runtime-manifest.json`/`wheel-requirements.txt`. Every dependency is pinned by its official download URL and SHA256. Pip resolves newer dependency versions if only the two entry dependencies are pinned.

The final bundle extracts exact wheels directly with inherited workspace permissions rather than moving pip's temporary installation directories. It also includes verified Microsoft MSVCP140/MSVCP140_1 redistributables; their hashes and Authenticode status are in `microsoft-runtime-manifest.json`. Original notices are retained in `vendor-runtime` and the runtime's Python license.

The wheel-installed `*.dist-info` directories, license files, notices, package data and native DLLs are retained. Build downloads are not runtime resources. No model was downloaded as part of this build.

## Electron integration

Copy `packaging/python` to `resources/transcription/python` with electron-builder `extraResources`; it must be outside ASAR. Copy `packaging/THIRD-PARTY-NOTICES.txt` to the resources directory as well. Run `resources/transcription/python/python.exe` with `resources/transcription/transcribe.py`. Model/cache/ready-marker paths must be under the application's writable `userData` directory.

The embedded Python runtime does not contain pip and does not need it at runtime. A separate system Python installation is not required.

## Validation

- `python.exe --version`: Python 3.12.10.
- Imports from this runtime: faster-whisper 1.2.1, PyAV 15.1.0, CTranslate2 4.8.2, ONNX Runtime 1.30.0, tokenizers 0.23.2 and NumPy 2.5.3.
- `WhisperModel` imports successfully without downloading a model.
- `sys.path` contains only this runtime, its standard-library ZIP and its `Lib/site-packages` directory.
- FFmpeg library version and runtime license/build configuration were checked directly from its bundled DLL.
- Every one of the 24 dependency wheel hashes matches the versioned PyPI metadata.

Corresponding multimedia source archives are kept in `packaging/third-party-sources`, separately from the installed runtime. The source manifest records origin, content hashes and build-recipe hash checks. The tagged PyAV build scripts and patches are preserved there, including its FFmpeg configure patch. Do not infer the licenses of x264/x265 from FFmpeg's runtime license string alone.
