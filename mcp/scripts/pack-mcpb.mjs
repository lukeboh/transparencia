// Gera dist/tse-transparencia-mcp-<versão>.mcpb — o MCP Bundle instalável com
// um clique no Claude Desktop (e em outros apps compatíveis com MCPB).
//
// Conteúdo do pacote:
//   manifest.json                     ← gerado aqui (ferramentas listadas do próprio servidor)
//   server/index.js                   ← dist/index.js (bundle do esbuild)
//   server/node_modules/pdfjs-dist/   ← só o build "legacy" + cmaps/fontes (leitura de texto);
//                                        sem @napi-rs/canvas, que é binário por plataforma
import { cp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8'));
const staging = path.join(raiz, 'build', 'mcpb');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

execFileSync(process.execPath, [path.join(raiz, 'scripts/build.mjs')], { stdio: 'inherit' });

await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, 'server'), { recursive: true });
await copyFile(path.join(raiz, 'dist/index.js'), path.join(staging, 'server/index.js'));

const pdfOrigem = path.join(raiz, 'node_modules/pdfjs-dist');
const pdfDestino = path.join(staging, 'server/node_modules/pdfjs-dist');
await mkdir(path.join(pdfDestino, 'legacy/build'), { recursive: true });
for (const arq of ['package.json', 'LICENSE', 'legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs']) {
  if (existsSync(path.join(pdfOrigem, arq))) await copyFile(path.join(pdfOrigem, arq), path.join(pdfDestino, arq));
}
for (const dir of ['cmaps', 'standard_fonts']) {
  await cp(path.join(pdfOrigem, dir), path.join(pdfDestino, dir), { recursive: true });
}
if (existsSync(path.join(raiz, 'assets/icon.png'))) await copyFile(path.join(raiz, 'assets/icon.png'), path.join(staging, 'icon.png'));

// Lista ferramentas e prompts conversando com o servidor em memória.
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const { criarServidor } = await import('../src/servidor.js');
const { servidor } = criarServidor();
const [a, b] = InMemoryTransport.createLinkedPair();
await servidor.connect(a);
const cliente = new Client({ name: 'pack-mcpb', version: pkg.version });
await cliente.connect(b);
const { tools } = await cliente.listTools();
const { prompts } = await cliente.listPrompts();
await cliente.close();

const primeiraFrase = (t) => (t.match(/^[^.]*\./)?.[0] ?? t).trim();

const manifesto = {
  manifest_version: '0.3',
  name: 'tse-transparencia-mcp',
  display_name: 'Transparência TSE',
  version: pkg.version,
  description: 'Dados públicos de transparência do TSE sob demanda: contratos, fiscais, servidores, funções, unidades, teletrabalho, terceirizados e horas extras.',
  long_description:
    'Consulta as fontes oficiais de transparência do Tribunal Superior Eleitoral (Compras.gov.br, portal de transparência ' +
    'de pessoal, legislação compilada, PDFs mensais de terceirizados e folha de pagamento) reaproveitando os extratores ' +
    'do projeto github.com/lukeboh/transparencia. Quando a fonte oficial não responde, usa o snapshot versionado do ' +
    'projeto. Inclui consulta livre com filtros e agrupamentos, perfil cruzado de servidores e notas de metodologia.',
  author: { name: 'lukeboh', url: 'https://github.com/lukeboh' },
  repository: { type: 'git', url: 'https://github.com/lukeboh/transparencia' },
  homepage: 'https://github.com/lukeboh/transparencia/tree/main/mcp',
  documentation: 'https://github.com/lukeboh/transparencia/blob/main/mcp/README.md',
  ...(existsSync(path.join(staging, 'icon.png')) ? { icon: 'icon.png' } : {}),
  server: {
    type: 'node',
    entry_point: 'server/index.js',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/server/index.js'],
      env: {
        TSE_MCP_MODO: '${user_config.modo}',
        TSE_MCP_CACHE_DIR: '${user_config.diretorio_cache}',
      },
    },
  },
  tools: tools.map((t) => ({ name: t.name, description: primeiraFrase(t.description ?? t.title ?? t.name) })),
  prompts: prompts.map((p) => ({
    name: p.name,
    description: p.description,
    arguments: (p.arguments ?? []).map((x) => x.name),
    text: p.description ?? p.name,
  })),
  keywords: pkg.keywords,
  license: pkg.license,
  compatibility: {
    platforms: ['darwin', 'win32', 'linux'],
    runtimes: { node: '>=18.17.0' },
  },
  user_config: {
    modo: {
      type: 'string',
      title: 'Modo de obtenção dos dados',
      description:
        '"auto" (fonte oficial; se falhar, snapshot do projeto), "snapshot" (só o snapshot, mais rápido e estável) ou "ao-vivo" (só a fonte oficial).',
      default: 'auto',
      required: false,
    },
    diretorio_cache: {
      type: 'directory',
      title: 'Pasta de cache (opcional)',
      description: 'Onde guardar os dados baixados. Em branco = pasta de cache padrão do sistema.',
      required: false,
    },
  },
};
await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifesto, null, 2) + '\n');

execFileSync(npx, ['mcpb', 'validate', path.join(staging, 'manifest.json')], { stdio: 'inherit', cwd: raiz });
const saida = path.join(raiz, 'dist', `tse-transparencia-mcp-${pkg.version}.mcpb`);
execFileSync(npx, ['mcpb', 'pack', staging, saida], { stdio: 'inherit', cwd: raiz });
console.error(`\nPacote gerado: ${path.relative(process.cwd(), saida)}`);
