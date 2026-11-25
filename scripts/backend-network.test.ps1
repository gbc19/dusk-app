$ErrorActionPreference = 'Stop'
$global:duskTestenabled = $true
$global:duskTestpresent = $true
$global:duskTestaction = 'Block'
$global:duskTestaddresses = @('0.0.0.0-126.255.255.255', '128.0.0.0-255.255.255.255', '::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
function Get-NetFirewallProfile { [CmdletBinding()]param($PolicyStore) [PSCustomObject]@{ Enabled=$global:duskTestenabled } }
function Get-NetFirewallRule {
    [CmdletBinding()]param($PolicyStore,$Name)
    if ($global:duskTestpresent) { [PSCustomObject]@{ Enabled='True';Direction='Inbound';Action=$global:duskTestaction;Profile='Any' } }
}
function Get-NetFirewallPortFilter { [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject) process { [PSCustomObject]@{Protocol='TCP';LocalPort='55321-55324'} } }
function Get-NetFirewallApplicationFilter { [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject) process { [PSCustomObject]@{Program='Any'} } }
function Get-NetFirewallServiceFilter { [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject) process { [PSCustomObject]@{Service='Any'} } }
function Get-NetFirewallAddressFilter { [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject) process { [PSCustomObject]@{RemoteAddress=$global:duskTestaddresses} } }

function Assert-Check([bool]$Expected, [string]$Name) {
    $passed = $false
    try { & (Join-Path $PSScriptRoot 'check-local-backend-network.ps1') | Out-Null; $passed = $true } catch { if ($Expected) { Write-Output $_.Exception.Message } }
    if ($passed -ne $Expected) { throw "Network guard regression failed: $Name" }
    Write-Output "PASS $Name"
}
Assert-Check $true 'matching protection accepted'
$global:duskTestpresent = $false
Assert-Check $false 'missing rule rejected'
$global:duskTestpresent = $true
$global:duskTestaction = 'Allow'
Assert-Check $false 'allow rule rejected'
$global:duskTestaction = 'Block'
$global:duskTestenabled = $false
Assert-Check $false 'disabled firewall rejected'
$global:duskTestenabled = $true
$global:duskTestaddresses = @('127.0.0.1')
Assert-Check $false 'incorrect remote scope rejected'
Write-Output 'Five network guard tests passed. All firewall cmdlets were mocked. No policy changed.'
