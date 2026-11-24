#!/usr/bin/env pwsh
$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$PluginDest = Join-Path $HomeDir ".gemini\config\plugins\gstack-swarm"
$GstackDest = Join-Path $HomeDir ".gemini\gstack"
$NpmPrefix = (npm config get prefix).Trim()

if (Test-Path $PluginDest) { Remove-Item -Recurse -Force $PluginDest; Write-Host "Removed $PluginDest" }
if (Test-Path $GstackDest) { Remove-Item -Recurse -Force $GstackDest; Write-Host "Removed $GstackDest" }
foreach ($f in @("gstack.ps1", "gstack.cmd")) {
  $p = Join-Path $NpmPrefix $f
  if (Test-Path $p) { Remove-Item -Force $p; Write-Host "Removed $p" }
}
Write-Host "Uninstalled Antigravity GStack Swarm cleanly." -ForegroundColor Green
