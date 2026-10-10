// Gera dist/index.js: um único arquivo com o servidor MCP + o código de
// src/tse/ (know-how de extração) + SDK MCP + zod. Só o pdfjs-dist fica de
// fora (carrega seu worker por caminho relativo e não sobrevive ao bundle).
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8'));

const trocarLogger = {
  name: 'trocar-logger',
  setup(b) {
    b.onResolve({ filter: /lib\/logger\.js$/ }, () => ({ path: path.join(raiz, 'src/logger-stub.js') }));
  },
};

// Cada scraper de src/tse/ roda seu main() de CLI quando
// `fileURLToPath(import.meta.url) === process.argv[1]`. Num bundle, TODOS os
// módulos têm o import.meta.url do bundle — e todos se achariam o principal.
const desligarMainDosScrapers = {
  name: 'desligar-main-dos-scrapers',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]tse[\\/].*\.js$/ }, async (args) => {
      const fonte = await readFile(args.path, 'utf8');
      return { contents: fonte.replace(/const isMain = /g, 'const isMain = false && '), loader: 'js' };
    });
  },
};

await build({
  entryPoints: [path.join(raiz, 'src/index.js')],
  outfile: path.join(raiz, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  external: ['pdfjs-dist', 'pdfjs-dist/*', 'playwright'],
  plugins: [trocarLogger, desligarMainDosScrapers],
  define: { 'process.env.TSE_MCP_VERSAO_BUILD': JSON.stringify(pkg.version) },
  // Dependências CommonJS empacotadas em ESM ainda chamam require().
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'info',
});
