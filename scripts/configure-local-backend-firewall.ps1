# Run explicitly in Administrator PowerShell. Adds one port-scoped rule and never edits existing rules.
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator to install the DUSK-only development firewall rule.'
}
$name = 'DUSK-Local-Backend-Block-Remote'
if (-not (Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name $name -DisplayName 'DUSK local backend - block remote connections' `
        -Description 'Blocks non-loopback access to DUSK disposable local development ports.' `
        -Direction Inbound -Action Block -Enabled True -Profile Any -Protocol TCP `
        -LocalPort '55321-55324' -RemoteAddress @('0.0.0.0-126.255.255.255', '128.0.0.0-255.255.255.255', '::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff') | Out-Null
}
& (Join-Path $PSScriptRoot 'check-local-backend-network.ps1')
