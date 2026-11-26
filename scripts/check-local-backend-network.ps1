$ErrorActionPreference = 'Stop'
$profiles = Get-NetFirewallProfile -PolicyStore ActiveStore
if ($profiles | Where-Object { -not $_.Enabled }) {
    throw 'DUSK requires Windows Firewall enabled on every profile.'
}
$rule = Get-NetFirewallRule -PolicyStore ActiveStore -Name 'DUSK-Local-Backend-Block-Remote' -ErrorAction SilentlyContinue
if (-not $rule -or $rule.Enabled -ne 'True' -or $rule.Direction -ne 'Inbound' -or $rule.Action -ne 'Block' -or $rule.Profile -ne 'Any') {
    throw 'Run scripts/configure-local-backend-firewall.ps1 once in Administrator PowerShell before starting the backend. See docs/local-backend.md.'
}
$ports = $rule | Get-NetFirewallPortFilter
$application = $rule | Get-NetFirewallApplicationFilter
$service = $rule | Get-NetFirewallServiceFilter
$addresses = @(($rule | Get-NetFirewallAddressFilter).RemoteAddress)
$expectedAddresses = @('0.0.0.0-126.255.255.255', '128.0.0.0-255.255.255.255', '::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
if ($ports.Protocol -notin @('TCP','6') -or @($ports.LocalPort).Count -ne 1 -or $ports.LocalPort -ne '55321-55324' -or
    $application.Program -ne 'Any' -or $service.Service -ne 'Any' -or
    @(Compare-Object ($addresses | Sort-Object) ($expectedAddresses | Sort-Object)).Count -ne 0) {
    throw 'The DUSK development firewall rule has unexpected settings. Review it before starting services.'
}
Write-Output 'DUSK development firewall protection verified. No policy was changed.'
