// Extrai os contratos de uma unidade (ex.: TSE) direto da API server-side
// (DataTables/Backpack CRUD) que alimenta a página pública de transparência
// https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=<unidade>.
//
// Descoberta: a página usa jQuery DataTables com `serverSide: true` fazendo
// POST para /transparencia/contratos/search?unidade=<unidade>, retornando JSON
// no formato padrão do DataTables ({ draw, recordsTotal, recordsFiltered, data }),
// onde cada célula de `data` é um fragmento HTML (a mesma marcação renderizada
// na tabela visível, incluindo uma tabela aninhada com CPF/Nome/Tipo na coluna
// "Responsáveis" — exatamente os fiscais/gestores do contrato).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://contratos.comprasnet.gov.br/transparencia';

// Rótulo do <th> de cada campo que consumimos, no cabeçalho da tabela. Os
// índices na resposta do DataTables JÁ mudaram uma vez (o site inseriu colunas
// tipo "Situação", "PNCP", "Subcategoria" e tudo de ~21 em diante andou +1), por
// isso o mapa é derivado do <thead> em tempo de execução (mapearColunas) — o
// COL abaixo é só o fallback com o layout conhecido em 2026-09.
const COL_ROTULO = {
  ORGAO: 'Órgão',
  UNIDADE: 'Unidade da Prestação do Serviço',
  NUMERO: 'Número Contrato',
  UNIDADE_REALIZADORA: 'Unidade Realizadora da Compra',
  MODALIDADE: 'Modalidade da Compra',
  TIPO: 'Tipo',
  CATEGORIA: 'Categoria',
  FORNECEDOR: 'Fornecedor',
  PROCESSO: 'Processo',
  OBJETO: 'Objeto',
  VIG_INICIO: 'Vig. Início',
  VIG_FIM: 'Vig. Fim',
  VALOR_GLOBAL: 'Valor Global',
  EMPENHOS: 'Empenhos',
  RESPONSAVEIS: 'Responsáveis',
  ACOES: 'Ações',
};

const COL = {
  ORGAO: 0,
  UNIDADE: 1,
  NUMERO: 5,
  UNIDADE_REALIZADORA: 7,
  MODALIDADE: 9,
  TIPO: 12,
  CATEGORIA: 13,
  FORNECEDOR: 15,
  PROCESSO: 16,
  OBJETO: 17,
  VIG_INICIO: 19,
  VIG_FIM: 20,
  VALOR_GLOBAL: 22,
  EMPENHOS: 29,
  RESPONSAVEIS: 34,
  ACOES: 39,
};

/**
 * Deriva os índices de coluna do <thead> da página. O primeiro <thead> tem os
 * ~40 rótulos "de verdade" (um segundo <thead> clonado repete tudo). Se algum
 * rótulo esperado não for encontrado, cai no COL fixo com um aviso — melhor um
 * palpite do que quebrar, mas o aviso sinaliza que o layout mudou de novo.
 */
function mapearColunas(html) {
  const ths = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
  const col = {};
  const faltando = [];
  for (const [campo, rotulo] of Object.entries(COL_ROTULO)) {
    const i = ths.indexOf(rotulo);
    if (i === -1) faltando.push(rotulo);
    else col[campo] = i;
  }
  if (faltando.length) {
    console.warn(
      `[scrapeContratos] rótulos não achados no <thead> (${faltando.join(', ')}); ` +
      `usando índices fixos de 2026-09. Cabeçalho atual: ${ths.slice(0, 45).join(' | ')}`,
    );
    return COL;
  }
  return col;
}

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValorBRL(texto) {
  const limpo = (texto || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(limpo);
  return Number.isFinite(valor) ? valor : 0;
}

function parseEmpenhos(cellHtml) {
  const trMatches = [...(cellHtml || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let valorEmpenhado = 0;
  let valorPago = 0;

  for (const tr of trMatches) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripHtml(m[1]));
    if (tds.length >= 8) {
      const emp = parseValorBRL(tds[4]);
      const pg = parseValorBRL(tds[7]);
      const rpPg = tds.length >= 12 ? parseValorBRL(tds[11]) : 0;
      valorEmpenhado += emp;
      valorPago += (pg + rpPg);
    }
  }

  return { valorEmpenhado, valorPago };
}

function parseResponsaveis(cellHtml) {
  const linhas = [...(cellHtml || '').matchAll(
    /<tr>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/g,
  )];
  return linhas.map(([, cpf, nome, papel]) => ({
    // TSE não expõe matrícula funcional nessa view pública; o CPF mascarado
    // (ex.: ***.724.491-**) já identifica a pessoa de forma estável, então
    // usamos como `matricula` para fins de deduplicação em rankResponsaveis.
    matricula: stripHtml(cpf),
    nome: stripHtml(nome),
    papel: stripHtml(papel),
  }));
}

function idDoContrato(acoesHtml) {
  const m = (acoesHtml || '').match(/\/transparencia\/contratos\/(\d+)/);
  return m ? m[1] : undefined;
}

function linhaParaContrato(row, col = COL) {
  const { valorEmpenhado, valorPago } = parseEmpenhos(row[col.EMPENHOS]);
  return {
    id: idDoContrato(row[col.ACOES]),
    numero: stripHtml(row[col.NUMERO]),
    processo: stripHtml(row[col.PROCESSO]),
    objeto: stripHtml(row[col.OBJETO]),
    modalidade: stripHtml(row[col.MODALIDADE]),
    tipo: stripHtml(row[col.TIPO]),
    categoria: stripHtml(row[col.CATEGORIA]),
    fornecedor: stripHtml(row[col.FORNECEDOR]),
    valorGlobal: parseValorBRL(stripHtml(row[col.VALOR_GLOBAL])),
    valorEmpenhado,
    valorPago,
    vigenciaInicio: stripHtml(row[col.VIG_INICIO]),
    vigenciaFim: stripHtml(row[col.VIG_FIM]),
    orgao: stripHtml(row[col.ORGAO]),
    unidade: stripHtml(row[col.UNIDADE]),
    responsaveis: parseResponsaveis(row[col.RESPONSAVEIS]),
  };
}

/**
 * Sanidade pós-parse: se a coluna deslocar de novo, os valores saem "quase
 * plausíveis" (nome com CPF grudado, papel virando nome). Aborta em vez de
 * gravar lixo no cache.
 */
function validarAmostra(contratos) {
  const amostra = contratos.slice(0, 30);
  if (amostra.length === 0) return;
  const semId = amostra.filter((c) => !c.id).length;
  if (semId > amostra.length / 2) throw new Error('coluna "Ações" não trouxe id do contrato — layout mudou.');
  // Papel real nunca tem dígito nem CPF; nome nunca tem CPF grudado. Quando a
  // coluna "Responsáveis" desloca, é isso que aparece.
  const respRuins = amostra
    .flatMap((c) => c.responsaveis)
    .filter((r) => /\d/.test(r.papel || '') || /\*\*\*/.test(r.papel || '') || /\*\*\*/.test(r.nome || ''));
  if (respRuins.length) {
    throw new Error(
      `coluna "Responsáveis" parece ter deslocado — ex.: ${JSON.stringify(respRuins[0])}`,
    );
  }
  const comValor = amostra.filter((c) => c.valorGlobal > 0).length;
  if (comValor === 0) throw new Error('nenhum contrato da amostra tem Valor Global > 0 — coluna pode ter deslocado.');
}

async function obterSessao() {
  const res = await fetch(`${BASE}/contratos?unidade=TSE`);
  if (!res.ok) throw new Error(`Falha ao abrir página inicial (status ${res.status})`);
  const html = await res.text();
  const csrfMatch = html.match(/name="csrf-token" content="([^"]+)"/);
  if (!csrfMatch) throw new Error('Token CSRF não encontrado na página — layout pode ter mudado.');
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
  return { csrf: csrfMatch[1], cookieHeader, col: mapearColunas(html) };
}

async function buscarPagina({ csrf, cookieHeader }, unidade, start, length) {
  const body = new URLSearchParams({ draw: '1', start: String(start), length: String(length) });
  const res = await fetch(`${BASE}/contratos/search?unidade=${encodeURIComponent(unidade)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrf,
      Cookie: cookieHeader,
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Falha na busca (status ${res.status})`);
  return res.json();
}

async function scrapeContratos(
  unidade = 'TSE',
  { pageSize = 200, concurrency = 4, cacheContratos, onProgress } = {},
) {
  const sessao = await obterSessao();
  const primeira = await buscarPagina(sessao, unidade, 0, pageSize);
  const total = primeira.recordsFiltered;
  const primeiraContratos = primeira.data.map((row) => linhaParaContrato(row, sessao.col));
  validarAmostra(primeiraContratos);

  // Verificação incremental: se já temos cache com a mesma quantidade total
  // e todos os contratos mais recentes da página 0 batem, reutilizamos o cache
  // apenas atualizando eventuais edições da página 0.
  if (Array.isArray(cacheContratos) && cacheContratos.length === total) {
    const idsCache = new Set(cacheContratos.map((c) => c.id));
    const todosPrimeiraExistem = primeiraContratos.every((c) => idsCache.has(c.id));

    if (todosPrimeiraExistem) {
      onProgress?.(total, total);
      const mapa = new Map(cacheContratos.map((c) => [c.id, c]));
      for (const c of primeiraContratos) {
        mapa.set(c.id, c);
      }
      return [...mapa.values()];
    }
  }

  const tarefas = [];
  for (let start = pageSize; start < total; start += pageSize) {
    tarefas.push(start);
  }

  const paginas = new Map();
  paginas.set(0, primeira.data);
  let feitos = primeira.data.length;
  onProgress?.(feitos, total);

  // Executa em lotes paralelos (concurrency) para máxima performance
  for (let i = 0; i < tarefas.length; i += concurrency) {
    const lote = tarefas.slice(i, i + concurrency);
    const resultados = await Promise.all(
      lote.map(async (start) => {
        const res = await buscarPagina(sessao, unidade, start, pageSize);
        return { start, data: res.data };
      }),
    );
    for (const r of resultados) {
      paginas.set(r.start, r.data);
      feitos += r.data.length;
    }
    onProgress?.(Math.min(feitos, total), total);
  }

  // Monta o resultado garantindo a ordem original das páginas
  const ordenados = [];
  for (let start = 0; start < total; start += pageSize) {
    const data = paginas.get(start);
    if (data) ordenados.push(...data);
  }

  const novosContratos = ordenados.map((row) => linhaParaContrato(row, sessao.col));

  if (Array.isArray(cacheContratos) && cacheContratos.length > 0) {
    const mapa = new Map(cacheContratos.map((c) => [c.id, c]));
    for (const c of novosContratos) {
      mapa.set(c.id, c);
    }
    return [...mapa.values()];
  }

  return novosContratos;
}

async function main() {
  const unidade = process.argv[2] ?? 'TSE';
  const out = process.argv[3] ?? 'data/tse_contratos.json';

  let cacheExistente;
  try {
    const { readFile } = await import('node:fs/promises');
    cacheExistente = JSON.parse(await readFile(out, 'utf8'));
  } catch {
    // sem cache prévio
  }

  console.log(`Extraindo contratos da unidade ${unidade}...`);
  const contratos = await scrapeContratos(unidade, {
    cacheContratos: cacheExistente,
    onProgress: (feitos, total) => process.stdout.write(`\r${feitos}/${total} contratos`),
  });
  console.log();

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(contratos, null, 2), 'utf8');
  console.log(`Salvo em ${out} (${contratos.length} contratos).`);
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
  scrapeContratos,
  linhaParaContrato,
  parseValorBRL,
  parseEmpenhos,
  parseResponsaveis,
  stripHtml,
  mapearColunas,
  validarAmostra,
  COL,
  COL_ROTULO,
};
