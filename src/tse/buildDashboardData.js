// Gera web/lib/dashboard-data.ts a partir de data/tse_contratos.json:
// snapshot dos agregados que o dashboard usa como carga inicial instantânea
// (em runtime o app se atualiza sozinho pela rota /api/tse/dados).
//
// Uso: node src/tse/buildDashboardData.js [entrada] [saida]
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agregarDashboard } from './agregarDashboard.js';
import { carregarExcecoes } from './excecoes.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let entrada = process.argv[2] ?? path.join(raiz, 'data/tse_contratos.json');
const entradaFuncoes = process.argv[4] ?? path.join(raiz, 'data/tse_funcoes.json');
const entradaAgentes = process.argv[5] ?? path.join(raiz, 'data/tse_agentes.json');
const entradaTeletrabalho = process.argv[6] ?? path.join(raiz, 'data/tse_teletrabalho.json');
const saida = process.argv[3] ?? path.join(raiz, 'web/lib/dashboard-data.ts');

async function main() {
  if (!existsSync(entrada)) {
    const exemplo = path.join(raiz, 'data/tse_contratos.exemplo.json');
    if (existsSync(exemplo) && !process.argv[2]) {
      console.warn(`[Aviso] '${entrada}' não foi encontrado. Utilizando '${exemplo}' como fallback...`);
      entrada = exemplo;
    } else {
      throw new Error(`Arquivo de entrada não encontrado: ${entrada}`);
    }
  }

  const contratos = JSON.parse(await readFile(entrada, 'utf8'));

  let movimentosFuncoes = [];
  if (existsSync(entradaFuncoes)) {
    movimentosFuncoes = JSON.parse(await readFile(entradaFuncoes, 'utf8'));
  } else {
    console.warn(
      `[Aviso] '${entradaFuncoes}' não foi encontrado — histórico de função sairá vazio. ` +
      'Rode "npm run tse:scrape-funcoes" para gerá-lo.',
    );
  }

  let agentesPublicos = [];
  if (existsSync(entradaAgentes)) {
    agentesPublicos = JSON.parse(await readFile(entradaAgentes, 'utf8'));
  } else {
    console.warn(
      `[Aviso] '${entradaAgentes}' não foi encontrado — seção "funcoes" sairá vazia (fonte primária ausente). ` +
      'Rode "npm run tse:scrape-agentes" para gerá-lo.',
    );
  }

  let movimentosTeletrabalho = [];
  if (existsSync(entradaTeletrabalho)) {
    movimentosTeletrabalho = JSON.parse(await readFile(entradaTeletrabalho, 'utf8'));
  } else {
    console.warn(
      `[Aviso] '${entradaTeletrabalho}' não foi encontrado — seção "teletrabalho" sairá vazia. ` +
      'Rode "npm run tse:scrape-teletrabalho" para gerá-lo.',
    );
  }

  const excecoes = carregarExcecoes();
  const dados = agregarDashboard(contratos, movimentosFuncoes, agentesPublicos, excecoes, movimentosTeletrabalho);
  await escreverDashboardData(dados, saida);
  console.log(
    `  ${contratos.length} contratos · ${dados.evolucao.length} anos · ${dados.categorias.length} fatias de categoria`,
  );
}

/** Escreve o snapshot embutido em `saida` a partir de um DashboardData já agregado. */
async function escreverDashboardData(dados, saida) {
  const ts = `// Gerado por src/tse/buildDashboardData.js — não editar manualmente.
// Fonte: ${dados.fonte}
// Extraído em: ${dados.geradoEm}

export interface ResumoTSE {
  totalContratado: number;
  totalEmpenhado: number;
  totalPago: number;
  totalContratos: number;
  contratosVigentes: number;
  valorVigente: number;
  valorVigenteEmpenhado: number;
  valorVigentePago: number;
  totalResponsaveis: number;
}

export interface PontoEvolucao {
  ano: number;
  valor: number;
  valorEmpenhado: number;
  valorPago: number;
  contratos: number;
}

export interface FatiaCategoria {
  categoria: string;
  valor: number;
  valorEmpenhado: number;
  valorPago: number;
  contratos: number;
}

export interface CorrecaoResumo {
  /** Campo do contrato que foi sobrescrito (ex.: "valorGlobal"). */
  campo: string;
  valorOriginal: unknown;
  valorCorrigido: unknown;
  motivo: string;
  fonte: string;
}

export interface ContratoResumo {
  id: string;
  numero: string;
  objeto: string;
  fornecedor: string;
  valorGlobal: number;
  valorEmpenhado: number;
  valorPago: number;
  ano: number | null;
  categoria: string;
  vigente: boolean;
  /** Campos corrigidos manualmente via data/tse_excecoes.json — vazio quando o contrato não tem correção. */
  correcoes: CorrecaoResumo[];
}

export interface FuncaoResumo {
  tipo: 'FC' | 'CJ';
  nivel: number;
  cargoTitulo: string;
}

export interface ContratoDoResponsavel {
  /** Índice na tabela DashboardData.contratos. */
  i: number;
  papeis: string[];
  /** Função comissionada que a pessoa ocupava durante a vigência deste contrato, quando houver. */
  funcaoNoContrato: FuncaoResumo | null;
}

export interface LinhaRanking {
  nome: string;
  papeis: string[];
  valorConsolidado: number;
  valorEmpenhadoConsolidado: number;
  valorPagoConsolidado: number;
  quantidadeContratos: number;
  contratos: ContratoDoResponsavel[];
}

export interface ResponsaveisData {
  total: number;
  emContratosVigentes: number;
  medianaValor: number;
  medianaEmpenhado: number;
  medianaPago: number;
  ranking: LinhaRanking[];
}

export interface PortariaRef {
  numero: string | null;
  ano: number | null;
  data: string | null;
  url: string;
}

export interface FuncaoMandato extends FuncaoResumo {
  unidade: string;
  /** Data efetiva (ISO) da nomeação/designação, ou null quando a portaria de início não foi localizada. */
  nomeacaoData: string | null;
  nomeacaoPortaria: PortariaRef | null;
  /** Data efetiva (ISO) da exoneração/dispensa, ou null quando o mandato segue vigente. */
  exoneracaoData: string | null;
  exoneracaoPortaria: PortariaRef | null;
  vigente: boolean;
}

export interface AtoProvimento {
  descricao: string | null;
  data: string | null;
}

export interface ServidorFuncoes {
  nome: string;
  /** Matrícula na relação atual de agentes públicos, ou null quando o servidor só consta no histórico de portarias. */
  matricula: string | null;
  cargo: string | null;
  lotacao: string | null;
  /**
   * Função vigente segundo a fonte PRIMÁRIA (relação atual de agentes
   * públicos) — mais confiável para "hoje" que o histórico de portarias.
   * null quando a fonte atual não mostra função (ex.: só consta no
   * histórico de portarias, ou foi dispensado).
   */
  funcaoAtual: FuncaoResumo | null;
  atoProvimentoAtual: AtoProvimento | null;
  /** false quando o servidor só foi encontrado no histórico de portarias (não está na relação atual de agentes públicos). */
  naRelacaoAtual: boolean;
  /** Histórico de mandatos reconstruído das portarias (fonte secundária) — pode ficar vazio mesmo com funcaoAtual preenchido. */
  mandatos: FuncaoMandato[];
  /** true quando a pessoa nunca aparece como fiscal/gestor em nenhum contrato. */
  zeroFiscal: boolean;
  /** Índice em DashboardData.responsaveis.ranking, ou null quando zeroFiscal. */
  responsavelRankingIndex: number | null;
  /** Inconsistências encontradas (formato inesperado na fonte, divergência entre fonte atual e histórico de portarias, etc.) — para investigação futura, não afetam o resto dos dados. */
  observacoes: string[];
}

export interface FuncoesData {
  total: number;
  zeroFiscal: number;
  vigentes: number;
  servidores: ServidorFuncoes[];
}

export interface PeriodoTeletrabalho {
  /** String bruta da fonte, níveis separados por " - ", do menor para o maior. */
  unidade: string;
  /** unidade.split(' - ').map(s => s.trim()) — o último item é a unidade de topo (secretaria/gabinete/assessoria). */
  unidadeNiveis: string[];
  dataInicio: string | null;
  /** null = período em aberto (considerar vigente até hoje). */
  dataFim: string | null;
  dias: number;
}

export interface LinhaTeletrabalho {
  nome: string;
  /** Soma dos dias de todos os períodos — sem merge de sobreposição, ver agregarTeletrabalho.js. */
  diasConsolidados: number;
  periodos: PeriodoTeletrabalho[];
  /** Índice em DashboardData.responsaveis.ranking, ou null quando a pessoa nunca aparece como fiscal/gestor. */
  responsavelRankingIndex: number | null;
}

export interface TeletrabalhoData {
  total: number;
  medianaDias: number;
  ranking: LinhaTeletrabalho[];
}

export interface DashboardData {
  geradoEm: string;
  fonte: string;
  resumo: ResumoTSE;
  evolucao: PontoEvolucao[];
  categorias: FatiaCategoria[];
  contratos: ContratoResumo[];
  responsaveis: ResponsaveisData;
  funcoes: FuncoesData;
  teletrabalho: TeletrabalhoData;
}

/** URL do contrato detalhado na consulta pública do Comprasnet. */
export function urlContrato(id: string) {
  return \`https://contratos.comprasnet.gov.br/transparencia/contratos/\${id}\`;
}

/** URL da consulta pública de teletrabalho do TSE, já filtrada por servidor — para conferir a origem dos dados. */
export function urlTeletrabalho(nome: string) {
  const hoje = new Date();
  const hojeBR = \`\${String(hoje.getDate()).padStart(2, '0')}/\${String(hoje.getMonth() + 1).padStart(2, '0')}/\${hoje.getFullYear()}\`;
  const params = new URLSearchParams({
    acao: 'teletrabalho',
    dataInicio: '01/01/2015',
    dataFim: hojeBR,
    unidade: '-1',
    nomeServidor: nome,
    valida: 'true',
    toExcel: 'false',
  });
  return \`https://transparencia.tse.jus.br/transparenciaDadosServidores/infoServidores?\${params.toString()}\`;
}

export const dashboardData: DashboardData = ${JSON.stringify(dados)};
`;

  await writeFile(saida, ts, 'utf8');
  console.log(`Gerado ${saida}`);
}

const isMain = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
);

if (isMain) {
  main().catch((err) => {
    console.error('Falha ao gerar dados do dashboard:', err);
    process.exit(1);
  });
}

export { escreverDashboardData };
