# Script de inicializacao para PowerShell (Windows)
# Atualiza os dados de contratos do TSE e inicia o portal web

$ErrorActionPreference = "Stop"

Write-Host "1. Verificando dependencias da raiz..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "2. Extraindo contratos atualizados da fonte oficial do TSE..." -ForegroundColor Cyan
node src/tse/scrapeContratos.js TSE data/tse_contratos.json

Write-Host "3. Extraindo relacao atual de agentes publicos (fonte primaria de FC/CJ)..." -ForegroundColor Cyan
node src/tse/scrapeAgentesPublicos.js data/tse_agentes.json

Write-Host "4. Compilando dados brutos para o dashboard..." -ForegroundColor Cyan
node src/tse/buildDashboardData.js

Write-Host "5. Verificando dependencias da aplicacao web..." -ForegroundColor Cyan
if (-not (Test-Path "web/node_modules")) {
    Set-Location web
    npm install
    Set-Location ..
}

Write-Host "6. Iniciando servidor do portal de transparencia (http://localhost:3000)..." -ForegroundColor Green
Set-Location web
npm run dev
