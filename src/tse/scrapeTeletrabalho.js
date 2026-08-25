// Extrai os períodos de teletrabalho por servidor do TSE.
//
// https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/cargos-e-funcoes/servidores-em-regime-de-teletrabalho
// (a página institucional embute um iframe apontando para o app real:
// transparencia.tse.jus.br/transparenciaDadosServidores — mesma família do
// app usado por scrapeAgentesPublicos.js).
//
// Descoberta: um GET simples em /infoServidores?acao=teletrabalho, com
// dataInicio/dataFim/unidade na querystring, já retorna a tabela completa —
// sem sessão/CSRF (ao contrário de scrapeContratos.js) e sem paginação (a
// base inteira, ~3400 linhas, vem em uma única resposta). Cada linha tem um
// botão "Detalhar" que chamaria POST /infoTeletrabalhoDetalhe?id=... para um
// suposto detalhamento dia-a-dia — testado manualmente contra vários ids
// reais (com cookies de sessão e Referer corretos) e SEMPRE respondeu
// "Nenhum detalhe disponível". Esse endpoint não é confiável; não usar. A
// própria linha da listagem já traz tudo que precisamos: nome, a hierarquia
// completa da lotação (coluna "Nome da Unidade", níveis separados por
// " - ", do menor para o maior) e o período (início/fim; fim vazio = período
// em aberto).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripHtml } from './scrapeContratos.js';

const URL_BASE = 'https://transparencia.tse.jus.br/transparenciaDadosServidores/infoServidores';

// Primeiro registro observado na fonte começa em 01/10/2019; usamos uma
// janela com folga para não depender de conhecer a data exata de início do
// regime.
const DATA_INICIO_PADRAO = '01/01/2015';

function hojeBR() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Monta a URL de origem para um servidor específico — usada pela UI para "ver na fonte". */
function urlTeletrabalho({ dataInicio = DATA_INICIO_PADRAO, dataFim = hojeBR(), nomeServidor = '' } = {}) {
  const params = new URLSearchParams({
    acao: 'teletrabalho',
    dataInicio,
    dataFim,
    unidade: '-1',
    nomeServidor,
    valida: 'true',
    toExcel: 'false',
  });
  return `${URL_BASE}?${params.toString()}`;
}

function linhaParaTeletrabalho(row) {
  const [, nomeHtml, unidadeHtml, dataInicioHtml, dataFimHtml] = row;
  const nome = stripHtml(nomeHtml);
  const unidade = stripHtml(unidadeHtml);
  const dataInicio = stripHtml(dataInicioHtml) || null;
  const dataFimBruta = stripHtml(dataFimHtml);

  return {
    nome,
    unidade,
    unidadeNiveis: unidade ? unidade.split(' - ').map((s) => s.trim()).filter(Boolean) : [],
    dataInicio,
    dataFim: dataFimBruta || null,
  };
}

async function scrapeTeletrabalho() {
  const url = urlTeletrabalho();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao buscar teletrabalho (status ${res.status})`);
  const html = await res.text();

  const tabelaMatch = /<table[^>]*id="tabServTeletrabalho"[^>]*>([\s\S]*?)<\/table>/.exec(html);
  if (!tabelaMatch) {
    throw new Error('Tabela de teletrabalho não encontrada — layout da fonte pode ter mudado.');
  }

  const linhas = [...tabelaMatch[1].matchAll(
    /<tr class="fundo[01]">\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>[\s\S]*?<\/td>\s*<\/tr>/g,
  )];

  return linhas.map(linhaParaTeletrabalho).filter((r) => r.nome);
}

async function main() {
  const out = process.argv[2] ?? 'data/tse_teletrabalho.json';

  console.log('Extraindo períodos de teletrabalho do TSE...');
  const registros = await scrapeTeletrabalho();

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(registros, null, 2), 'utf8');
  console.log(`Salvo em ${out} (${registros.length} períodos de teletrabalho).`);
}

const isMain = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
);

if (isMain) {
  main().catch((err) => {
    console.error('Falha na extração:', err);
    process.exit(1);
  });
}

export { scrapeTeletrabalho, linhaParaTeletrabalho, urlTeletrabalho, hojeBR };
