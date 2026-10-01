# Crea o actualiza el acceso directo de Prisma. Ejecutar: npm run shortcut
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopPath = [Environment]::GetFolderPath('Desktop')
$brandSource = Get-Content -LiteralPath (Join-Path $dir 'brand.js') -Raw -Encoding UTF8
$appName = [regex]::Match($brandSource, "name:'([^']+)'").Groups[1].Value
if (-not $appName) { throw 'No se pudo leer el nombre de la aplicación.' }
$lnk = Join-Path $desktopPath ($appName + '.lnk')
# Una ruta por contenido evita que Explorer reutilice el icono anterior en cache.
$sourceIconPath = Join-Path $dir 'icon.ico'
$iconHash = (Get-FileHash -LiteralPath $sourceIconPath -Algorithm SHA256).Hash.Substring(0, 12).ToLowerInvariant()
$shortcutIconDir = Join-Path $dir '.shortcut-icons'
New-Item -ItemType Directory -Path $shortcutIconDir -Force | Out-Null
$shortcutIconPath = Join-Path $shortcutIconDir ("prisma-$iconHash.ico")
Copy-Item -LiteralPath $sourceIconPath -Destination $shortcutIconPath -Force
$shortcutShell = New-Object -ComObject WScript.Shell
$s = $shortcutShell.CreateShortcut($lnk)
$s.TargetPath = "$dir\node_modules\electron\dist\electron.exe"
$s.Arguments = "`"$dir`""
$s.WorkingDirectory = $dir
$s.IconLocation = "$shortcutIconPath,0"
$s.Description = "$appName $([char]0x00B7) Grabador de pantalla, c$([char]0x00E1)mara y voz"
$s.Save()
$oldShortcutPath = Join-Path $desktopPath 'Loom Local.lnk'
if (Test-Path -LiteralPath $oldShortcutPath) {
  $oldShortcut = $shortcutShell.CreateShortcut($oldShortcutPath)
  if ($oldShortcut.TargetPath -eq $s.TargetPath -and $oldShortcut.WorkingDirectory -eq $dir) {
    Remove-Item -LiteralPath $oldShortcutPath
  }
}
# Actualiza solo este acceso directo, sin reiniciar Explorer ni vaciar su cache.
if (-not ('PrismaShortcutNotify' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PrismaShortcutNotify {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
}
'@
}
[PrismaShortcutNotify]::SHChangeNotify(0x00002000, 0x00002005, $lnk, [IntPtr]::Zero)
"Acceso directo creado: $lnk"
