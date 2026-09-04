// Catálogo de "relações" (indicadores) para a tela /indicadores.
//
// Uma relação = uma MÉTRICA BASE (o que está sendo contado) × uma VARIANTE
// (Qtd./% × Unidade/Consolidado). O catálogo é o produto cartesiano das duas
// listas — acrescentar uma métrica no futuro é uma linha em METRICAS_BASE, sem
// tocar na tela. As 4 variantes são sempre as mesmas para toda métrica:
//  - Qtd. Unidade      → valor bruto, só quem está lotado exatamente no nó.
//  - Qtd. Consolidado  → valor bruto, o nó + toda a subárvore.
//  - % Unidade         → Qtd. Unidade dividido pelo total de servidores do TSE.
//  - % Consolidado     → Qtd. Consolidado dividido pelo total de servidores do TSE.

import type { UnidadeMetricas, UnidadeNode } from './dashboard-data';
import { somaFiscais, somaFuncoes } from './unidades-flat';
import { numero } from './utils';

export type MetricaBaseId =
  | 'servidores'
  | 'fc'
  | 'cj'
  | 'fiscais'
  | 'teletrabalho'
  | 'terceirizados'
  | 'horas_extras';
export type VarianteId = 'qtd_unidade' | 'qtd_consolidado' | 'pct_unidade' | 'pct_consolidado';

interface MetricaBase {
  id: MetricaBaseId;
  /** Rótulo curto, vira a 1ª linha do cabeçalho da coluna e o título da seção no menu de colunas. */
  grupo: string;
  /** Frase (substantivo), usada para compor a descrição de cada variante no menu/tooltip. */
  descricao: string;
  valor: (m: UnidadeMetricas) => number;
  /** Sufixo do valor bruto (Qtd.) — '' para contagem de pessoas, ' h' para horas. */
  sufixo?: string;
}

const METRICAS_BASE: MetricaBase[] = [
  {
    id: 'servidores',
    grupo: 'Servidores',
    descricao: 'Servidores',
    valor: (m) => m.servidores,
  },
  {
    id: 'fc',
    grupo: 'Com FC',
    descricao: 'Servidores com função comissionada (FC)',
    valor: (m) => somaFuncoes(m, 'FC'),
  },
  {
    id: 'cj',
    grupo: 'Com CJ',
    descricao: 'Servidores com cargo em comissão (CJ)',
    valor: (m) => somaFuncoes(m, 'CJ'),
  },
  {
    id: 'fiscais',
    grupo: 'Fiscais',
    descricao: 'Servidores que são fiscais/gestores de contrato',
    valor: (m) => somaFiscais(m),
  },
  {
    id: 'teletrabalho',
    grupo: 'Teletrabalho',
    descricao: 'Servidores em teletrabalho',
    valor: (m) => m.teletrabalho,
  },
  {
    id: 'terceirizados',
    grupo: 'Terceirizados',
    descricao: 'Terceirizados (estimado do PDF mensal do TSE)',
    valor: (m) => m.terceirizados,
  },
  {
    id: 'horas_extras',
    grupo: 'Horas extras',
    descricao:
      'Horas extras estimadas (serviço extraordinário desde 2009; valor pago ÷ hora normal ÷ 1,5, Res. TSE 22.901/2008 — limite superior)',
    valor: (m) => m.horasExtras,
    sufixo: ' h',
  },
];

interface Variante {
  id: VarianteId;
  /** 2ª linha do cabeçalho da coluna e rótulo no menu. */
  rotulo: string;
  /** 'contagem' = valor bruto (inteiro, com sufixo); 'pct' = percentual sobre o total de servidores do TSE. */
  formato: 'contagem' | 'pct';
  /** Fecha a frase iniciada pelo `descricao` da métrica, ex.: "Servidores — quantidade, só nesta unidade". */
  descricao: string;
  calc: (base: (m: UnidadeMetricas) => number, node: UnidadeNode, tseServidores: number) => number | null;
}

const VARIANTES: Variante[] = [
  {
    id: 'qtd_unidade',
    rotulo: 'Qtd. Unidade',
    formato: 'contagem',
    descricao: 'quantidade, só quem está lotado exatamente nesta unidade',
    calc: (base, node) => base(node.direto),
  },
  {
    id: 'qtd_consolidado',
    rotulo: 'Qtd. Consolidado',
    formato: 'contagem',
    descricao: 'quantidade, somando esta unidade e toda a subárvore',
    calc: (base, node) => base(node.consolidado),
  },
  {
    id: 'pct_unidade',
    rotulo: '% Unidade',
    formato: 'pct',
    descricao: 'percentual sobre o total de servidores do TSE, só quem está lotado exatamente nesta unidade',
    calc: (base, node, tse) => (tse > 0 ? (base(node.direto) / tse) * 100 : null),
  },
  {
    id: 'pct_consolidado',
    rotulo: '% Consolidado',
    formato: 'pct',
    descricao: 'percentual sobre o total de servidores do TSE, somando esta unidade e toda a subárvore',
    calc: (base, node, tse) => (tse > 0 ? (base(node.consolidado) / tse) * 100 : null),
  },
];

export interface Relacao {
  id: string;
  base: MetricaBaseId;
  variante: VarianteId;
  /** 1ª linha do cabeçalho (nome da métrica). */
  grupo: string;
  /** 2ª linha do cabeçalho (variante: Qtd./% × Unidade/Consolidado). */
  rotuloVariante: string;
  /** Frase completa "Métrica — variante", para o menu e o tooltip do cabeçalho. */
  descricao: string;
  /** 'contagem' → valor bruto (inteiro, com sufixo); 'pct' → percentual (0–100+). */
  formato: 'contagem' | 'pct';
  /** Sufixo para formato 'contagem' (ex.: " h"); '' para os demais. */
  sufixo: string;
  /** Valor calculado; null quando o denominador é 0 (sem servidor algum no TSE — só em base vazia). */
  calc: (node: UnidadeNode, tseServidores: number) => number | null;
}

export const RELACOES: Relacao[] = METRICAS_BASE.flatMap((mb) =>
  VARIANTES.map((v) => ({
    id: `${mb.id}__${v.id}`,
    base: mb.id,
    variante: v.id,
    grupo: mb.grupo,
    rotuloVariante: v.rotulo,
    descricao: `${mb.descricao} — ${v.descricao}`,
    formato: v.formato,
    sufixo: v.formato === 'contagem' ? (mb.sufixo ?? '') : '',
    calc: (node: UnidadeNode, tse: number) => v.calc(mb.valor, node, tse),
  })),
);

export const RELACOES_POR_ID = new Map(RELACOES.map((r) => [r.id, r]));

/** Relações agrupadas por métrica base, na ordem do catálogo — para o menu. */
export const GRUPOS_RELACOES = METRICAS_BASE.map((mb) => ({
  base: mb.id,
  grupo: mb.grupo,
  relacoes: RELACOES.filter((r) => r.base === mb.id),
}));

/** Colunas mostradas na primeira visita. */
export const RELACOES_PADRAO: string[] = [
  'servidores__qtd_consolidado',
  'fc__pct_consolidado',
  'cj__pct_consolidado',
  'fiscais__pct_consolidado',
  'teletrabalho__pct_consolidado',
  'terceirizados__pct_consolidado',
  'horas_extras__qtd_consolidado',
];

/** Mesma regra de `percentual()` em utils.ts: 1 casa abaixo de 10%, inteiro
 *  acima — só que sobre um valor já calculado. */
export function formatarPct(v: number): string {
  if (v > 0 && v < 10) return v.toFixed(1);
  return String(Math.round(v));
}

/** Formata o valor de uma relação para exibição, conforme o `formato`. */
export function formatarValorRelacao(v: number, r: { formato: 'contagem' | 'pct'; sufixo: string }): string {
  if (r.formato === 'contagem') {
    return `${numero(Math.round(v))}${r.sufixo}`;
  }
  return `${formatarPct(v)}%`;
}
