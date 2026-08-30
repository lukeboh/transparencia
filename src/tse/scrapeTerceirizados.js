// Extrai os "Postos de Trabalho - Contratos de Cessão de Mão de Obra" do TSE:
// a relação de profissionais terceirizados, com a UNIDADE (coluna "Alocação")
// onde cada um trabalha.
//
// https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/profissionais-terceirizados-contratos-com-cessao-de-mao-de-obra
//
// A fonte é só um PDF por mês (OCR, sem CSV/planilha/API). A página lista um
// link por competência; pegamos o mais recente pelo mês/ano no próprio slug
// do link. O PDF é uma tabela de 7 colunas:
//   Linha | Contrato | Empresa | CNPJ | Empregado | Posto de Trabalho | Alocação
// A "Alocação" é um caminho de siglas do menor nível para o maior
// (ex.: "Seget/Cosen/SAD/TSE"); às vezes uma sigla só, às vezes o nome de um
// gabinete de ministro. O cruzamento com a árvore de unidades (por SIGLA) fica
// em agregarUnidades.js — aqui só extraímos as linhas cruas.
//
// O parsing usa as coordenadas x/y de cada trecho de texto (pdfjs-dist): as
// âncoras das colunas saem do cabeçalho, então mesmo com a diagramação
// irregular do PDF a coluna "Alocação" é recuperada de forma confiável
// (~98% das linhas numeradas).
import { writeFile, mkdir } from 'node:fs/promises';
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

/** Lê a página de listagem e devolve o link da competência mais recente. */
export async function descobrirArquivoMaisRecente(html) {
  const links = [...html.matchAll(/href="([^"]*dados-cts[^"]*)"/gi)].map((m) => m[1]);
  let melhor = null;
  for (const href of links) {
    const slug = semAcento(decodeURIComponent(href)).toLowerCase();
    const m = slug.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[-_ ]+(\d{4})/);
    if (!m) continue;
    const mes = MESES.indexOf(m[1]) + 1;
    const ano = Number(m[2]);
    const chave = ano * 12 + mes;
    if (!melhor || chave > melhor.chave) melhor = { href, mes, ano, chave };
  }
  if (!melhor) throw new Error('Nenhum link de arquivo mensal reconhecido na página de listagem.');
  return {
    href: melhor.href,
    competencia: { mes: melhor.mes, ano: melhor.ano, rotulo: `${MESES_ROTULO[melhor.mes - 1]}/${melhor.ano}` },
  };
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

async function main() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const saida = path.join(raiz, 'data/tse_terceirizados.json');

  console.log('Buscando a competência mais recente…');
  const htmlListagem = await (await fetch(PAGINA_LISTAGEM)).text();
  const { href, competencia } = await descobrirArquivoMaisRecente(htmlListagem);
  console.log(`  competência: ${competencia.rotulo}`);
  console.log(`  arquivo: ${href}`);

  const respPdf = await fetch(href, { redirect: 'follow' });
  if (!respPdf.ok) throw new Error(`Falha ao baixar o PDF (${respPdf.status}).`);
  const buffer = new Uint8Array(await respPdf.arrayBuffer());
  console.log(`  ${(buffer.length / 1024).toFixed(0)} KB baixados, parseando…`);

  const registros = await parsePdfTerceirizados(buffer);
  const comAlocacao = registros.filter((r) => r.alocacao).length;
  console.log(`  ${registros.length} profissionais · ${comAlocacao} com alocação`);

  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: PAGINA_LISTAGEM,
    arquivoUrl: href,
    competencia,
    total: registros.length,
    registros,
  };
  await mkdir(path.dirname(saida), { recursive: true });
  await writeFile(saida, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Gravado ${saida}`);
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
