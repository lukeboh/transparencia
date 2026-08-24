// Extrai a "Relação de agentes públicos" (Anexo V, Resolução CNJ nº
// 102/2009) do TSE — fonte PRIMÁRIA para identificar quem tem função
// comissionada (FC-1 a FC-6) ou cargo em comissão (CJ-1 a CJ-4) HOJE.
//
// https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/servidor/relacao-agentes-publicos
//
// Ao contrário do scraper de portarias (scrapeFuncoes.js, fonte secundária
// só para histórico), esta é uma única página HTML estática, sem sessão/CSRF,
// com todos os agentes públicos do TSE em uma tabela só (~920 linhas, sem
// paginação) — bem mais rápida e confiável para o estado atual, mas sem
// histórico: só mostra a função de hoje, não quando ela começou nem quem a
// ocupou antes.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripHtml } from './scrapeContratos.js';

const URL = 'https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/servidor/relacao-agentes-publicos';

const NIVEL_MAX = { FC: 6, CJ: 4 };

/** "CJ-3 - ASSESSOR-CHEFE" → { tipo, nivel, cargoTitulo }; "-"/vazio → null. */
function parseFuncao(textoBruto) {
  const texto = textoBruto.trim();
  if (!texto || texto === '-') return { funcao: null, observacao: null };

  const m = texto.match(/^(FC|CJ)\s*-?\s*(\d+)\s*-\s*(.+)$/i);
  if (!m) return { funcao: null, observacao: `Formato de função não reconhecido na fonte: "${texto}"` };

  const tipo = m[1].toUpperCase();
  const nivel = Number(m[2]);
  const cargoTitulo = m[3].trim();
  const max = NIVEL_MAX[tipo];
  if (nivel < 1 || nivel > max) {
    return {
      funcao: { tipo, nivel, cargoTitulo },
      observacao: `Nível ${tipo}-${nivel} fora da faixa esperada (${tipo}-1 a ${tipo}-${max}); mantido como veio da fonte.`,
    };
  }
  return { funcao: { tipo, nivel, cargoTitulo }, observacao: null };
}

function linhaParaAgente(row) {
  const [, nomeHtml, matriculaHtml, cargoHtml, funcaoHtml, lotacaoHtml, atoHtml, dataHtml] = row;
  const nome = stripHtml(nomeHtml);
  const cargo = stripHtml(cargoHtml) || null;
  const lotacao = stripHtml(lotacaoHtml) || null;
  const atoProvimento = stripHtml(atoHtml) || null;
  const dataPublicacao = stripHtml(dataHtml) || null;
  const { funcao, observacao } = parseFuncao(stripHtml(funcaoHtml));

  const observacoes = [];
  if (!nome) observacoes.push('Linha sem nome na fonte — registro possivelmente malformado.');
  if (observacao) observacoes.push(observacao);

  return {
    nome,
    matricula: stripHtml(matriculaHtml) || null,
    cargo,
    funcao,
    lotacao,
    atoProvimento,
    dataPublicacao,
    observacoes,
  };
}

async function scrapeAgentesPublicos() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Falha ao buscar relação de agentes públicos (status ${res.status})`);
  const html = await res.text();

  const linhas = [...html.matchAll(
    /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g,
  )];
  if (linhas.length === 0) {
    throw new Error('Nenhuma linha de agente público encontrada — layout da fonte pode ter mudado.');
  }

  return linhas.map(linhaParaAgente).filter((a) => a.nome);
}

async function main() {
  const out = process.argv[2] ?? 'data/tse_agentes.json';

  console.log('Extraindo relação de agentes públicos do TSE...');
  const agentes = await scrapeAgentesPublicos();

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(agentes, null, 2), 'utf8');
  const comFuncao = agentes.filter((a) => a.funcao).length;
  console.log(`Salvo em ${out} (${agentes.length} agentes públicos, ${comFuncao} com função/cargo em comissão).`);
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

export { scrapeAgentesPublicos, parseFuncao, linhaParaAgente };
