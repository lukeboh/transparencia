// Cruza data/tse_contratos.json (fonte: Compras.gov.br) contra um export CSV
// da consulta de contratos do SIAC (https://siac-consultas.tse.jus.br/main/contratos/listar)
// para levantar candidatos a exceção — contratos cujo valor diverge de forma
// suspeita entre as duas fontes.
//
// A consulta do SIAC exige captcha, então não há scrape automático: o export
// CSV é obtido manualmente (usuário resolve o captcha na consulta "listar" e
// exporta) e passado como argumento aqui. Este script só gera um relatório em
// Markdown com os candidatos — NÃO grava excecoes.json sozinho, porque o
// valor "valorAtualizado" do CSV nem sempre é a verdade (ver seção de
// metodologia no relatório gerado: já achamos casos onde o valor "atualizado"
// do próprio SIAC também parecia errado). Cada candidato deve ser confirmado
// manualmente na página de detalhe do contrato antes de virar exceção.
//
// Uso: node src/tse/cruzarSiac.js <export-siac.csv> [tse_contratos.json] [saida.md]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvSiac } from './parseCsvSiac.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const LIMIAR_ABS = 10_000; // ignora divergências abaixo disso (valores simbólicos, arredondamento)
const LIMIAR_RAZAO = 20;

const STOPWORDS = new Set([
  'LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'S/A', 'DO', 'DA', 'DE', 'DOS', 'DAS', 'E',
  'COMERCIO', 'COMERCIAL', 'SERVICOS', 'SERVIÇOS', 'INDUSTRIA', 'INDUSTRIAL',
  // termos genéricos demais para desambiguar sozinhos (aparecem em várias
  // razões sociais/nomes de órgãos não relacionados) — só contam quando
  // batem junto de outro termo mais específico.
  'TECNOLOGIA', 'TECNOLOGIAS', 'INFORMATICA', 'SOLUCOES', 'SOLUÇÕES', 'SISTEMAS',
  'BRASIL', 'NACIONAL', 'GERAL', 'CENTRAL', 'INTERNET', 'DIGITAL', 'GRUPO',
  'ADMINISTRACAO', 'ADMINISTRAÇÃO', 'CONSULTORIA', 'EMPREENDIMENTOS', 'PARTICIPACOES', 'PARTICIPAÇÕES',
  'FEDERAL', 'TRIBUNAL', 'SUPERIOR', 'REGIONAL', 'JUSTICA', 'JUSTIÇA', 'ELEITORAL', 'ESTADO', 'ESTADUAL',
  'PUBLICO', 'PÚBLICO', 'PUBLICA', 'PÚBLICA', 'UNIAO', 'UNIÃO', 'MINISTERIO', 'MINISTÉRIO', 'SECRETARIA',
  'INSTITUTO', 'FUNDACAO', 'FUNDAÇÃO', 'CONSELHO', 'DEPARTAMENTO',
]);

function normalizarNome(s) {
  return (s || '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** true quando os nomes têm >=2 termos específicos em comum, ou 1 termo bem específico (>=6 letras) cobrindo a maior parte do nome menor. */
function nomesBatem(fornecedorNosso, contratadoSiac) {
  const a = new Set(normalizarNome(fornecedorNosso));
  const b = new Set(normalizarNome(contratadoSiac));
  if (a.size === 0 || b.size === 0) return false;
  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns++;
  if (comuns >= 2) return true;
  if (comuns === 1) {
    const comum = [...a].find((t) => b.has(t));
    return comum.length >= 6 && comuns / Math.min(a.size, b.size) >= 0.5;
  }
  return false;
}

function paraISO(dataBR) {
  if (!dataBR) return null;
  const [d, m, a] = dataBR.split('/');
  return `${a}-${m}-${d}`;
}

/** true quando a razão está a até 5% de uma potência de 10 (10, 100, 1000, ...) — assinatura típica de erro de vírgula/ponto decimal na extração. */
function razaoEhPotenciaDe10(razao) {
  if (!razao) return false;
  const log = Math.log10(razao);
  return Math.abs(log - Math.round(log)) <= 0.02 && Math.round(log) >= 1;
}

function urlSiac(numero, codigoFormaContratacao) {
  const [num, ano] = numero.split('/');
  // O id do SIAC é número (4 dígitos, zero-padded) + ano colados, ex.:
  // "00031/2015" -> "00312015". `numero` às vezes vem com 5 dígitos
  // ("00031") do nosso schema — precisa reparsear antes de colar com o ano.
  const numPadded = String(parseInt(num, 10)).padStart(4, '0');
  return `https://siac-consultas.tse.jus.br/main/contratos/detalhar/${numPadded}${ano}/${codigoFormaContratacao}`;
}

function urlComprasnet(id) {
  return `https://contratos.comprasnet.gov.br/transparencia/contratos/${id}`;
}

function brl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function cruzar(csvPath, jsonPath) {
  const linhasCsv = parseCsvSiac(await readFile(csvPath, 'utf8'));
  const header = linhasCsv[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const linhasSiac = linhasCsv.slice(1).map((campos) => {
    const numeroContrato = (campos[idx.numeroContrato] || '').trim();
    const ano = numeroContrato.slice(-4);
    const numero = String(parseInt(numeroContrato.slice(0, -4), 10) || 0);
    return {
      chave: `${numero}/${ano}`,
      codigoFormaContratacao: campos[idx.codigoFormaContratacao],
      contratado: campos[idx.contratado],
      valorAtualizado: parseFloat(campos[idx.valorAtualizado]) || 0,
      dataInicio: campos[idx.dataInicio],
      objetoContrato: campos[idx.objetoContrato],
    };
  });

  const porChave = new Map();
  for (const l of linhasSiac) {
    if (!porChave.has(l.chave)) porChave.set(l.chave, []);
    porChave.get(l.chave).push(l);
  }

  const contratos = JSON.parse(await readFile(jsonPath, 'utf8'));

  const chaveDoNosso = (numero) => {
    const [num, ano] = (numero || '').split('/');
    if (!num || !ano) return null;
    return `${parseInt(num, 10)}/${ano}`;
  };

  const stats = { total: contratos.length, semChave: 0, semCandidato: 0, semMatchConfiavel: 0, matchados: 0 };
  const divergencias = [];

  for (const c of contratos) {
    const chave = chaveDoNosso(c.numero);
    if (!chave) { stats.semChave++; continue; }
    const candidatos = porChave.get(chave);
    if (!candidatos || candidatos.length === 0) { stats.semCandidato++; continue; }

    const porNome = candidatos.filter((cand) => nomesBatem(c.fornecedor, cand.contratado));
    if (porNome.length === 0) { stats.semMatchConfiavel++; continue; }
    const porNomeEData = porNome.filter((cand) => paraISO(cand.dataInicio) === paraISO(c.vigenciaInicio));
    const escolhido = porNomeEData[0] ?? porNome[0];
    stats.matchados++;

    const nosso = c.valorGlobal || 0;
    const siac = escolhido.valorAtualizado || 0;
    const maior = Math.max(nosso, siac);
    if (maior < LIMIAR_ABS) continue;

    const razao = siac > 0 && nosso > 0 ? Math.max(nosso / siac, siac / nosso) : null;
    const zeroVsNaoZero = (nosso === 0) !== (siac === 0);

    if ((razao !== null && razao >= LIMIAR_RAZAO) || zeroVsNaoZero) {
      divergencias.push({
        id: c.id,
        numero: c.numero,
        codigoFormaContratacao: escolhido.codigoFormaContratacao,
        fornecedor: c.fornecedor,
        contratadoSiac: escolhido.contratado,
        nosso,
        siac,
        razao,
        zeroVsNaoZero,
        potenciaDe10: razaoEhPotenciaDe10(razao),
        objeto: c.objeto,
      });
    }
  }

  divergencias.sort((a, b) => Math.max(b.nosso, b.siac) - Math.max(a.nosso, a.siac));
  return { stats, divergencias };
}

function gerarMarkdown({ stats, divergencias }, csvPath) {
  const potencia10 = divergencias.filter((d) => d.potenciaDe10 && !d.zeroVsNaoZero);
  const zeroVsNaoZero = divergencias.filter((d) => d.zeroVsNaoZero);
  const outras = divergencias.filter((d) => !d.potenciaDe10 && !d.zeroVsNaoZero);

  const linhaContrato = (d) => {
    const siacUrl = urlSiac(d.numero, d.codigoFormaContratacao);
    const compUrl = urlComprasnet(d.id);
    return [
      `### ${d.numero} — id \`${d.id}\``,
      '',
      `- Nosso (Compras.gov.br): **${brl(d.nosso)}** — [ver contrato](${compUrl})`,
      `- SIAC (\`valorAtualizado\`): **${brl(d.siac)}** — [ver no SIAC](${siacUrl})`,
      d.razao ? `- Razão: ${d.razao.toFixed(1)}x` : '- Um dos dois lados é zero',
      `- Fornecedor (nosso): ${d.fornecedor}`,
      `- Contratado (SIAC): ${d.contratadoSiac}`,
      `- Objeto: ${d.objeto}`,
      '',
    ].join('\n');
  };

  return `# Candidatos a exceção — cruzamento com export do SIAC

Gerado por \`src/tse/cruzarSiac.js\` a partir de:
- Nossos dados: \`data/tse_contratos.json\` (fonte: Compras.gov.br)
- Export do SIAC: \`${csvPath}\`

Em: ${new Date().toISOString()}

## Metodologia e como ler este relatório

O casamento entre as duas fontes é feito por número/ano do contrato **e**
nome do fornecedor (normalizado, ignorando termos genéricos como "LTDA",
"TECNOLOGIA", "TRIBUNAL" etc.) — número/ano sozinho não é chave única: várias
parcerias diferentes (convênios, TEDs, acordos de cooperação) reaproveitam o
mesmo par número/ano com contrapartes diferentes.

**Importante:** o valor \`valorAtualizado\` do SIAC não é automaticamente a
verdade — nesta rodada apareceram pelo menos 2 casos (Lanlink, Minha
Biblioteca) onde o valor do SIAC parece implausível para o objeto do
contrato, sugerindo que o erro pode estar do lado do SIAC, não do nosso. Cada
item abaixo precisa de conferência manual na página de detalhe do SIAC (link
incluído) antes de virar exceção em \`data/tse_excecoes.json\` — ver seção
"Exceções" do README para o formato.

## Cobertura

- Total de contratos: ${stats.total}
- Sem número/ano interpretável: ${stats.semChave}
- Sem nenhuma linha candidata no CSV (mesmo número/ano): ${stats.semCandidato}
- Com candidato(s) mas nome não bateu (sem match confiável): ${stats.semMatchConfiavel}
- Casados com confiança: ${stats.matchados}

## Categoria A — razão ≈ potência de 10 (10x/100x/1000x/...)

Assinatura clássica de erro de vírgula/ponto decimal — mas o lado errado pode
ser **qualquer um dos dois** (já vimos casos nos dois sentidos). Confirmar
manualmente qual fonte bate com o contrato real antes de decidir o valor da
exceção.

${potencia10.length === 0 ? '_Nenhum candidato nesta categoria._\n' : potencia10.map(linhaContrato).join('\n')}

## Categoria B — zero em um lado, valor no outro

Pode ser erro de extração, mas também pode ser instrumento-base com valor
simbólico no SIAC (ex.: acordo de cooperação sem custo direto) enquanto o
valor real aparece em outro instrumento (TED) associado — ou o inverso.
Precisa checar o objeto/tipo de instrumento em cada caso.

${zeroVsNaoZero.length === 0 ? '_Nenhum candidato nesta categoria._\n' : zeroVsNaoZero.map(linhaContrato).join('\n')}

## Categoria C — outras divergências grandes (razão não é potência redonda)

Mais provável de refletir evolução legítima do valor ao longo do contrato
(aditivos plurianuais) do que erro de extração — mas listado para revisão,
principalmente quando o objeto é um fornecimento pontual (não contínuo).

${outras.length === 0 ? '_Nenhum candidato nesta categoria._\n' : outras.map(linhaContrato).join('\n')}
`;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Uso: node src/tse/cruzarSiac.js <export-siac.csv> [tse_contratos.json] [saida.md]');
    process.exit(1);
  }
  const jsonPath = process.argv[3] ?? path.join(raiz, 'data/tse_contratos.json');
  const saida = process.argv[4] ?? path.join(raiz, 'data/siac-divergencias.md');

  const resultado = await cruzar(csvPath, jsonPath);
  const md = gerarMarkdown(resultado, csvPath);
  await writeFile(saida, md, 'utf8');

  console.log(`Total: ${resultado.stats.total} · casados com confiança: ${resultado.stats.matchados} · divergências: ${resultado.divergencias.length}`);
  console.log(`Relatório salvo em ${saida}`);
}

const isMain = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
);

if (isMain) {
  main().catch((err) => {
    console.error('Falha no cruzamento:', err);
    process.exit(1);
  });
}

export { cruzar, gerarMarkdown, nomesBatem, razaoEhPotenciaDe10 };
