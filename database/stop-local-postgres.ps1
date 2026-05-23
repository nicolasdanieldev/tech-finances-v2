$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dataDir = Join-Path $root "backend\.postgres-data"
$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"

if (!(Test-Path $pgCtl)) {
  throw "PostgreSQL 17 nao foi encontrado."
}

if (Test-Path (Join-Path $dataDir "PG_VERSION")) {
  & $pgCtl -D $dataDir stop
}

Write-Output "PostgreSQL local parado."
