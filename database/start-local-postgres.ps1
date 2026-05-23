$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dataDir = Join-Path $root "backend\.postgres-data"
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$initDb = Join-Path $pgBin "initdb.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$psql = Join-Path $pgBin "psql.exe"

if (!(Test-Path $pgCtl)) {
  throw "PostgreSQL 17 nao foi encontrado em $pgBin."
}

if (!(Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  & $initDb -D $dataDir -U postgres -A trust --encoding=UTF8 --locale=C
}

$statusOutput = & $pgCtl status -D $dataDir 2>&1
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDir -l (Join-Path $dataDir "postgres.log") -o "-p 5432" start
}

Start-Sleep -Seconds 2
$dbExists = & $psql -h localhost -p 5432 -U postgres -d postgres -tAc "select 1 from pg_database where datname = 'techfinances'"
if ($dbExists.Trim() -ne "1") {
  & $createdb -h localhost -p 5432 -U postgres techfinances
}

Write-Output "PostgreSQL local pronto em localhost:5432, database techfinances."
