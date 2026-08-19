# Jintoria dev server launcher used by the "Jintoria: 開発サーバー起動" VS Code task.
# Starts (if not already running) a local static server for src/, then waits until
# it actually responds before exiting, so the debug launch config can rely on it.
$ErrorActionPreference = 'SilentlyContinue'

$nodeDir = "C:\Program Files\nodejs"
if (Test-Path $nodeDir) { $env:Path += ";$nodeDir" }

$srcDir = Join-Path $PSScriptRoot "..\src"
$url = "http://127.0.0.1:8080/shell.html"

$listening = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Output "Starting http-server for $srcDir ..."
  Start-Process -FilePath "npx.cmd" -ArgumentList "http-server -c-1 -p 8080 ." -WorkingDirectory $srcDir -WindowStyle Minimized
} else {
  Write-Output "Port 8080 already in use, assuming dev server is already running."
}

for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 | Out-Null
    Write-Output "Dev server is up: $url"
    exit 0
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

Write-Error "Dev server did not become ready within 30 seconds. Check that Node.js is installed at $nodeDir."
exit 1
