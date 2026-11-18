param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'start',
  [string]$Bin = 'C:\Program Files\PostgreSQL\17\bin',
  [ValidateRange(1024,65535)]
  [int]$Port = 55432
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$local = Join-Path $root '.local'
$cluster = Join-Path $local 'postgres'
$marker = Join-Path $cluster 'PG_VERSION'
$databaseEnv = Join-Path $root 'database/.env.local'
$backendEnv = Join-Path $root 'backend/.env.development.local'
$pgCtl = Join-Path $Bin 'pg_ctl.exe'

function Invoke-Pg([string]$Executable, [string[]]$Arguments) {
  & (Join-Path $Bin $Executable) @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Executable failed with code $LASTEXITCODE" }
}

if ($Action -ne 'start') {
  if (!(Test-Path -LiteralPath $marker -PathType Leaf)) { throw 'Local PostgreSQL cluster has not been initialized.' }
  $opts = @($Action, '-D', $cluster)
  if ($Action -eq 'stop') { $opts += @('-m', 'fast', '-w') }
  & $pgCtl @opts
  exit $LASTEXITCODE
}
if (!(Test-Path -LiteralPath $pgCtl -PathType Leaf)) { throw 'PostgreSQL 17 tools were not found. Set -Bin to the PostgreSQL bin directory.' }
[void][IO.Directory]::CreateDirectory($local)
$adminFile = Join-Path $local 'postgres-admin-password'
$runtimeFile = Join-Path $local 'postgres-runtime-password'
$encoding = [Text.UTF8Encoding]::new($false)
function LocalSecret([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    $value = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    [IO.File]::WriteAllText($Path, $value + [Environment]::NewLine, $encoding)
  }
  return [IO.File]::ReadAllText($Path).Trim()
}
if ((Test-Path -LiteralPath $marker) -and (!(Test-Path -LiteralPath $adminFile) -or !(Test-Path -LiteralPath $runtimeFile))) {
  throw 'Local cluster exists but its credentials are missing.'
}
$admin = LocalSecret $adminFile
$runtime = LocalSecret $runtimeFile
if (!(Test-Path -LiteralPath $marker -PathType Leaf)) {
  Invoke-Pg 'initdb.exe' @('-D', $cluster, '--username=hamsir_admin', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', ('--pwfile=' + $adminFile))
}
$null = & $pgCtl status -D $cluster 2>&1
if ($LASTEXITCODE -ne 0) {
  Invoke-Pg 'pg_ctl.exe' @('start', '-D', $cluster, '-l', (Join-Path $local 'postgres.log'), '-o', ('-h 127.0.0.1 -p ' + $Port), '-w')
}

$priorPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $admin
  $conn = @('-X', '-w', '-h', '127.0.0.1', '-p', [string]$Port, '-U', 'hamsir_admin', '-v', 'ON_ERROR_STOP=1')
  $query = "SELECT 1 FROM pg_roles WHERE rolname = 'hamsir_app'"
  $found = & (Join-Path $Bin 'psql.exe') @conn -d postgres -Atc $query
  if ($LASTEXITCODE -ne 0) { throw 'Could not authenticate to the local CRM cluster.' }
  if (!$found) {
    # The generated secret is written through stdin, so it never appears in the process arguments.
    $statement = "CREATE ROLE hamsir_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '$runtime'"
    $statement | & (Join-Path $Bin 'psql.exe') @conn -d postgres -q
    if ($LASTEXITCODE -ne 0) { throw 'Creating the runtime role failed.' }
  }
  foreach ($name in @('hamsir_crm_dev','hamsir_crm_test')) {
    $found = & (Join-Path $Bin 'psql.exe') @conn -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$name'"
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the local catalog.' }
    if (!$found) {
      Invoke-Pg 'psql.exe' ($conn + @('-d','postgres','-q','-c',"CREATE DATABASE $name"))
    }
    Invoke-Pg 'psql.exe' ($conn + @('-d',$name,'-q','-c','GRANT USAGE ON SCHEMA public TO hamsir_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hamsir_app;'))
  }
} finally {
  $env:PGPASSWORD = $priorPassword
}

if (!(Test-Path -LiteralPath $databaseEnv)) {
  $lines = @(
    ('DIRECT_URL=postgresql://hamsir_admin:' + $admin + '@127.0.0.1:' + $Port + '/hamsir_crm_dev'),
    ('TEST_DATABASE_URL=postgresql://hamsir_app:' + $runtime + '@127.0.0.1:' + $Port + '/hamsir_crm_test'),
    ('TEST_DIRECT_URL=postgresql://hamsir_admin:' + $admin + '@127.0.0.1:' + $Port + '/hamsir_crm_test')
  )
  [IO.File]::WriteAllLines($databaseEnv, $lines, $encoding)
}
if (!(Test-Path -LiteralPath $backendEnv)) {
  $otpSecret = LocalSecret (Join-Path $local 'otp-secret')
  $lines = @(
    ('DATABASE_URL=postgresql://hamsir_app:' + $runtime + '@127.0.0.1:' + $Port + '/hamsir_crm_dev'),
    ('OTP_SECRET=' + $otpSecret),
    'APP_ORIGIN=http://localhost:3000',
    'SMS_PROVIDER=mock'
  )
  [IO.File]::WriteAllLines($backendEnv, $lines, $encoding)
}
Write-Output "Isolated CRM PostgreSQL is ready on 127.0.0.1:$Port."

