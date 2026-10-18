#!/bin/bash
# Compile l'agent Windows depuis le serveur Linux et prépare le dossier d'installation dist/
set -euo pipefail
cd "$(dirname "$0")"
DOTNET=${DOTNET:-$HOME/.dotnet/dotnet}
DL=${DL:-$HOME/pc-agent/dl}

mkdir -p native "$DL"
if [ ! -f native/iCUESDK.x64_2019.dll ]; then
  [ -f "$DL/icuesdk.zip" ] || curl -sL -o "$DL/icuesdk.zip" https://github.com/CorsairOfficial/cue-sdk/releases/download/v4.0.84/iCUESDK_4.0.84.zip
  python3 -c "import zipfile;z=zipfile.ZipFile('$DL/icuesdk.zip');open('native/iCUESDK.x64_2019.dll','wb').write(z.read('iCUESDK/redist/x64/iCUESDK.x64_2019.dll'))"
fi
[ -f "$DL/PawnIO_setup.exe" ] || curl -sL -o "$DL/PawnIO_setup.exe" https://github.com/namazso/PawnIO.Setup/releases/download/2.2.0/PawnIO_setup.exe

rm -rf dist out
DOTNET_CLI_TELEMETRY_OPTOUT=1 "$DOTNET" publish -c Release -o out --nologo -v q
mkdir -p dist
cp out/HomeDashboardAgent.exe out/iCUESDK.x64_2019.dll "$DL/PawnIO_setup.exe" dist/
# Scripts Windows : UTF-8 avec BOM (PowerShell 5) et fins de ligne CRLF
for f in install/*.ps1; do printf '\xef\xbb\xbf' > "dist/$(basename "$f")"; sed 's/\r\?$/\r/' "$f" >> "dist/$(basename "$f")"; done
sed 's/\r\?$/\r/' install/installer.cmd > dist/installer.cmd
ls -la dist
