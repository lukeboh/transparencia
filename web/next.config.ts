import type { NextConfig } from 'next';
import path from 'node:path';

// A raiz do WORKSPACE é o repositório (um nível acima de web/), não web/: a
// rota app/api/tse/dados/route.ts importa de ../../../../../src/tse/*, fora
// de web/. Fixamos essa raiz explicitamente para (a) o Turbopack conseguir
// resolver esses imports acima de web/ e (b) parar de "inferir" o workspace
// root — o repo tem dois package-lock.json (raiz = scrapers, web/ = app), e a
// inferência às vezes escolhia errado, o que sumia com o aviso e ajudava no
// FOUC de CSS vazio no dev.
const raizWorkspace = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  outputFileTracingRoot: raizWorkspace,
  turbopack: {
    root: raizWorkspace,
  },
  // O dev server costuma ser acessado de outra máquina na rede do TSE
  // (ex.: tsesetot48.tse.jus.br) — sem isto o Next 15 recusa/avisa nas
  // requisições cross-origin a /_next/*. Só afeta `next dev`.
  allowedDevOrigins: ['*.tse.jus.br', '10.30.64.17'],
};

export default nextConfig;
