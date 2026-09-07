// Log interno unificado — scraping (atualização de dados sob demanda em
// web/app/api/tse/dados/route.ts), atualização automática do site a partir do
// git (scripts/atualizar-app.mjs) e erros da aplicação (web/instrumentation.ts).
// Grava em logs/app.log (JSON Lines, um registro por linha), fora de data/
// (que é versionado) e fora de web/ (sobrevive a `next build`). Consultado
// pelo painel interno em web/app/painel/[chave]/page.tsx — nunca versionado
// (ver .gitignore).
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR_LOGS = path.join(raiz, 'logs');
const ARQUIVO = path.join(DIR_LOGS, 'app.log');
const ARQUIVO_ANTERIOR = path.join(DIR_LOGS, 'app.log.1');
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024; // acima disso, rotaciona (mantém só 1 arquivo anterior)

const CATEGORIAS = ['scraping', 'atualizacao', 'erro', 'app'];
const NIVEIS = ['info', 'aviso', 'erro'];

function rotacionarSeNecessario() {
  let tamanho;
  try {
    tamanho = statSync(ARQUIVO).size;
  } catch {
    return; // arquivo ainda não existe
  }
  if (tamanho < TAMANHO_MAX_BYTES) return;
  try {
    renameSync(ARQUIVO, ARQUIVO_ANTERIOR);
  } catch {
    // corrida entre processos escrevendo ao mesmo tempo — perder uma
    // rotação não é crítico, só adia a próxima
  }
}

/**
 * Registra uma linha de log. Nunca lança — uma falha ao gravar (disco cheio,
 * permissão) só avisa no stderr, sem derrubar quem chamou.
 * @param {'scraping'|'atualizacao'|'erro'|'app'} categoria
 * @param {'info'|'aviso'|'erro'} nivel
 * @param {string} mensagem
 * @param {Record<string, unknown>} [detalhes]
 */
export function registrar(categoria, nivel, mensagem, detalhes) {
  const registro = {
    ts: new Date().toISOString(),
    categoria: CATEGORIAS.includes(categoria) ? categoria : 'app',
    nivel: NIVEIS.includes(nivel) ? nivel : 'info',
    mensagem: String(mensagem ?? ''),
    ...(detalhes !== undefined ? { detalhes } : {}),
  };
  try {
    mkdirSync(DIR_LOGS, { recursive: true });
    rotacionarSeNecessario();
    appendFileSync(ARQUIVO, JSON.stringify(registro) + '\n', 'utf8');
  } catch (err) {
    console.error('[logger] falha ao gravar log:', err);
  }
  return registro;
}

/**
 * Lê os últimos registros, mais recente primeiro — `app.log` + `app.log.1`
 * (se existir), para não perder histórico logo após uma rotação.
 * @param {{ categoria?: string; limite?: number }} [opcoes]
 */
export function lerRegistros({ categoria, limite = 300 } = {}) {
  const linhas = [];
  for (const arq of [ARQUIVO_ANTERIOR, ARQUIVO]) {
    if (!existsSync(arq)) continue;
    const conteudo = readFileSync(arq, 'utf8');
    for (const linha of conteudo.split('\n')) {
      if (!linha.trim()) continue;
      try {
        linhas.push(JSON.parse(linha));
      } catch {
        // linha corrompida (ex.: truncada por rotação concorrente) — ignora
      }
    }
  }
  const filtradas = categoria ? linhas.filter((l) => l.categoria === categoria) : linhas;
  filtradas.reverse();
  return filtradas.slice(0, limite);
}
