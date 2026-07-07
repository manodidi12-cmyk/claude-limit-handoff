$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root "src\claude-limit-handoff.mjs"
node $scriptPath uninstall
