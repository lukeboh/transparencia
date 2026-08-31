import type { NextConfig } from 'next';
import path from 'node:path';

// O repositório tem DOIS package-lock.json: a raiz (scrapers em src/tse) e este
// web/. Sem fixar a raiz, o Next sobe a árvore, encontra os dois e às vezes
// elege a raiz errada como "workspace root" — o que, no `next dev`, faz o
// servidor servir o CSS (/_next/static/css/app/layout.css) VAZIO de vez em
// quando, e a página aparece sem formatação (FOUC). Fixar a raiz aqui elimina
// essa ambiguidade tanto para o output file tracing quanto para o Turbopack.
const raiz = path.join(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: raiz,
  turbopack: {
    root: raiz,
  },
};

export default nextConfig;
