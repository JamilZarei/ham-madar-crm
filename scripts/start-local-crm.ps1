param(
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root

function Invoke-Npm {
  & npm.cmd @args
  if ($LASTEXITCODE -ne 0) { throw "npm $args failed ($LASTEXITCODE)." }
}

$worker = $null
try {
  Get-Command node.exe, npm.cmd | Out-Null
  $probe = [Net.Sockets.TcpClient]::new()
  try {
    try { $probe.Connect('127.0.0.1', 3000) } catch [Net.Sockets.SocketException] {}
    if ($probe.Connected) { throw 'Port 3000 is already in use. Close the current web server before starting CRM again.' }
  } finally {
    $probe.Dispose()
  }

  $env:NODE_ENV = 'development'
  $env:CRM_FRONTEND_MODE = 'combined'
  $env:APP_ORIGIN = 'http://localhost:3000'
  $env:SMS_PROVIDER = 'mock'
  $env:WORKER_TRANSPORT = 'postgres-local'

  if (!(Test-Path -LiteralPath 'node_modules/.bin/next.cmd') -or !(Test-Path -LiteralPath 'node_modules/.bin/prisma.cmd')) {
    Write-Host 'Installing dependencies...'
    Invoke-Npm ci --include=dev
  }
  & './database/scripts/local-postgres.ps1' start -Bin $PostgresBin

  # Refuse to run migrations unless both connections target the local development database.
  $checkDatabase = @'
require("dotenv").config({ path: ["backend/.env.development.local", "database/.env.local"], quiet: true });
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  let url;
  try { url = new URL(process.env[key]); } catch {}
  if (url?.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      url.port !== "55432" || url.pathname !== "/hamsir_crm_dev") {
    console.error(key + " must target local hamsir_crm_dev on 127.0.0.1:55432.");
    process.exitCode = 1;
  }
}
'@
  $checkDatabase | & node.exe -
  if ($LASTEXITCODE -ne 0) { throw 'Local database settings do not match the launcher.' }

  Invoke-Npm run db:generate
  Invoke-Npm run db:migrate
  Invoke-Npm run db:seed '--' '--' --if-empty

  $worker = Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c npm.cmd run worker' -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $root '.local/worker.stdout.log') -RedirectStandardError (Join-Path $root '.local/worker.stderr.log')
  Write-Host 'CRM login: http://localhost:3000/login/'
  Write-Host 'Use the demo number and the code shown on the OTP screen.'
  Write-Host 'Worker logs: .local/worker.stdout.log and .local/worker.stderr.log'
  Invoke-Npm run dev '--' --hostname 127.0.0.1 --port 3000
} finally {
  if ($worker -and !$worker.HasExited) {
    & taskkill.exe /PID $worker.Id /T /F 2>$null | Out-Null
  }
}
