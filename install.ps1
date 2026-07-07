param(
  [int]$Threshold = 90
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$installer = Join-Path $root "scripts\install.mjs"
node $installer $Threshold
