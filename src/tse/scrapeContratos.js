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

const BASE = 'https://contratos.comprasnet.gov.br/transparencia';

// Índices de coluna na resposta do DataTables (ver data/discovery/page-*.html,
// bloco <thead>, e README para como foram descobertos).
const COL = {
  ORGAO: 0,
  UNIDADE: 1,
  NUMERO: 5,
  UNIDADE_REALIZADORA: 7,
  FORNECEDOR: 15,
  PROCESSO: 16,
  OBJETO: 17,
  VIG_INICIO: 19,
  VIG_FIM: 20,
  VALOR_GLOBAL: 21,
  RESPONSAVEIS: 33,
  ACOES: 38,
};

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValorBRL(texto) {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(limpo);
  return Number.isFinite(valor) ? valor : 0;
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

function linhaParaContrato(row) {
  return {
    id: idDoContrato(row[COL.ACOES]),
    numero: stripHtml(row[COL.NUMERO]),
    processo: stripHtml(row[COL.PROCESSO]),
    objeto: stripHtml(row[COL.OBJETO]),
    fornecedor: stripHtml(row[COL.FORNECEDOR]),
    valorGlobal: parseValorBRL(stripHtml(row[COL.VALOR_GLOBAL])),
    vigenciaInicio: stripHtml(row[COL.VIG_INICIO]),
    vigenciaFim: stripHtml(row[COL.VIG_FIM]),
    orgao: stripHtml(row[COL.ORGAO]),
    unidade: stripHtml(row[COL.UNIDADE]),
    responsaveis: parseResponsaveis(row[COL.RESPONSAVEIS]),
  };
}

async function obterSessao() {
  const res = await fetch(`${BASE}/contratos?unidade=TSE`);
  if (!res.ok) throw new Error(`Falha ao abrir página inicial (status ${res.status})`);
  const html = await res.text();
  const csrfMatch = html.match(/name="csrf-token" content="([^"]+)"/);
  if (!csrfMatch) throw new Error('Token CSRF não encontrado na página — layout pode ter mudado.');
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
  return { csrf: csrfMatch[1], cookieHeader };
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

async function scrapeContratos(unidade = 'TSE', { pageSize = 200, onProgress } = {}) {
  const sessao = await obterSessao();
  const primeira = await buscarPagina(sessao, unidade, 0, pageSize);
  const total = primeira.recordsFiltered;
  const linhas = [...primeira.data];
  onProgress?.(linhas.length, total);

  for (let start = pageSize; start < total; start += pageSize) {
    const pagina = await buscarPagina(sessao, unidade, start, pageSize);
    linhas.push(...pagina.data);
    onProgress?.(linhas.length, total);
  }

  return linhas.map(linhaParaContrato);
}

async function main() {
  const unidade = process.argv[2] ?? 'TSE';
  const out = process.argv[3] ?? 'data/tse_contratos.json';

  console.log(`Extraindo contratos da unidade ${unidade}...`);
  const contratos = await scrapeContratos(unidade, {
    onProgress: (feitos, total) => process.stdout.write(`\r${feitos}/${total} contratos`),
  });
  console.log();

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(contratos, null, 2), 'utf8');
  console.log(`Salvo em ${out} (${contratos.length} contratos).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Falha na extração:', err);
    process.exit(1);
  });
}

export { scrapeContratos, linhaParaContrato, parseValorBRL, parseResponsaveis, stripHtml };
