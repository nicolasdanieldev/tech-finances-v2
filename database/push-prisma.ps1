$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $root "backend")
npm exec prisma db push -- --schema prisma/schema.prisma --skip-generate
