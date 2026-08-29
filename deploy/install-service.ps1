<#
.SYNOPSIS
  Dang ky PKTSX Portal thanh Windows Service bang NSSM. Khong dung IIS.

.DESCRIPTION
  Chay voi quyen Administrator:
      powershell -ExecutionPolicy Bypass -File .\deploy\install-service.ps1

  Script se: kiem tra nssm.exe -> dung service cu neu co -> dang ky lai ->
  dat tu khoi dong cung Windows -> mo port tren firewall -> start.

.PARAMETER Port
  Cong lang nghe. Mac dinh doc tu .env, khong co thi 8080.

.PARAMETER ServiceName
  Ten Windows Service. Mac dinh PKTSXPortal.
#>
[CmdletBinding()]
param(
    [int]$Port = 0,
    [string]$ServiceName = 'PKTSXPortal'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$nssm = Join-Path $PSScriptRoot 'nssm.exe'
$logDir = Join-Path $root 'logs'
$entry = Join-Path $root 'server\server.js'

function Fail($message) {
    Write-Host "  [LOI] $message" -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '  PKTSX Portal - cai dat Windows Service' -ForegroundColor Cyan
Write-Host '  --------------------------------------'

# --- Kiem tra dieu kien ---------------------------------------------------

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Fail 'Can chay PowerShell voi quyen Administrator.'
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Fail 'Khong tim thay node.exe trong PATH.' }

if (-not (Test-Path $entry)) { Fail "Khong tim thay $entry" }

if (-not (Test-Path (Join-Path $root 'client\dist\index.html'))) {
    Fail 'Chua co ban build cua giao dien. Chay `npm run build` truoc da.'
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Fail 'Chua cai thu vien. Chay `npm install` truoc da.'
}

if (-not (Test-Path $nssm)) {
    Write-Host ''
    Fail @"
Khong tim thay $nssm

  Tai NSSM ve va dat nssm.exe vao thu muc deploy\:
    1. Mo https://nssm.cc/download
    2. Tai ban 'nssm 2.24' (hoac moi hon)
    3. Giai nen, lay file win64\nssm.exe
    4. Chep vao: $PSScriptRoot
"@
}

# --- Doc port tu .env neu khong truyen tham so ----------------------------

if ($Port -le 0) {
    $envFile = Join-Path $root '.env'
    if (Test-Path $envFile) {
        $line = Select-String -Path $envFile -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
        if ($line) { $Port = [int]$line.Matches[0].Groups[1].Value }
    }
    if ($Port -le 0) { $Port = 8080 }
}

Write-Host "  Thu muc   : $root"
Write-Host "  Node      : $node"
Write-Host "  Cong      : $Port"
Write-Host "  Service   : $ServiceName"
Write-Host ''

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# --- Go service cu neu dang ton tai --------------------------------------

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host '  Da co service cung ten, dang go de dang ky lai...' -ForegroundColor Yellow
    & $nssm stop $ServiceName | Out-Null
    Start-Sleep -Seconds 2
    & $nssm remove $ServiceName confirm | Out-Null
    Start-Sleep -Seconds 1
}

# --- Dang ky service ------------------------------------------------------

& $nssm install $ServiceName $node $entry | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'nssm install that bai.' }

& $nssm set $ServiceName AppDirectory $root | Out-Null
& $nssm set $ServiceName DisplayName 'PKTSX AI Portal' | Out-Null
& $nssm set $ServiceName Description 'Portal noi bo PKTSX (Node.js, khong dung IIS)' | Out-Null
& $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "PORT=$Port" | Out-Null

# Ghi log ra file va tu cat file khi qua 10MB, neu khong log se phinh mai.
& $nssm set $ServiceName AppStdout (Join-Path $logDir 'portal.out.log') | Out-Null
& $nssm set $ServiceName AppStderr (Join-Path $logDir 'portal.err.log') | Out-Null
& $nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $nssm set $ServiceName AppRotateBytes 10485760 | Out-Null

# Dung service thi gui Ctrl+C truoc de server.js kip dong DB tu te.
& $nssm set $ServiceName AppStopMethodConsole 5000 | Out-Null

# --- Firewall -------------------------------------------------------------

$ruleName = "$ServiceName ($Port)"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Any | Out-Null
    Write-Host "  Da mo cong $Port tren Windows Firewall." -ForegroundColor Green
}
else {
    Write-Host "  Cong $Port da co san luat firewall." -ForegroundColor DarkGray
}

# --- Khoi dong ------------------------------------------------------------

& $nssm start $ServiceName | Out-Null
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne 'Running') {
    Write-Host ''
    Write-Host "  Service dang o trang thai: $($svc.Status)" -ForegroundColor Yellow
    Write-Host "  Xem log tai: $logDir" -ForegroundColor Yellow
    exit 1
}

$hostName = $env:COMPUTERNAME
Write-Host ''
Write-Host '  Xong. Portal dang chay.' -ForegroundColor Green
Write-Host "    Trong may   : http://localhost:$Port"
Write-Host "    Trong mang  : http://$hostName`:$Port"
Write-Host "    Quan tri    : http://$hostName`:$Port/#/admin"
Write-Host "    Log         : $logDir"
Write-Host ''
Write-Host '  Lenh thuong dung:' -ForegroundColor DarkGray
Write-Host "    Restart-Service $ServiceName"
Write-Host "    Stop-Service $ServiceName"
Write-Host "    Get-Content $logDir\portal.err.log -Tail 40"
Write-Host ''
