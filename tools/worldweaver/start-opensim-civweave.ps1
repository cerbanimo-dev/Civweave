<#
Starts the two local programs needed for real Civweave -> OpenSimulator NPC
commands. Run on the SAME Windows computer as the Civweave browser.
The OpenSim region and account must first be configured normally.
No network port forwarding, production deploy, or secret persistence.
#>
param(
 [Parameter(Mandatory=$true)][string]$OpenSimBin,
 [string]$RegionId = 'civweave-region',
 [string]$RegionExport = '-',
 [ValidateRange(1024,65535)][int]$BridgePort = 8769
)
$ErrorActionPreference='Stop'
$bin=(Resolve-Path -LiteralPath $OpenSimBin).Path
$sim=Join-Path $bin 'OpenSim.exe'
if(!(Test-Path -LiteralPath $sim)){throw "OpenSim.exe was not found in: $bin"}
if(-not (Get-Command node -ErrorAction SilentlyContinue)){throw 'Node.js 22+ is required for the Civweave bridge.'}
$versions=@(& dotnet --list-runtimes 2>$null)
if(-not ($versions | Where-Object {$_ -match '^Microsoft.NETCore.App 8\.'})){
 Write-Warning '.NET 8 runtime was not detected. OpenSimulator 0.9.3 needs it.'
}
if($RegionId -notmatch '^[A-Za-z0-9_-]{2,90}$'){throw 'RegionId must be 2–90 letters, digits, underscores or hyphens.'}
if($RegionExport -ne '-' -and !(Test-Path -LiteralPath $RegionExport)){
 throw "Export file not found: $RegionExport. Use -RegionExport '-' to run live control without an OpenSim geometry export."
}
$already=Get-Process 'OpenSim' -ErrorAction SilentlyContinue
if(-not $already){
 Write-Host 'Launching OpenSimulator in its own console. Finish initial region/account prompts there.'
 Start-Process -FilePath $sim -WorkingDirectory $bin | Out-Null
}else{Write-Host 'OpenSimulator already running; not launching another instance.'}
Write-Host 'Starting local Civweave controller relay on 127.0.0.1.' -ForegroundColor Cyan
Write-Host 'Copy BROWSER token into Civweave and IN-WORLD SCRIPT token into the private OpenSim controller script.'
Write-Host 'Both tokens are temporary. Keep this window open and never forward the bridge port.' -ForegroundColor Yellow
& node (Join-Path $PSScriptRoot 'opensim-region-bridge.mjs') $RegionExport $BridgePort '--live' "--region=$RegionId"
