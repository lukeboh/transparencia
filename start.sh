#!/usr/bin/env bash
set -e

# Script de inicialização para Linux / macOS / Bash
# Atualiza os dados de contratos do TSE e inicia o portal web

echo -e "\033[36m1. Verificando dependências da raiz...\033[0m"
if [ ! -d "node_modules" ]; then
    npm install
fi

echo -e "\033[36m2. Extraindo contratos atualizados da fonte oficial do TSE...\033[0m"
node src/tse/scrapeContratos.js TSE data/tse_contratos.json

echo -e "\033[36m3. Extraindo relação atual de agentes públicos (fonte primária de FC/CJ)...\033[0m"
node src/tse/scrapeAgentesPublicos.js data/tse_agentes.json

echo -e "\033[36m4. Compilando dados brutos para o dashboard...\033[0m"
node src/tse/buildDashboardData.js

echo -e "\033[36m5. Verificando dependências da aplicação web...\033[0m"
if [ ! -d "web/node_modules" ]; then
    (cd web && npm install)
fi

echo -e "\033[32m6. Iniciando servidor do portal de transparência (http://localhost:3000)...\033[0m"
cd web
npm run dev
