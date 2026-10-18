# Désinstalle HomeDashboard Agent et remet les réglages d'origine (à lancer en administrateur)
$taskName = 'HomeDashboard Agent'
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Get-Process HomeDashboardAgent -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetFirewallRule -DisplayName 'HomeDashboard Agent*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$svc = Get-Service AsusFanControlService -ErrorAction SilentlyContinue
if ($svc) { Set-Service AsusFanControlService -StartupType Automatic; Start-Service AsusFanControlService -ErrorAction SilentlyContinue }
Remove-Item (Join-Path $env:ProgramFiles 'HomeDashboardAgent') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "HomeDashboard Agent désinstallé. Les réglages Armoury Crate (ventilateurs) sont rétablis."
Write-Host "(Le pilote PawnIO reste installé ; il se désinstalle depuis Paramètres > Applications si besoin.)"
Read-Host "Appuie sur Entrée pour fermer"
