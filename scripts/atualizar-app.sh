#!/usr/bin/env bash
# Wrapper para cron/systemd — cron roda com um PATH mínimo, então resolvemos
# node explicitamente e sempre a partir da raiz do repositório (independente
# de onde o cron/timer invoque o script). Ver deploy/README.md.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec node scripts/atualizar-app.mjs
