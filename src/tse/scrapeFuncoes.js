// Extrai o histórico de funções comissionadas (FC-1 a FC-6) e cargos em
// comissão (CJ-1 a CJ-4) do TSE a partir do índice oficial de legislação
// compilada: https://www.tse.jus.br/legislacao/compilada/prt.
//
// Descoberta (confirmada por fetch direto contra a fonte real):
// - `.../prt/{ano}` é HTML estático com uma única tabela `Portaria |
//   Ementa/Assunto`, uma linha por portaria do ano — dá pra pré-filtrar pela
//   ementa sem abrir cada portaria.
// - `.../prt/{ano}/portaria-no-N-de-D-de-MES-de-ANO` (o link de cada linha)
//   também é HTML estático, com o texto integral em `.leg-compilada-corpo`.
//   Uma portaria tanto pode "Ficar dispensados"/"Ficar designados" uma lista
//   numerada (I, II, III...) quanto ter a forma direta de item único ("Art.
//   1º Fica exonerada Fulano, ..., do Cargo em Comissão de..., Nível CJ-3,
//   ..."). A data de vigência real vem do rodapé `.leg-compilada-referencia`
//   ("DOU, nº X, Seção 2, de D.M.AAAA") — a maioria das portarias só diz
//   "entra em vigor na data de sua publicação".
// - Ementas com "substitu" (cobertura eventual de férias/licença, com
//   período já na própria ementa) não são função comissionada titular e são
//   excluídas do filtro de candidatas.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripHtml } from './scrapeContratos.js';

const BASE = 'https://www.tse.jus.br/legislacao/compilada/prt';

const REGEX_RELEVANTE = /fun[cç][aã]o comissionada|cargo em comiss[aã]o/i;
const REGEX_EXCLUIR = /substitu/i;

const MESES = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARÇO: 3,
  MARCO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
};

/** Uma linha da tabela de portarias de um ano: link + ementa. */
function listarLinhas(html) {
  const linhas = [...html.matchAll(
    /<tr>\s*<td>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g,
  )];
  return linhas.map(([, url, , ementaHtml]) => ({ url, ementa: stripHtml(ementaHtml) }));
}

async function listarPortariasDoAno(ano) {
  const res = await fetch(`${BASE}/${ano}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Falha ao listar portarias de ${ano} (status ${res.status})`);
  const html = await res.text();
  return listarLinhas(html);
}

function candidatasRelevantes(linhas) {
  return linhas.filter((l) => REGEX_RELEVANTE.test(l.ementa) && !REGEX_EXCLUIR.test(l.ementa));
}

function extrairPortariaRef(html, url) {
  // O dia 1º do mês é escrito por extenso com o indicador ordinal ("1º"),
  // não "01" — daí o "º|°" opcional entre o número e "DE". O símbolo depois
  // de "N" também varia na fonte entre "º" (ordinal) e "°" (grau).
  const m = html.match(
    /<h1>\s*PORTARIA\s*N(?:º|°)\s*([^,<]+),\s*DE\s*(\d{1,2})\s*(?:º|°)?\s*DE\s*([A-ZÇ]+)\s*DE\s*(\d{4})\s*<\/h1>/i,
  );
  if (!m) return { numero: null, ano: null, data: null, url };
  const [, numero, dia, mesNome, ano] = m;
  const mes = MESES[mesNome.toUpperCase()];
  const data = mes ? `${ano}-${String(mes).padStart(2, '0')}-${dia.padStart(2, '0')}` : null;
  return { numero: numero.trim(), ano: Number(ano), data, url };
}

function extrairCorpoTexto(html) {
  const m =
    html.match(/<div class="leg-compilada-corpo">([\s\S]*?)<div class="leg-compilada-referencia"/) ||
    html.match(/<div class="leg-compilada-corpo">([\s\S]*?)<\/section>/);
  return m ? m[1] : '';
}

function extrairDataDOU(html) {
  const m = html.match(/<div class="leg-compilada-referencia">([\s\S]*?)<\/div>/);
  if (!m) return null;
  const texto = stripHtml(m[1]);
  const dataMatch = texto.match(/de\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dataMatch) return null;
  const [, d, mo, y] = dataMatch;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Regra de nível (FC-1..FC-6 / CJ-1..CJ-4): valida a faixa; fora dela é
// tratado como ruído de parsing (ex.: erro de digitação na fonte) e ignorado.
const NIVEL_MAX = { FC: 6, CJ: 4 };

/**
 * Interpreta o corpo de uma portaria como uma sequência de parágrafos. Cada
 * parágrafo é uma de três coisas: (a) um cabeçalho puro que só define o modo
 * corrente ("Art. 1º Ficam dispensados:"), (b) um item de lista numerada
 * (I, II, III...) que herda o modo do cabeçalho anterior, ou (c) uma sentença
 * combinada que já traz o verbo e o item na mesma frase ("Art. 1º Fica
 * exonerada Fulano, ..., Nível CJ-3, ..."). Nos três casos o verbo
 * (dispensa/exonera → fim; designa/nomeia → início) é buscado no próprio
 * parágrafo quando presente, senão herda do último encontrado.
 */
function extrairMovimentos(html, portariaRef) {
  const corpo = extrairCorpoTexto(html);
  const paragrafos = [...corpo.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => stripHtml(m[1]));
  const dataEfetiva = extrairDataDOU(html) ?? portariaRef.data;

  let modoAtual = null;
  const movimentos = [];

  for (const paragrafo of paragrafos) {
    // Duas redações equivalentes na fonte: a forma passiva ("Fica(m)
    // dispensado(s)/designados") e, em portarias mais novas, o imperativo
    // logo após o número do artigo ("Art. 1º Dispensar Fulano..." / "Art. 2º
    // Designar:").
    const verbMatch = paragrafo.match(
      /Fica(?:m)?\s+(dispensad[oa]s?|exonerad[oa]s?|designad[oa]s?|nomead[oa]s?)|Art\.?\s*\d+º?\s*(Dispensar|Exonerar|Designar|Nomear)\b/i,
    );
    let itemTexto;
    if (verbMatch) {
      const verbo = verbMatch[1] ?? verbMatch[2];
      modoAtual = /dispens|exonera/i.test(verbo) ? 'fim' : 'inicio';
      itemTexto = paragrafo.slice(verbMatch.index + verbMatch[0].length).replace(/^\s*:\s*/, '').trim();
    } else {
      itemTexto = paragrafo.replace(/^[IVXLCDM]+\s*-\s*/, '').trim();
    }
    if (!itemTexto || !modoAtual) continue;

    const nivelMatch = itemTexto.match(
      /(?:Fun[cç][aã]o Comissionada de|Cargo em Comiss[aã]o de)\s*([^,]+),\s*N[ií]vel\s*(FC|CJ)[\s-]*?(\d)/i,
    );
    if (!nivelMatch) continue;
    // Alguns itens trazem uma cláusula em minúsculas antes do nome ("I - a
    // pedido, Fulano de Tal, ..."). O nome de pessoa sempre começa com
    // maiúscula, então uma eventual cláusula inicial em minúscula é pulada.
    const nomeMatch = itemTexto.match(/^(?:[a-zà-ÿ][^,]*,\s*)?([A-ZÀ-Ý][^,]+),/);
    if (!nomeMatch) continue;

    const func = nivelMatch[2].toUpperCase();
    const nivel = Number(nivelMatch[3]);
    if (nivel < 1 || nivel > NIVEL_MAX[func]) continue;

    const fimNivel = nivelMatch.index + nivelMatch[0].length;
    const unidade = itemTexto
      .slice(fimNivel)
      .replace(/^,\s*/, '')
      .replace(/[;.]\s*$/, '')
      .trim();

    movimentos.push({
      tipo: modoAtual,
      func,
      nivel,
      cargoTitulo: nivelMatch[1].trim(),
      unidade,
      nome: nomeMatch[1].trim(),
      portaria: portariaRef,
      dataEfetiva,
    });
  }

  return movimentos;
}

// TODO (melhorias futuras, ver README):
// 1) A busca dos índices de ano (linha "for (let ano = ...)" abaixo) é
//    sequencial — só a busca do detalhe de cada portaria é paralelizada
//    (lotes de `concurrency`). Paralelizar também os índices de ano
//    reduziria o tempo do backfill histórico completo (1999–hoje).
// 2) Hoje toda execução reconsulta o índice de TODOS os anos, mesmo os já
//    encerrados (cujas portarias nunca mudam depois de publicadas). Guardar
//    quais anos já foram totalmente sincronizados e, numa atualização
//    incremental, só reconsultar o(s) ano(s) em aberto (atual e talvez o
//    anterior, por causa de publicação tardia no DOU) evitaria esse
//    trabalho redundante.
// 3) Nada é persistido em disco durante a execução — só no fim, quando a
//    função retorna (ver `main()` mais abaixo). Num backfill histórico de
//    dezenas de minutos, uma queda do processo no meio perde tudo. Salvar
//    parcialmente a cada lote (ex.: a cada N portarias baixadas) permitiria
//    retomar de onde parou, ou pelo menos perder pouco progresso.
async function scrapeFuncoes({
  anoInicio = 1999,
  anoFim = new Date().getFullYear(),
  concurrency = 5,
  cacheMovimentos,
  onProgress,
} = {}) {
  const porUrl = new Map();
  if (Array.isArray(cacheMovimentos)) {
    for (const mv of cacheMovimentos) {
      const lista = porUrl.get(mv.portaria.url) ?? [];
      lista.push(mv);
      porUrl.set(mv.portaria.url, lista);
    }
  }

  const candidatasTotais = [];
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    const linhas = await listarPortariasDoAno(ano);
    candidatasTotais.push(...candidatasRelevantes(linhas));
  }

  const novas = candidatasTotais.filter((c) => !porUrl.has(c.url));
  const total = candidatasTotais.length;
  let feitos = total - novas.length;
  onProgress?.(feitos, total);

  for (let i = 0; i < novas.length; i += concurrency) {
    const lote = novas.slice(i, i + concurrency);
    const resultados = await Promise.all(
      lote.map(async (c) => {
        const res = await fetch(c.url);
        if (!res.ok) throw new Error(`Falha ao buscar ${c.url} (status ${res.status})`);
        const html = await res.text();
        const portariaRef = extrairPortariaRef(html, c.url);
        return { url: c.url, movimentos: extrairMovimentos(html, portariaRef) };
      }),
    );
    for (const r of resultados) {
      // Marcador "vazio": a ementa bateu no filtro mas nenhum item foi
      // extraído (ex.: portaria que só cria/extingue a função, sem
      // designação de pessoa) — registrado para não reprocessar essa
      // portaria em execuções futuras.
      porUrl.set(r.url, r.movimentos.length ? r.movimentos : [{ vazio: true, portaria: { url: r.url } }]);
    }
    feitos += lote.length;
    onProgress?.(Math.min(feitos, total), total);
  }

  return [...porUrl.values()].flat().filter((m) => !m.vazio);
}

async function main() {
  const anoInicio = process.argv[2] ? Number(process.argv[2]) : 1999;
  const anoFim = process.argv[3] ? Number(process.argv[3]) : new Date().getFullYear();
  const out = process.argv[4] ?? 'data/tse_funcoes.json';

  let cacheExistente;
  try {
    cacheExistente = JSON.parse(await readFile(out, 'utf8'));
  } catch {
    // sem cache prévio
  }

  console.log(`Extraindo funções comissionadas de ${anoInicio} a ${anoFim}...`);
  const movimentos = await scrapeFuncoes({
    anoInicio,
    anoFim,
    cacheMovimentos: cacheExistente,
    onProgress: (feitos, total) => process.stdout.write(`\r${feitos}/${total} portarias`),
  });
  console.log();

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(movimentos, null, 2), 'utf8');
  console.log(`Salvo em ${out} (${movimentos.length} movimentos).`);
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

export {
  scrapeFuncoes,
  listarPortariasDoAno,
  listarLinhas,
  candidatasRelevantes,
  extrairPortariaRef,
  extrairMovimentos,
};
