$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host 'Installing CodeSentinel workspace dependencies...'
npm install

$envPath = Join-Path $projectRoot 'server/.env'
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $projectRoot 'server/.env.example') $envPath
    Write-Host 'Created server/.env from the example. Edit MongoDB and Ollama settings if needed.'
}

Write-Host 'Setup complete. Start MongoDB and Ollama, then run npm run doctor and npm run dev.'
