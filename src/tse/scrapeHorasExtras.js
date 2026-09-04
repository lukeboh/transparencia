// Extrai o VALOR pago na rubrica "HORAS EXTRAS" de cada contracheque do
// "Anexo VIII - Detalhamento da Folha de Pagamento de Pessoal" do TSE, mês a
// mês, para inferir a QUANTIDADE de horas extras (ver src/tse/horasExtras.js e
// src/tse/agregarHorasExtras.js).
//
// Fonte (iframe da página institucional de Remunerações):
//   https://transparencia.tse.jus.br/transparenciaDadosServidores/infoServidores?acao=Anexo_VIII
//
// Fluxo:
//   1. Formulário: escolhe mês/ano e clica "CONSULTA INDIVIDUALIZADA"
//      (pesquisar()) — devolve a listagem de ~1.000 servidores da competência
//      (NOME, CARGO, FC/CJ, BRUTO).  Essa etapa até funcionaria por fetch puro,
//      mas o passo seguinte NÃO:
//   2. Cada linha tem um link javascript:detalhamento(matricula, dep, NOME,
//      CARGO, FUNCAO, CLASSE, UNIDADE) que abre o contracheque detalhado por
//      rubrica.  O WAF (BIG-IP ASM) rejeita esse POST com 403 quando NOME tem
//      acento e outro campo vem preenchido — um navegador real passa, então
//      isso roda em Playwright (mesma dependência de src/tse/discover.js).
//
// O que guardamos por (competência, servidor):  só o necessário para o cálculo
// de horas — NUNCA a remuneração inteira:
//   { matricula, nome, cargo, funcao, classePadrao, unidade,
//     base,            // "VENCIMENTOS E VANTAGENS" + "EXERCÍCIO FC/CJ"
//                      //   + "REMUNERAÇÃO ÓRGÃO ORIGEM" (requisitado — ver parseContracheque)
//     componentes,     // { vv, fccj, origem } — a base aberta, para auditoria
//     valorRubrica,    // soma das linhas "HORAS EXTRAS [- MM/AAAA]"
//     rubricas: [{ ref, valor }] }   // uma por mês de referência (retroativos)
// Linhas sem "HORAS EXTRAS" > 0 são descartadas.
//
// Cache incremental por competência em data/tse_horas_extras.json (meses
// fechados nunca mudam) — igual a src/tse/scrapeTerceirizados.js.  O arquivo é
// regravado a cada competência concluída, então uma execução longa (backfill
// 2009→hoje) é retomável.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { chaveCompetencia } from './horasExtras.js';

const URL_FORM =
  'https://transparencia.tse.jus.br/transparenciaDadosServidores/infoServidores?acao=Anexo_VIII';

const MESES_ROTULO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "1.234,56" / "-" / "" → Number (0 quando não numérico). */
export function numeroBR(bruto) {
  if (bruto == null) return 0;
  const t = String(bruto).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extrai a base de cálculo e as horas extras do texto (innerText) de um
 * contracheque detalhado do Anexo VIII.
 *
 * base = "VENCIMENTOS E VANTAGENS" + "EXERCÍCIO FC/CJ" + "REMUNERAÇÃO ÓRGÃO ORIGEM"
 *
 * Para servidor REQUISITADO a remuneração básica é paga pelo órgão de origem —
 * no TSE "VENCIMENTOS E VANTAGENS" fica 0,00, aparece só "EXERCÍCIO FC/CJ" (a
 * função exercida aqui) e a remuneração de origem vem numa linha à parte, na
 * seção "LÍQUIDO", como "REMUNERAÇÃO ÓRGÃO ORIGEM". O serviço extraordinário é
 * calculado sobre a remuneração TOTAL (origem + função no TSE) e pago pelo TSE,
 * então essa linha PRECISA entrar na base (ex.: MAURO SANS JUNIOR, ago/2022:
 * VV 0,00 + FC/CJ 1.379,07 + órgão origem 18.799,87).
 *
 * Até ~2020 a hora extra vinha separada por tipo, em até 3 linhas por mês:
 *   "HORAS EXTRAS - DOMINGOS E FERIADOS - MM/AAAA"  (+100 %)
 *   "HORAS EXTRAS - DIAS ÚTEIS E SÁBADOS - MM/AAAA" (+50 %)
 *   "HORAS EXTRAS [- MM/AAAA]"                       (resíduo / linha única)
 * De 2022 em diante é só a linha única. Cada linha vira uma rubrica com o
 * `tipo` ('domingos' | 'uteis' | null) — quando conhecido, a estimativa de
 * horas fica exata (ver src/tse/horasExtras.js).
 *
 * @returns {{ base:number, valorRubrica:number,
 *            rubricas:{ref:string|null,valor:number,tipo:('domingos'|'uteis'|null)}[],
 *            componentes:{vv:number,fccj:number,origem:number} } | null}
 *   null quando a base fica <= 0 (contracheque não renderizado, ou requisitado
 *   sem remuneração de origem legível — não dá para estimar).
 */
export function parseContracheque(innerText) {
  const t = String(innerText).replace(/ /g, ' ').replace(/\s+/g, ' ');
  const valorDe = (re) => {
    const m = t.match(re);
    return m ? numeroBR(m[1]) : 0;
  };
  const vv = valorDe(/VENCIMENTOS E VANTAGENS\s+(-?[\d.,]+)/i);
  const fccj = valorDe(/EXERC[IÍ]CIO FC\/CJ\s+(-?[\d.,]+)/i);
  const origem = valorDe(/REMUNERA[ÇC][ÃA]O [ÓO]RG[ÃA]O ORIGEM\s+(-?[\d.,]+)/i);
  const base = vv + fccj + origem;

  const rubricasBrutas = [
    ...t.matchAll(/HORAS EXTRAS(?:\s*-\s*([A-ZÀ-Ú][^\d-]*?))??(?:\s*-\s*(\d{2}\/\d{4}))?\s+(-?[\d.,]+)/gi),
  ].map((m) => {
    const descr = (m[1] || '').toUpperCase();
    const tipo = /DOMINGO/.test(descr) ? 'domingos' : /[UÚ]TE/.test(descr) ? 'uteis' : null;
    return { ref: m[2] || null, valor: numeroBR(m[3]), tipo };
  });
  // Sob concorrência alta o bloco do contracheque às vezes é renderizado/lido
  // duas vezes — cada rubrica sai repetida idêntica (ref+valor+tipo). Colapsa
  // linhas EXATAMENTE iguais (uma correção retroativa nunca repõe o mesmo
  // centavo, mesmo tipo e mesmo mês de referência).
  const vistas = new Set();
  const rubricas = rubricasBrutas.filter((r) => {
    const k = `${r.ref}|${r.valor}|${r.tipo}`;
    return vistas.has(k) ? false : (vistas.add(k), true);
  });
  const valorRubrica = rubricas.reduce((s, r) => s + r.valor, 0);
  if (base <= 0) return null;
  return { base, valorRubrica, rubricas, componentes: { vv, fccj, origem } };
}

function competenciasNoIntervalo(desde, ate) {
  const [ad, md] = desde.split('-').map(Number);
  const [aa, ma] = ate.split('-').map(Number);
  const out = [];
  let ano = ad;
  let mes = md;
  while (ano < aa || (ano === aa && mes <= ma)) {
    out.push({ ano, mes, chave: chaveCompetencia(ano, mes), rotulo: `${MESES_ROTULO[mes - 1]}/${ano}` });
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return out;
}

async function lerCache(saida) {
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

async function gravar(saida, porCompetencia, metaPorChave) {
  const competencias = [...metaPorChave.values()]
    .filter((c) => Array.isArray(porCompetencia[c.chave]))
    .sort((a, b) => a.chave.localeCompare(b.chave));
  const atual = competencias[competencias.length - 1] ?? null;
  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: URL_FORM,
    competenciaAtual: atual
      ? { mes: atual.mes, ano: atual.ano, chave: atual.chave, rotulo: atual.rotulo }
      : null,
    competencias,
    porCompetencia,
  };
  await mkdir(path.dirname(saida), { recursive: true });
  await writeFile(saida, JSON.stringify(payload, null, 2), 'utf8');
}

/** Coleta os argumentos de cada link javascript:detalhamento(...) da listagem. */
async function coletarLinhas(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[href^="javascript:detalhamento("]')]
      .map((a) => a.getAttribute('href').match(/detalhamento\((.*)\)/s)?.[1])
      .filter(Boolean)
      .map((argstr) => {
        const p = argstr.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        return { matricula: p[0], dependente: p[1], nome: p[2], cargo: p[3], funcao: p[4], classePadrao: p[5], unidade: p[6] };
      }),
  );
}

const NAV_TIMEOUT = 25_000;

/** Navega o formulário até a listagem completa da competência. */
async function abrirListagem(page, { ano, mes }) {
  await page.goto(URL_FORM, { waitUntil: 'domcontentloaded' });
  await page.selectOption('select[name="mes"]', String(mes));
  await page.selectOption('select[name="ano"]', String(ano));
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {}),
    page.evaluate(() => pesquisar()),
  ]);

  const total = await page.evaluate(
    () => Number((document.body.innerText.match(/Total de registros:\s*([\d.]+)/) || [])[1]?.replace(/\./g, '') || 0),
  );
  if (!total) return { total: 0, linhas: [] };

  const temOpcaoTodos = await page.evaluate((total) => {
    const sel = document.querySelector('select[name="qtdeRegistrosPorPagina"]');
    return !!sel && [...sel.options].some((o) => o.value === String(total));
  }, total);

  let linhas = [];
  if (temOpcaoTodos) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {}),
      page.selectOption('select[name="qtdeRegistrosPorPagina"]', String(total)),
    ]);
    linhas = await coletarLinhas(page);
  } else {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {}),
      page.selectOption('select[name="qtdeRegistrosPorPagina"]', '100'),
    ]);
    const paginas = Math.ceil(total / 100);
    for (let pg = 1; pg <= paginas; pg++) {
      if (pg > 1) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {}),
          page.evaluate((pg) => paginacao(pg), pg),
        ]);
      }
      linhas.push(...(await coletarLinhas(page)));
    }
    const vistos = new Set();
    linhas = linhas.filter((l) => (vistos.has(l.matricula) ? false : vistos.add(l.matricula)));
  }
  return { total, linhas };
}

/** Abre o contracheque de uma linha e devolve o registro (ou null se HE == 0). */
async function processarLinha(page, l) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {}),
    page.evaluate(
      (l) => detalhamento(l.matricula, l.dependente, l.nome, l.cargo, l.funcao, l.classePadrao, l.unidade),
      l,
    ),
  ]);
  const texto = await page.evaluate(() => document.body.innerText);
  const cc = parseContracheque(texto);
  if (!cc || cc.valorRubrica <= 0) return null;
  return {
    matricula: l.matricula,
    nome: l.nome,
    cargo: l.cargo,
    funcao: (l.funcao || '').trim() || null,
    classePadrao: (l.classePadrao || '').trim() || null,
    unidade: l.unidade,
    base: cc.base,
    // Composição da base — para auditar o caso do requisitado (órgão origem).
    componentes: cc.componentes,
    valorRubrica: cc.valorRubrica,
    rubricas: cc.rubricas,
  };
}

/**
 * Uma competência: lista todos os servidores e expande cada contracheque com
 * `concorrencia` workers. Cada worker tem seu PRÓPRIO contexto (cookies/sessão
 * isolados) — os detalhes do Anexo VIII compartilham estado por sessão no
 * servidor, então N páginas na mesma sessão embaralhavam/duplicavam blocos.
 * Devolve só as linhas com HORAS EXTRAS > 0.
 *
 * `amostra` (> 0) limita quantas linhas são visitadas — para uma prévia rápida;
 * `onProgresso(feitas, total)` é chamado a cada linha processada.
 */
async function rasparCompetencia(browser, comp, { concorrencia = 3, amostra = 0, onProgresso } = {}) {
  const lead = await browser.newContext({ ignoreHTTPSErrors: true });
  const leadPage = await lead.newPage();
  leadPage.setDefaultNavigationTimeout(60_000);
  const { total, linhas: todas } = await abrirListagem(leadPage, comp);
  const linhas = amostra > 0 ? todas.slice(0, amostra) : todas;
  if (linhas.length === 0) {
    await lead.close();
    return { registros: [], total };
  }

  const n = Math.max(1, Math.min(concorrencia, linhas.length));
  const workers = [{ context: lead, page: leadPage }];
  for (let i = 1; i < n; i++) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60_000);
    await abrirListagem(page, comp);
    workers.push({ context, page });
  }

  const registros = [];
  let feitas = 0;
  await Promise.all(
    workers.map(async ({ page }, w) => {
      for (let i = w; i < linhas.length; i += n) {
        const l = linhas[i];
        try {
          const reg = await processarLinha(page, l);
          if (reg) registros.push(reg);
        } catch (err) {
          console.warn(`\n    ⚠ ${comp.rotulo} · ${l.nome}: ${err.message}`);
        }
        feitas += 1;
        if (onProgresso) onProgresso(feitas, linhas.length);
      }
    }),
  );

  for (const { context } of workers) await context.close();
  registros.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { registros, total };
}

async function main() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const saida = path.join(raiz, 'data/tse_horas_extras.json');
  const args = process.argv.slice(2);
  const opt = (nome, padrao) => {
    const i = args.findIndex((a) => a === `--${nome}` || a.startsWith(`--${nome}=`));
    if (i === -1) return padrao;
    const a = args[i];
    return a.includes('=') ? a.split('=')[1] : args[i + 1];
  };
  const refazer = args.includes('--refazer');
  const desde = opt('desde', '2009-01');
  const hoje = new Date();
  const ate = opt('ate', chaveCompetencia(hoje.getFullYear(), hoje.getMonth() + 1));
  const limite = Number(opt('limite', Infinity));
  const concorrencia = Math.max(1, Number(opt('concorrencia', 3)) || 3);
  const amostra = Math.max(0, Number(opt('amostra', 0)) || 0);
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

  let alvos = competenciasNoIntervalo(desde, ate);
  if (Number.isFinite(limite)) alvos = alvos.slice(-limite);

  const cache = refazer ? { porCompetencia: {}, competencias: [] } : await lerCache(saida);
  const porCompetencia = { ...cache.porCompetencia };
  const metaPorChave = new Map(cache.competencias.map((c) => [c.chave, c]));

  // Uma competência já em cache é pulada — MENOS quando foi gravada só como
  // amostra (`--amostra`) e a execução atual quer a competência inteira: nesse
  // caso é refeita, para uma prévia parcial não "envenenar" o backfill real.
  const ehParcial = (chave) => (metaPorChave.get(chave)?.amostra ?? 0) > 0;
  const pendentes = alvos.filter(
    (c) =>
      refazer ||
      !Array.isArray(porCompetencia[c.chave]) ||
      (ehParcial(c.chave) && amostra === 0),
  );
  console.log(
    `Anexo VIII — horas extras: ${alvos.length} competência(s) de ${desde} a ${ate}, ` +
    `${pendentes.length} pendente(s)${amostra ? ` · amostra ${amostra}/competência` : ''}.`,
  );
  if (pendentes.length === 0) return;

  const browser = await chromium.launch(proxy ? { headless: true, proxy: { server: proxy } } : { headless: true });

  try {
    for (const comp of pendentes) {
      const t0 = Date.now();
      process.stdout.write(`  ${comp.rotulo}: `);
      const { registros, total } = await rasparCompetencia(browser, comp, {
        concorrencia,
        amostra,
        onProgresso: (feitas, tot) => {
          if (feitas % 50 === 0 || feitas === tot) {
            process.stdout.write(`\r  ${comp.rotulo}: ${feitas}/${tot}   `);
          }
        },
      });
      porCompetencia[comp.chave] = registros;
      metaPorChave.set(comp.chave, {
        mes: comp.mes,
        ano: comp.ano,
        chave: comp.chave,
        rotulo: comp.rotulo,
        totalRegistros: total,
        comHorasExtras: registros.length,
        // > 0 marca a competência como PARCIAL (só as N primeiras linhas) — um
        // backfill sem --amostra a refaz por inteiro.
        amostra: amostra || undefined,
        extraidoEm: new Date().toISOString(),
      });
      await gravar(saida, porCompetencia, metaPorChave);
      console.log(`\r  ${comp.rotulo}: ${registros.length}/${total}${amostra ? ` (amostra ${amostra})` : ''} com horas extras · ${((Date.now() - t0) / 1000).toFixed(0)}s        `);
    }
  } finally {
    await browser.close();
  }

  const comHE = Object.values(porCompetencia).reduce((s, r) => s + r.length, 0);
  console.log(`Gravado ${saida} — ${metaPorChave.size} competência(s), ${comHE} contracheques com horas extras.`);
}

const isMain = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase(),
);
if (isMain) {
  main().catch((err) => {
    console.error('Falha ao raspar horas extras:', err);
    process.exit(1);
  });
}

export { rasparCompetencia, competenciasNoIntervalo };
