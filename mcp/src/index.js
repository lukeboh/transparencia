#!/usr/bin/env node
// Ponto de entrada: servidor MCP sobre stdio (o transporte que todos os
// clientes de desktop — Claude Desktop, Cursor, VS Code, Windsurf, LM Studio… —
// sabem iniciar como subprocesso).
//
// Variáveis de ambiente (todas opcionais):
//   TSE_MCP_MODO          auto (padrão) | snapshot | ao-vivo
//   TSE_MCP_CACHE_DIR     onde guardar o cache local
//   TSE_MCP_SNAPSHOT_URL  base dos snapshots (padrão: data/ do repositório no GitHub)
//   TSE_MCP_SNAPSHOT_DIR  pasta local com os data/*.json (uso offline / desenvolvimento)
//   TSE_MCP_TIMEOUT_S     timeout por requisição HTTP, em segundos (padrão 45)

// stdout é o canal do protocolo: qualquer console.log de código reaproveitado
// corromperia as mensagens. Redireciona tudo para stderr ANTES de importar o resto.
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);

// Os scrapers usam fetch sem timeout; aqui um servidor travado numa conexão
// pendurada da fonte oficial não pode prender a IA para sempre.
const TIMEOUT_MS = (Number(process.env.TSE_MCP_TIMEOUT_S) > 0 ? Number(process.env.TSE_MCP_TIMEOUT_S) : 45) * 1000;
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (url, opcoes = {}) =>
  fetchOriginal(url, { ...opcoes, signal: opcoes.signal ?? AbortSignal.timeout(TIMEOUT_MS) });

const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { criarServidor, VERSAO } = await import('./servidor.js');

if (process.argv.includes('--version')) {
  console.error(VERSAO);
  process.exit(0);
}

const { servidor, repositorio } = criarServidor();
await servidor.connect(new StdioServerTransport());
console.error(
  `[tse-mcp] v${VERSAO} pronto (modo ${repositorio.config.modo}, cache em ${repositorio.config.diretorioCache})`,
);

const encerrar = async () => {
  try {
    await servidor.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
