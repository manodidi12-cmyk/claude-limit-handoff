$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$uninstaller = Join-Path $root "scripts\uninstall.mjs"
node $uninstaller
