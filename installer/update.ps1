# Clearly extension updater (Windows).
# Downloads the latest extension from clearlyapp.io and replaces the files in the "extension" folder next to this script.
# Afterwards: restart Chrome, or open chrome://extensions and click the refresh icon on the Clearly extension.
# It never touches your passwords or Chrome settings, only the files in the "extension" folder.
param([switch]$Quiet, [switch]$InstallTask, [switch]$RemoveTask, [string]$Url = "https://clearlyapp.io/extension/sikumon-connector.zip")
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ext = Join-Path $root "extension"
$say = { param($m) if (-not $Quiet) { Write-Host $m } }
$taskName = "ClearlyExtensionUpdate"

if ($RemoveTask) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  & $say "Automatic daily update removed."
  return
}
if ($InstallTask) {
  $act = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $PSCommandPath + "`" -Quiet")
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  try {
    $trg = @((New-ScheduledTaskTrigger -Daily -At 12:00), (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME))
    Register-ScheduledTask -TaskName $taskName -Action $act -Trigger $trg -Settings $set -Force | Out-Null
  } catch {
    $trg = New-ScheduledTaskTrigger -Daily -At 12:00
    Register-ScheduledTask -TaskName $taskName -Action $act -Trigger $trg -Settings $set -Force | Out-Null
  }
  & $say "Automatic update is ON: it checks for a new version every day at 12:00 and when you sign in."
  & $say "After an update, restart Chrome (or click the refresh icon on the extension) to start using the new version."
  return
}

$tmp = Join-Path $env:TEMP ("clearly-update-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp "ext.zip"
  try { Invoke-WebRequest -UseBasicParsing -Uri ($Url + "?x=" + [guid]::NewGuid().ToString("N")) -OutFile $zip }
  catch { & $say "Could not download the update (no internet, or the site is busy). Your current version was not changed. Try again later."; exit 1 }
  $new = Join-Path $tmp "new"
  Expand-Archive -LiteralPath $zip -DestinationPath $new -Force
  $manifestNew = Join-Path $new "manifest.json"
  if (-not (Test-Path $manifestNew) -or -not (Test-Path (Join-Path $new "sync.js"))) { throw "The downloaded file is not a Clearly extension." }
  $newV = [version]((Get-Content $manifestNew -Raw -Encoding UTF8 | ConvertFrom-Json).version)
  $oldV = [version]"0.0.0"
  $manifestOld = Join-Path $ext "manifest.json"
  if (Test-Path $manifestOld) { $oldV = [version]((Get-Content $manifestOld -Raw -Encoding UTF8 | ConvertFrom-Json).version) }
  if ($newV -le $oldV) { & $say ("Already up to date (version " + $oldV + ")."); return }
  New-Item -ItemType Directory -Force -Path $ext | Out-Null
  Copy-Item -Path (Join-Path $new "*") -Destination $ext -Recurse -Force
  & $say ("Updated Clearly extension: " + $oldV + " -> " + $newV)
  & $say "Now restart Chrome, or open chrome://extensions and click the refresh icon on the Clearly extension."
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
