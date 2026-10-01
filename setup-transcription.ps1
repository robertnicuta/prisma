param([string]$PythonPath)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$engineRoot = Join-Path $taskRoot '.transcription'
if (-not $PythonPath) {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCommand -and $pythonCommand.Source -notlike '*WindowsApps*') { $PythonPath = $pythonCommand.Source }
  if (-not $PythonPath) {
    $runtimePython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $runtimePython) { $PythonPath = $runtimePython }
  }
}
if (-not $PythonPath -or -not (Test-Path -LiteralPath $PythonPath)) { throw 'No se encontró Python. Instala Python 3.12 o pasa -PythonPath con la ruta de python.exe.' }
New-Item -ItemType Directory -Path $engineRoot -Force | Out-Null
$enginePython = Join-Path $engineRoot 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $enginePython)) {
  & $PythonPath -m venv $engineRoot
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno de transcripción.' }
}
& $enginePython -m pip install --disable-pip-version-check --no-cache-dir 'faster-whisper==1.2.1' 'av==15.1.0'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar faster-whisper.' }
& $enginePython (Join-Path $taskRoot 'transcribe.py') --models (Join-Path $engineRoot 'models') --prepare
if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar el modelo de transcripción.' }
Set-Content -LiteralPath (Join-Path $engineRoot 'ready') -Value 'base' -Encoding ascii
Write-Output 'Transcripción local lista.'
