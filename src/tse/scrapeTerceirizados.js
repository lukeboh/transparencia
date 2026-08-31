// Extrai os "Postos de Trabalho - Contratos de Cessão de Mão de Obra" do TSE:
// a relação de profissionais terceirizados, com a UNIDADE (coluna "Alocação")
// onde cada um trabalha.
//
// https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/profissionais-terceirizados-contratos-com-cessao-de-mao-de-obra
//
// A fonte é só um PDF por mês (OCR, sem CSV/planilha/API). A página lista um
// link por competência; baixamos TODAS as competências que ela lista e
// versionamos o histórico em data/tse_terceirizados.json — é o histórico
// mês a mês que dá o "mês de início" (primeira vez que o profissional aparece)
// e o "mês de fim" (última vez, quando ele some das listagens seguintes) de
// cada terceirizado. Re-execuções são incrementais: só baixam os PDFs de
// competências que ainda não estão no arquivo (use --refazer para ignorar o
// cache, --limite N para baixar só as N mais recentes).
//
// O PDF é uma tabela de 7 colunas:
//   Linha | Contrato | Empresa | CNPJ | Empregado | Posto de Trabalho | Alocação
// A "Alocação" é um caminho de siglas do menor nível para o maior
// (ex.: "Seget/Cosen/SAD/TSE"); às vezes uma sigla só, às vezes o nome de um
// gabinete de ministro. O cruzamento com a árvore de unidades (por SIGLA) fica
// em agregarTerceirizados.js / agregarUnidades.js — aqui só extraímos as
// linhas cruas de cada competência.
//
// O parsing usa as coordenadas x/y de cada trecho de texto (pdfjs-dist): as
// âncoras das colunas saem do cabeçalho, então mesmo com a diagramação
// irregular do PDF a coluna "Alocação" é recuperada de forma confiável
// (~98% das linhas numeradas).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const PAGINA_LISTAGEM =
  'https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/profissionais-terceirizados-contratos-com-cessao-de-mao-de-obra';

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MESES_ROTULO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const semAcento = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "2026-07" — chave estável e ordenável de uma competência. */
export const chaveCompetencia = (mes, ano) => `${ano}-${String(mes).padStart(2, '0')}`;

/**
 * Lê a página de listagem e devolve TODAS as competências reconhecidas, uma por
 * link `dados-cts`, ordenadas da mais antiga para a mais recente e sem
 * duplicatas (fica com o primeiro link de cada competência).
 */
export function descobrirArquivos(html) {
  const links = [...html.matchAll(/href="([^"]*dados-cts[^"]*)"/gi)].map((m) => m[1]);
  const porChave = new Map();
  for (const href of links) {
    const slug = semAcento(decodeURIComponent(href)).toLowerCase();
    const m = slug.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[-_ ]+(\d{4})/);
    if (!m) continue;
    const mes = MESES.indexOf(m[1]) + 1;
    const ano = Number(m[2]);
    const chave = chaveCompetencia(mes, ano);
    if (porChave.has(chave)) continue;
    porChave.set(chave, {
      href,
      competencia: { mes, ano, chave, rotulo: `${MESES_ROTULO[mes - 1]}/${ano}` },
    });
  }
  return [...porChave.values()].sort((a, b) =>
    a.competencia.chave.localeCompare(b.competencia.chave),
  );
}

/** Lê a página de listagem e devolve o link da competência mais recente. */
export async function descobrirArquivoMaisRecente(html) {
  const todos = descobrirArquivos(html);
  if (todos.length === 0) throw new Error('Nenhum link de arquivo mensal reconhecido na página de listagem.');
  return todos[todos.length - 1];
}

/** Agrupa os trechos de texto de uma página em linhas visuais (tolerância em y). */
function agruparEmLinhas(itens) {
  const linhas = [];
  const ordenado = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of ordenado) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(ultima.y - it.y) <= 3) {
      ultima.itens.push(it);
      ultima.y = (ultima.y * (ultima.itens.length - 1) + it.y) / ultima.itens.length;
    } else {
      linhas.push({ y: it.y, itens: [it] });
    }
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  return linhas;
}

const juntar = (itens) => itens.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Parseia o PDF (Uint8Array/Buffer) e devolve uma linha por profissional:
 * { linha, contrato, empresa, cnpj, empregado, posto, alocacao }.
 */
export async function parsePdfTerceirizados(dados) {
  const doc = await getDocument({ data: dados, useSystemFonts: true }).promise;

  // Junta os trechos de todas as páginas com suas coordenadas.
  const porPagina = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    porPagina.push(
      tc.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str })),
    );
  }

  // Âncoras das colunas: do cabeçalho na 1ª página que tem "Empregado" e "Alocação".
  const linhas1 = agruparEmLinhas(porPagina[0] ?? []);
  const hdr = linhas1.find(
    (l) => l.itens.some((i) => /Aloca/i.test(i.str)) && l.itens.some((i) => /Empregado/i.test(i.str)),
  );
  if (!hdr) throw new Error('Cabeçalho da tabela não encontrado no PDF (esperava colunas "Empregado" e "Alocação").');
  const xDe = (rx) => hdr.itens.find((i) => rx.test(i.str))?.x ?? null;
  const xCnpj = xDe(/CNPJ/i);
  const xEmpregado = xDe(/Empregado/i);
  const xPosto = xDe(/Posto/i);
  const xAloc = xDe(/Aloca/i);
  if (xPosto == null || xAloc == null) throw new Error('Não achei as colunas "Posto" / "Alocação" no cabeçalho.');
  const limitePostoAloc = (xPosto + xAloc) / 2;
  const limiteCnpjEmpregado = xCnpj != null && xEmpregado != null ? (xCnpj + xEmpregado) / 2 : xPosto;

  const registros = [];
  const ignoraLinha = (t) =>
    /^POSTOS DE TRABALHO/i.test(t) || /^TSE\b/i.test(t) || /^Data:/i.test(t) || /^Linha\b/i.test(t) || !t;

  for (let p = 0; p < porPagina.length; p++) {
    for (const l of agruparEmLinhas(porPagina[p])) {
      const textoLinha = juntar(l.itens);
      if (ignoraLinha(textoLinha)) continue;

      const celAloc = juntar(l.itens.filter((i) => i.x >= limitePostoAloc - 5));
      const celPosto = juntar(l.itens.filter((i) => i.x >= xPosto - 5 && i.x < limitePostoAloc - 5));
      const celMeio = juntar(l.itens.filter((i) => i.x >= limiteCnpjEmpregado - 5 && i.x < xPosto - 5));

      const m = textoLinha.match(/^(\d{1,5})\s+(\d{1,3}\/\d{4})\b(.*)$/);
      if (m) {
        const resto = m[3];
        const cnpj = resto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2,3}/)?.[0] ?? null;
        const empresa = juntar(l.itens.filter((i) => i.x < (xCnpj ?? xEmpregado ?? xPosto) - 5)).replace(/^\d{1,5}\s+\d{1,3}\/\d{4}\s*/, '');
        registros.push({
          linha: Number(m[1]),
          contrato: m[2],
          empresa,
          cnpj,
          empregado: celMeio,
          posto: celPosto,
          alocacao: celAloc,
        });
      } else if (registros.length) {
        // continuação de célula: completa campos vazios do registro anterior.
        const ult = registros[registros.length - 1];
        if (celAloc && !ult.alocacao) ult.alocacao = celAloc;
        if (celMeio && !ult.empregado) ult.empregado = celMeio;
        if (celPosto && !ult.posto) ult.posto = celPosto;
      }
    }
  }

  return registros;
}

/** Lê o arquivo já gravado (se houver) para reaproveitar competências parseadas. */
async function lerCacheExistente(saida) {
  if (!existsSync(saida)) return { porCompetencia: {}, competencias: [] };
  try {
    const j = JSON.parse(await readFile(saida, 'utf8'));
    return {
      porCompetencia: j?.porCompetencia ?? {},
      competencias: Array.isArray(j?.competencias) ? j.competencias : [],
    };
  } catch {
    return { porCompetencia: {}, competencias: [] };
  }
}

async function main() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const saida = path.join(raiz, 'data/tse_terceirizados.json');

  const args = process.argv.slice(2);
  const refazer = args.includes('--refazer');
  const limiteArg = args.find((a) => a.startsWith('--limite'));
  const limite = limiteArg ? Number(limiteArg.split(/[=\s]/)[1] ?? args[args.indexOf(limiteArg) + 1]) : Infinity;

  console.log('Buscando a lista de competências…');
  const htmlListagem = await (await fetch(PAGINA_LISTAGEM)).text();
  let arquivos = descobrirArquivos(htmlListagem);
  if (arquivos.length === 0) throw new Error('Nenhum link de arquivo mensal reconhecido na página de listagem.');
  if (Number.isFinite(limite)) arquivos = arquivos.slice(-limite);
  console.log(`  ${arquivos.length} competência(s): ${arquivos.map((a) => a.competencia.rotulo).join(', ')}`);

  const cache = refazer ? { porCompetencia: {}, competencias: [] } : await lerCacheExistente(saida);
  const porCompetencia = { ...cache.porCompetencia };
  const metaPorChave = new Map(cache.competencias.map((c) => [c.chave, c]));

  for (const { href, competencia } of arquivos) {
    const { chave, rotulo } = competencia;
    if (!refazer && Array.isArray(porCompetencia[chave]) && porCompetencia[chave].length > 0) {
      console.log(`  ${rotulo}: já no cache (${porCompetencia[chave].length} linhas) — pulando`);
      continue;
    }
    console.log(`  ${rotulo}: baixando ${href}`);
    const respPdf = await fetch(href, { redirect: 'follow' });
    if (!respPdf.ok) {
      console.warn(`    ⚠ falha ao baixar (${respPdf.status}) — competência ignorada nesta execução`);
      continue;
    }
    const buffer = new Uint8Array(await respPdf.arrayBuffer());
    let registros;
    try {
      registros = await parsePdfTerceirizados(buffer);
    } catch (err) {
      console.warn(`    ⚠ falha ao parsear (${err.message}) — competência ignorada nesta execução`);
      continue;
    }
    const comAlocacao = registros.filter((r) => r.alocacao).length;
    console.log(`    ${(buffer.length / 1024).toFixed(0)} KB · ${registros.length} profissionais · ${comAlocacao} com alocação`);
    porCompetencia[chave] = registros;
    metaPorChave.set(chave, {
      ...competencia,
      arquivoUrl: href,
      total: registros.length,
      comAlocacao,
      extraidoEm: new Date().toISOString(),
    });
  }

  // Só as competências efetivamente presentes em porCompetencia, ordenadas asc.
  const competencias = [...metaPorChave.values()]
    .filter((c) => Array.isArray(porCompetencia[c.chave]))
    .sort((a, b) => a.chave.localeCompare(b.chave));
  if (competencias.length === 0) throw new Error('Nenhuma competência pôde ser baixada/parseada.');
  const atual = competencias[competencias.length - 1];
  const registrosAtual = porCompetencia[atual.chave];

  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: PAGINA_LISTAGEM,
    // Compat: consumidores antigos leem `competencia`/`arquivoUrl`/`registros`
    // como a foto do mês mais recente.
    arquivoUrl: atual.arquivoUrl,
    competencia: { mes: atual.mes, ano: atual.ano, rotulo: atual.rotulo },
    competenciaAtual: { mes: atual.mes, ano: atual.ano, chave: atual.chave, rotulo: atual.rotulo },
    competencias,
    total: registrosAtual.length,
    registros: registrosAtual,
    // Histórico bruto por competência — entrada do agregador de "mês de
    // início / mês de fim" (ver src/tse/agregarTerceirizados.js).
    porCompetencia,
  };
  await mkdir(path.dirname(saida), { recursive: true });
  await writeFile(saida, JSON.stringify(payload, null, 2), 'utf8');
  console.log(
    `Gravado ${saida} — ${competencias.length} competência(s), ${registrosAtual.length} terceirizados na mais recente (${atual.rotulo}).`,
  );
}

const isMain = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase(),
);
if (isMain) {
  main().catch((err) => {
    console.error('Falha ao raspar terceirizados:', err);
    process.exit(1);
  });
}
