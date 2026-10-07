$ErrorActionPreference = 'Stop'
$prismaWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$prismaPython = Join-Path $PSScriptRoot 'python'
$prismaManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-manifest.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Path $prismaPython -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $prismaPython 'python.exe'))) {
  $prismaPythonZip = Join-Path $prismaWorkspace 'test-output\python-embed.zip'
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($prismaPythonZip)) -Force | Out-Null
  Invoke-WebRequest -Uri $prismaManifest.python_download -OutFile $prismaPythonZip
  if ((Get-FileHash -LiteralPath $prismaPythonZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $prismaManifest.python_sha256) { throw 'Python checksum mismatch' }
  [IO.Compression.ZipFile]::ExtractToDirectory($prismaPythonZip, $prismaPython, $true)
  Invoke-WebRequest -Uri $prismaManifest.python_sbom -OutFile (Join-Path $prismaPython 'python-3.12.10.spdx.json')
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime-manifest.json') -Destination (Join-Path $prismaPython 'runtime-manifest.json') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vendor-licenses') -Destination $prismaPython -Recurse -Force
foreach ($prismaRuntimeDll in (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'microsoft-runtime-manifest.json') -Raw | ConvertFrom-Json)) {
  $prismaVendorDll = Join-Path (Join-Path $PSScriptRoot 'vendor-runtime') $prismaRuntimeDll.filename
  if ((Get-FileHash -LiteralPath $prismaVendorDll -Algorithm SHA256).Hash.ToLowerInvariant() -ne $prismaRuntimeDll.sha256) { throw 'Microsoft runtime checksum mismatch' }
  Copy-Item -LiteralPath $prismaVendorDll -Destination (Join-Path $prismaPython $prismaRuntimeDll.filename) -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'microsoft-runtime-manifest.json') -Destination $prismaPython -Force
@('python312.zip','.','Lib/site-packages','import site') | Set-Content -LiteralPath (Join-Path $prismaPython 'python312._pth') -Encoding ascii
$prismaWheels = Join-Path $prismaWorkspace 'test-output\runtime-wheels'
New-Item -ItemType Directory -Path $prismaWheels -Force | Out-Null
$prismaManifest.wheels | ForEach-Object -Parallel {
  $prismaWheel = $_
  if ($prismaWheel.wheel -notmatch '^[a-zA-Z0-9_.+-]+\.whl$' -or $prismaWheel.download_url -notmatch '^https://files\.pythonhosted\.org/' -or $prismaWheel.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid frozen wheel manifest' }
  $prismaWheelPath = Join-Path $using:prismaWheels $prismaWheel.wheel
  if (-not (Test-Path -LiteralPath $prismaWheelPath)) { Invoke-WebRequest -Uri $prismaWheel.download_url -OutFile $prismaWheelPath }
  if ((Get-FileHash -LiteralPath $prismaWheelPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $prismaWheel.sha256) { throw ('Wheel checksum mismatch: ' + $prismaWheel.name) }
  Write-Output ('Verified ' + $prismaWheel.name)
} -ThrottleLimit 4
$prismaLib = [IO.Path]::GetFullPath((Join-Path $prismaPython 'Lib'))
$prismaBackup = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'blocked-runtime-lib'))
foreach ($prismaCheckedPath in @($prismaLib, $prismaBackup)) {
  if (-not $prismaCheckedPath.StartsWith($prismaWorkspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime path outside workspace' }
}
if (Test-Path -LiteralPath $prismaBackup) { throw 'Runtime backup already exists; inspect it before restoring again.' }
# Preserve the generated pip tree; recreating from exact wheels avoids inherited
# temporary-directory ACLs and requires no administrator permission.
if (Test-Path -LiteralPath $prismaLib) { Move-Item -LiteralPath $prismaLib -Destination $prismaBackup }
$prismaPackages = Join-Path $prismaLib 'site-packages'
New-Item -ItemType Directory -Path $prismaPackages -Force | Out-Null
foreach ($prismaWheel in $prismaManifest.wheels) {
  [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $prismaWheels $prismaWheel.wheel), $prismaPackages, $true)
}
foreach ($prismaData in (Get-ChildItem -LiteralPath $prismaPackages -Directory -Filter '*.data')) {
  foreach ($prismaKind in @('purelib','platlib')) {
    $prismaLibrary = Join-Path $prismaData.FullName $prismaKind
    if (Test-Path -LiteralPath $prismaLibrary) {
      foreach ($prismaFile in (Get-ChildItem -LiteralPath $prismaLibrary -File -Recurse)) {
        $prismaRelative = [IO.Path]::GetRelativePath($prismaLibrary, $prismaFile.FullName)
        $prismaDestination = [IO.Path]::GetFullPath((Join-Path $prismaPackages $prismaRelative))
        if (-not $prismaDestination.StartsWith($prismaPackages + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Wheel path escaped runtime' }
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($prismaDestination)) | Out-Null
        Copy-Item -LiteralPath $prismaFile.FullName -Destination $prismaDestination -Force
      }
    }
  }
}
& (Join-Path $prismaPython 'python.exe') -c 'import faster_whisper, av; from faster_whisper import WhisperModel; print("Bundled runtime imports OK")'
if ($LASTEXITCODE -ne 0) { throw 'Runtime import failed' }
