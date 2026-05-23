$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$psql = Join-Path $pgBin "psql.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$testDatabase = "techfinances_test"

Set-Location $root
npm run db:start

$dbExists = & $psql -h localhost -p 5432 -U postgres -d postgres -tAc "select 1 from pg_database where datname = '$testDatabase'"
if (($dbExists -join "").Trim() -ne "1") {
  & $createdb -h localhost -p 5432 -U postgres $testDatabase
}

Set-Location (Join-Path $root "backend")
$env:NODE_ENV = "test"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/${testDatabase}?schema=public"
$env:JWT_SECRET = "test-secret"
$env:JWT_EXPIRES_IN = "1h"

npm exec prisma db push -- --schema prisma/schema.prisma --skip-generate
npm test
