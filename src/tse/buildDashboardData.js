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
const entradaUnidades = process.argv[7] ?? path.join(raiz, 'data/tse_unidades.json');
const entradaTerceirizados = process.argv[8] ?? path.join(raiz, 'data/tse_terceirizados.json');
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

  let arvoreUnidades = null;
  if (existsSync(entradaUnidades)) {
    arvoreUnidades = JSON.parse(await readFile(entradaUnidades, 'utf8'));
  } else {
    console.warn(
      `[Aviso] '${entradaUnidades}' não foi encontrado — seção "unidades" sairá vazia. ` +
      'Rode "npm run tse:scrape-unidades" para gerá-lo.',
    );
  }

  let terceirizados = [];
  let terceirizadosCompetencia = null;
  if (existsSync(entradaTerceirizados)) {
    // Repassa o objeto completo (com `porCompetencia`) ao agregador — ele
    // extrai a foto recente para a contagem por unidade e o histórico mês a
    // mês para a tela /terceirizados. Aceita também o array cru legado.
    const t = JSON.parse(await readFile(entradaTerceirizados, 'utf8'));
    terceirizados = t;
    terceirizadosCompetencia = t?.competenciaAtual?.rotulo ?? t?.competencia?.rotulo ?? null;
  } else {
    console.warn(
      `[Aviso] '${entradaTerceirizados}' não foi encontrado — contagem de terceirizados por unidade sairá zerada. ` +
      'Rode "npm run tse:scrape-terceirizados" para gerá-lo.',
    );
  }

  const excecoes = carregarExcecoes();
  const dados = agregarDashboard(contratos, movimentosFuncoes, agentesPublicos, excecoes, movimentosTeletrabalho, arvoreUnidades, terceirizados);
  dados.unidades.terceirizadosCompetencia = terceirizadosCompetencia;
  await escreverDashboardData(dados, saida);
  console.log(
    `  ${contratos.length} contratos · ${dados.evolucao.length} anos · ${dados.categorias.length} fatias de categoria`,
  );
  if (dados.unidades.arvore) {
    const { naoLocalizados } = dados.unidades;
    console.log(
      `  unidades: ${dados.unidades.totalServidoresTSE} servidores na árvore · ` +
      `${dados.unidades.arvore.consolidado.terceirizados} terceirizados na árvore · não localizados: ` +
      `${naoLocalizados.servidores} servidor(es), ${naoLocalizados.teletrabalho} teletrabalho, ` +
      `${naoLocalizados.terceirizados} terceirizado(s), ${naoLocalizados.ambiguos} ambíguo(s)`,
    );
  }
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
  /** Tamanho da relação atual de agentes públicos do TSE — proxy do quantitativo total de servidores "no momento". */
  totalAgentesPublicos: number;
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

export interface FuncaoContagem {
  tipo: 'FC' | 'CJ';
  nivel: number;
  quantidade: number;
}

export interface FiscalContagem {
  papel: string;
  quantidade: number;
}

export interface UnidadeMetricas {
  servidores: number;
  funcoes: FuncaoContagem[];
  fiscais: FiscalContagem[];
  teletrabalho: number;
  /** Profissionais terceirizados (postos de contratos de cessão de mão de obra) alocados na unidade. Estimado do PDF mensal do TSE — ver naoLocalizados.terceirizados. */
  terceirizados: number;
}

export interface UnidadeNode {
  id: string;
  nome: string;
  sigla: string;
  parentId: string | null;
  /** Só quem está lotado exatamente nesse nó (não inclui filhos). */
  direto: UnidadeMetricas;
  /** Esse nó + toda a subárvore. */
  consolidado: UnidadeMetricas;
  children: UnidadeNode[];
}

export interface TerceirizadoUnidade {
  /** id do nó da árvore em que o posto foi alocado (ver UnidadeNode.id). */
  unidadeId: string;
  /** Nome do profissional, já em caixa de título. */
  nome: string;
  /** Posto de trabalho / função; '' quando a fonte só trouxe ruído (código CBO). */
  posto: string;
  /** Empresa contratada, sem o CNPJ grudado; '' quando não veio no PDF. */
  empresa: string;
  /** Número do contrato de cessão de mão de obra ("13/2022"). */
  contrato: string;
  /** id do contrato na base do Comprasnet (para urlContrato), ou null quando não casou. */
  contratoId: string | null;
  /** Caminho de siglas cru da coluna "Alocação" do PDF (ex.: "Sebd/COINF/STI/TSE"). */
  alocacao: string;
}

export interface UnidadesData {
  arvore: UnidadeNode | null;
  /** Total consolidado de servidores no nó raiz — denominador fixo da % de "Servidores vigentes" em qualquer nó da árvore. */
  totalServidoresTSE: number;
  /** Competência (mês/ano) do PDF de terceirizados usado — null quando a fonte não foi raspada. */
  terceirizadosCompetencia: string | null;
  /** Lista achatada de terceirizados localizados (um por posto), ordenada por nome — a UI filtra por unidade/subárvore para a modal de nomes. */
  terceirizados: TerceirizadoUnidade[];
  /** Pessoas/registros que não puderam ser posicionados na árvore por não achar (ou achar mais de uma vez) a unidade pelo nome/sigla — ver agregarUnidades.js. */
  naoLocalizados: {
    servidores: number;
    teletrabalho: number;
    /** Terceirizados cuja "Alocação" no PDF não casou com nenhuma sigla da árvore. */
    terceirizados: number;
    ambiguos: number;
    exemplos: { servidores: string[]; teletrabalho: string[]; terceirizados: string[] };
  };
}

/** Uma competência (mês/ano) do histórico de PDFs de terceirizados. */
export interface CompetenciaTerceirizados {
  /** "2026-07" — ordenável. */
  chave: string;
  /** "Julho/2026". */
  rotulo: string;
  mes: number | null;
  ano: number | null;
}

export interface TerceirizadoPessoa {
  /** Nome já em caixa de título. */
  nome: string;
  /** Lotação: até 3 siglas, da unidade mais específica para a mais alta (ex.: ["SETOT","CSELE","STI"]). Vazio quando a "Alocação" do PDF não casou com a árvore. */
  lotacaoSiglas: string[];
  /** Caminho de siglas cru da coluna "Alocação" do PDF — fallback e title. */
  lotacaoAlocacao: string;
  /** Contrato de cessão de mão de obra na competência mais recente em que a pessoa aparece ("31/2023"). */
  contrato: string;
  /** id do contrato na base do Comprasnet (para o modal "Detalhes do Contrato"), ou null quando não casou. */
  contratoId: string | null;
  /** Todos os contratos distintos por que a pessoa passou, em ordem cronológica. */
  contratosHistorico: string[];
  empresa: string;
  posto: string;
  /** Primeira competência em que o nome aparece ("2025-03"). */
  mesInicio: string | null;
  /** Última competência em que aparece — só quando já NÃO consta na mais recente (saída definitiva). null = ainda contratado. */
  mesFim: string | null;
  /** Atalho para mesFim === null. */
  ativo: boolean;
  /** Em quantas competências do histórico a pessoa aparece. */
  competencias: number;
}

/** KPI por contrato de cessão de mão de obra. */
export interface ContratoTerceirizados {
  contrato: string;
  contratoId: string | null;
  empresa: string;
  /** Terceirizados ativos hoje neste contrato. */
  ativos: number;
  /** Terceirizados que já passaram por este contrato (histórico). */
  total: number;
  /** Enriquecimento do Comprasnet — null quando o contrato não casou. */
  valorGlobal: number | null;
  valorEmpenhado: number | null;
  valorPago: number | null;
  vigente: boolean | null;
  fornecedor: string | null;
  objeto: string | null;
  categoria: string | null;
}

export interface TerceirizadoFalha {
  /** 'lotacao-nao-identificada' = "Alocação" não casou com a árvore; 'sem-alocacao' = coluna vazia no PDF; 'contrato-nao-vinculado' = número não achado no Comprasnet; 'nome-nao-identificado' = a linha do PDF trouxe só o cargo, sem nome. */
  tipo: 'lotacao-nao-identificada' | 'sem-alocacao' | 'contrato-nao-vinculado' | 'nome-nao-identificado';
  nome: string;
  alocacao: string;
  contrato: string;
  competenciaMaisRecente: string;
}

export interface TerceirizadosData {
  /** Competências do histórico EFETIVAMENTE usadas, da mais antiga para a mais recente (exclui as descartadas). */
  competencias: CompetenciaTerceirizados[];
  /** Chave da competência mais recente ("2026-07"), ou null sem histórico. */
  competenciaAtual: string | null;
  /** competencias.length — quando 1, "mês de fim" ainda não é observável. */
  historicoMeses: number;
  /** Competências ignoradas por falha estrutural de extração do PDF (colunas mapeadas errado no OCR). */
  competenciasDescartadas: { chave: string; rotulo: string }[];
  totalPessoas: number;
  ativos: number;
  encerrados: number;
  /** Pessoas cuja lotação não pôde ser resolvida (subconjunto de falhas). */
  semLotacao: number;
  /** Nº de contratos de cessão distintos. */
  contratos: number;
  pessoas: TerceirizadoPessoa[];
  porContrato: ContratoTerceirizados[];
  falhas: TerceirizadoFalha[];
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
  unidades: UnidadesData;
  terceirizados: TerceirizadosData;
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

/** URL da página de detalhe (lista de agentes públicos) de uma unidade, na consulta pública do TSE — para conferir a origem dos dados de um nó. */
export function urlUnidadeDetalhe(id: string) {
  return \`https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/lotacao-geral/sem-assinatura/agrupamento-por-unidade/detalhe/\${id}\`;
}

/** Página do TSE com os PDFs mensais de profissionais terceirizados (contratos de cessão de mão de obra). */
export function urlTerceirizados() {
  return 'https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/profissionais-terceirizados-contratos-com-cessao-de-mao-de-obra';
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
