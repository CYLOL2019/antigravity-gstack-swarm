#!/usr/bin/env pwsh
$homeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$root = if ($env:GSTACK_ROOT) { $env:GSTACK_ROOT } else { Join-Path $homeDir ".gemini\gstack" }
& node (Join-Path $root "bin\gstack-dispatch.mjs") @args
exit $LASTEXITCODE
