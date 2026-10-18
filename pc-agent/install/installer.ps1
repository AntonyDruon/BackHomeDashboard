# Installation de HomeDashboard Agent (à lancer en administrateur via installer.cmd)
# - copie l'agent dans C:\Program Files\HomeDashboardAgent
# - installe le pilote PawnIO (lecture des capteurs de la carte mère) s'il manque
# - pare-feu : port 8790 ouvert UNIQUEMENT au serveur 192.168.1.24
# - laisse Armoury Crate gérer les ventilateurs (AsusFanControlService actif)
# - tâche planifiée : démarre l'agent à ta connexion, avec les droits administrateur
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $env:ProgramFiles 'HomeDashboardAgent'
$server = '192.168.1.24'
$port = 8790
$taskName = 'HomeDashboard Agent'

function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

Step "Arrêt de l'ancienne version"
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Get-Process HomeDashboardAgent -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2

Step "Copie des fichiers vers $dst"
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item (Join-Path $src 'HomeDashboardAgent.exe') $dst -Force
Copy-Item (Join-Path $src 'iCUESDK.x64_2019.dll') $dst -Force
Copy-Item (Join-Path $src 'desinstaller.ps1') $dst -Force

Step "Pilote PawnIO (capteurs carte mère)"
$pawn = Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'PawnIO*' }
if ($pawn) {
  Write-Host "Déjà installé ($($pawn.DisplayVersion))"
} else {
  $setup = Join-Path $src 'PawnIO_setup.exe'
  Start-Process $setup -ArgumentList '-install', '-silent' -Wait
  Write-Host "PawnIO installé"
}

Step "Pare-feu : port $port réservé au serveur $server"
Get-NetFirewallRule -DisplayName 'HomeDashboard Agent*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'HomeDashboard Agent - serveur uniquement' -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort $port -RemoteAddress $server -Profile Any `
  -Program (Join-Path $dst 'HomeDashboardAgent.exe') | Out-Null
Write-Host "OK"

Step "Armoury Crate : contrôle des ventilateurs conservé"
# L'app ne pilote pas les ventilateurs de cette carte mère : on laisse (ou remet) Armoury Crate s'en charger
$svc = Get-Service AsusFanControlService -ErrorAction SilentlyContinue
if ($svc) {
  Set-Service AsusFanControlService -StartupType Automatic
  if ($svc.Status -ne 'Running') { Start-Service AsusFanControlService -ErrorAction SilentlyContinue }
  Write-Host "AsusFanControlService actif"
} else { Write-Host "Service absent, rien à faire" }

Step "Démarrage automatique à ta connexion"
$user = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute (Join-Path $dst 'HomeDashboardAgent.exe') -WorkingDirectory $dst
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description "Capteurs, LED et ventilateurs pour l'app HomeDashboard" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Start-Sleep 5

Step "Vérification"
$p = Get-Process HomeDashboardAgent -ErrorAction SilentlyContinue
if ($p) { Write-Host "Agent démarré (PID $($p.Id))" -ForegroundColor Green }
else { Write-Host "L'agent ne tourne pas : voir C:\ProgramData\HomeDashboardAgent\agent.log" -ForegroundColor Red }

Write-Host "`nPense à vérifier dans iCUE : Paramètres > Général > activer le SDK (contrôle par des logiciels tiers)." -ForegroundColor Yellow
Write-Host "Tu peux fermer cette fenêtre."
Read-Host "Appuie sur Entrée pour fermer"
