// Catálogo de "relações" (indicadores) para a tela /indicadores.
//
// Uma relação = uma MÉTRICA BASE (o que está sendo contado) × uma VARIANTE
// (Qtd./% × Unidade/Consolidado). O catálogo é o produto cartesiano das duas
// listas — acrescentar uma métrica no futuro é uma linha em METRICAS_BASE, sem
// tocar na tela. As 4 variantes "totais" são sempre as mesmas para toda
// métrica:
//  - Qtd. Unidade      → valor bruto, só quem está lotado exatamente no nó.
//  - Qtd. Consolidado  → valor bruto, o nó + toda a subárvore.
//  - % Unidade         → Qtd. Unidade dividido pelo DENOMINADOR da métrica.
//  - % Consolidado     → Qtd. Consolidado dividido pelo DENOMINADOR da métrica.
//
// O denominador é POR MÉTRICA (`MetricaBase.denominador`), não sempre "total
// de servidores do TSE": para a maioria (servidores, FC, CJ, fiscais,
// teletrabalho, terceirizados) faz sentido comparar contra o quadro de
// pessoas; para horas extras o "%" só é intuitivo comparado contra o TOTAL DE
// HORAS EXTRAS do TSE (o nó raiz sempre dá 100%) — comparar horas contra
// número de pessoas produzia um percentual sem significado.
//
// Horas extras tem ainda 2 relações MENSAIS à parte (não fazem parte do
// produto cartesiano — só métrica de fluxo mensal tem "só aquele mês" como
// variante): ver `criarRelacoesMensaisHorasExtras`.

import type { UnidadeMetricas, UnidadeNode } from './dashboard-data';
import { somaFiscais, somaFuncoes } from './unidades-flat';
import { mesAnoCurto, numero } from './utils';

export type MetricaBaseId =
  | 'servidores'
  | 'fc'
  | 'cj'
  | 'fiscais'
  | 'teletrabalho'
  | 'terceirizados'
  | 'horas_extras';
export type VarianteId =
  | 'qtd_unidade'
  | 'qtd_consolidado'
  | 'pct_unidade'
  | 'pct_consolidado'
  | 'pct_mensal_unidade'
  | 'pct_mensal_consolidado';

interface MetricaBase {
  id: MetricaBaseId;
  /** Rótulo curto, vira a 1ª linha do cabeçalho da coluna e o título da seção no menu de colunas. */
  grupo: string;
  /** Frase (substantivo), usada para compor a descrição de cada variante no menu/tooltip. */
  descricao: string;
  valor: (m: UnidadeMetricas) => number;
  /** Denominador do "%" — quantidade total no nó RAIZ (TSE inteiro) para essa métrica. */
  denominador: (raizConsolidado: UnidadeMetricas) => number;
  /** Frase que descreve o denominador, para compor a descrição das variantes "%" (ex.: "total de servidores do TSE"). */
  denominadorRotulo: string;
  /** Sufixo do valor bruto (Qtd.) — '' para contagem de pessoas, ' h' para horas. */
  sufixo?: string;
}

const METRICAS_BASE: MetricaBase[] = [
  {
    id: 'servidores',
    grupo: 'Servidores',
    descricao: 'Servidores',
    valor: (m) => m.servidores,
    denominador: (raiz) => raiz.servidores,
    denominadorRotulo: 'total de servidores do TSE',
  },
  {
    id: 'fc',
    grupo: 'Com FC',
    descricao: 'Servidores com função comissionada (FC)',
    valor: (m) => somaFuncoes(m, 'FC'),
    denominador: (raiz) => raiz.servidores,
    denominadorRotulo: 'total de servidores do TSE',
  },
  {
    id: 'cj',
    grupo: 'Com CJ',
    descricao: 'Servidores com cargo em comissão (CJ)',
    valor: (m) => somaFuncoes(m, 'CJ'),
    denominador: (raiz) => raiz.servidores,
    denominadorRotulo: 'total de servidores do TSE',
  },
  {
    id: 'fiscais',
    grupo: 'Fiscais',
    descricao: 'Servidores que são fiscais/gestores de contrato',
    valor: (m) => somaFiscais(m),
    denominador: (raiz) => raiz.servidores,
    denominadorRotulo: 'total de servidores do TSE',
  },
  {
    id: 'teletrabalho',
    grupo: 'Teletrabalho',
    descricao: 'Servidores em teletrabalho',
    valor: (m) => m.teletrabalho,
    denominador: (raiz) => raiz.servidores,
    denominadorRotulo: 'total de servidores do TSE',
  },
  {
    id: 'terceirizados',
    grupo: 'Terceirizados',
    descricao: 'Terceirizados (estimado do PDF mensal do TSE)',
    valor: (m) => m.terceirizados,
    denominador: (raiz) => raiz.servidores,
    denominadorRotulo: 'total de servidores do TSE',
  },
  {
    id: 'horas_extras',
    grupo: 'Horas extras',
    descricao:
      'Horas extras estimadas (serviço extraordinário desde 2009; valor pago ÷ hora normal ÷ 1,5, Res. TSE 22.901/2008 — limite superior)',
    valor: (m) => m.horasExtras,
    // Denominador é o total de HORAS EXTRAS do TSE (não o quadro de pessoas)
    // — só assim o "%" tem leitura de "fatia do bolo" (TSE = 100%).
    denominador: (raiz) => raiz.horasExtras,
    denominadorRotulo: 'total de horas extras estimadas do TSE',
    sufixo: ' h',
  },
];

interface Variante {
  id: VarianteId;
  /** 2ª linha do cabeçalho da coluna e rótulo no menu. */
  rotulo: string;
  /** 'contagem' = valor bruto (inteiro, com sufixo); 'pct' = percentual sobre o denominador da métrica. */
  formato: 'contagem' | 'pct';
  /** Fecha a frase iniciada pelo `descricao` da métrica, ex.: "Servidores — quantidade, só nesta unidade". Recebe o rótulo do denominador da métrica (variantes "%"). */
  descricao: (denominadorRotulo: string) => string;
  calc: (
    base: (m: UnidadeMetricas) => number,
    node: UnidadeNode,
    raizConsolidado: UnidadeMetricas,
    denominador: (raiz: UnidadeMetricas) => number,
  ) => number | null;
}

const VARIANTES: Variante[] = [
  {
    id: 'qtd_unidade',
    rotulo: 'Qtd. Unidade',
    formato: 'contagem',
    descricao: () => 'quantidade, só quem está lotado exatamente nesta unidade',
    calc: (base, node) => base(node.direto),
  },
  {
    id: 'qtd_consolidado',
    rotulo: 'Qtd. Consolidado',
    formato: 'contagem',
    descricao: () => 'quantidade, somando esta unidade e toda a subárvore',
    calc: (base, node) => base(node.consolidado),
  },
  {
    id: 'pct_unidade',
    rotulo: '% Unidade',
    formato: 'pct',
    descricao: (denom) => `percentual sobre o ${denom}, só quem está lotado exatamente nesta unidade`,
    calc: (base, node, raiz, denominador) => {
      const d = denominador(raiz);
      return d > 0 ? (base(node.direto) / d) * 100 : null;
    },
  },
  {
    id: 'pct_consolidado',
    rotulo: '% Consolidado',
    formato: 'pct',
    descricao: (denom) => `percentual sobre o ${denom}, somando esta unidade e toda a subárvore`,
    calc: (base, node, raiz, denominador) => {
      const d = denominador(raiz);
      return d > 0 ? (base(node.consolidado) / d) * 100 : null;
    },
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
  /** Valor calculado a partir do nó e do consolidado da RAIZ (TSE inteiro) — RAIZ dá o denominador de cada "%". null quando o denominador é 0. */
  calc: (node: UnidadeNode, raizConsolidado: UnidadeMetricas) => number | null;
}

export const RELACOES: Relacao[] = METRICAS_BASE.flatMap((mb) =>
  VARIANTES.map((v) => ({
    id: `${mb.id}__${v.id}`,
    base: mb.id,
    variante: v.id,
    grupo: mb.grupo,
    rotuloVariante: v.rotulo,
    descricao: `${mb.descricao} — ${v.descricao(mb.denominadorRotulo)}`,
    formato: v.formato,
    sufixo: v.formato === 'contagem' ? (mb.sufixo ?? '') : '',
    calc: (node: UnidadeNode, raizConsolidado: UnidadeMetricas) =>
      v.calc(mb.valor, node, raizConsolidado, mb.denominador),
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

/** ids das 2 relações mensais de horas extras (ver `criarRelacoesMensaisHorasExtras`)
 *  — fixos, mesmo o VALOR calculado dependendo do mês selecionado, então
 *  `colunaValida`/localStorage podem tratá-los como qualquer outro id estático. */
export const IDS_RELACOES_MENSAIS_HORAS_EXTRAS = [
  'horas_extras__pct_mensal_unidade',
  'horas_extras__pct_mensal_consolidado',
] as const;

/**
 * As 2 relações "% Mensal" de horas extras (fora do produto cartesiano
 * acima: só uma métrica de FLUXO mensal, como horas extras, tem uma variante
 * "considerando só um mês" com sentido) — percentual sobre o total de horas
 * extras do TSE NAQUELE MÊS (não o total histórico). `mes` = "AAAA-MM" ou
 * null (nenhuma competência disponível) — nesse caso os 2 sempre retornam
 * null (mostra "—").
 */
export function criarRelacoesMensaisHorasExtras(mes: string | null): Relacao[] {
  const rotuloMes = mes ? mesAnoCurto(mes) : 'mês indisponível';
  const horasNoMes = (m: UnidadeMetricas): number =>
    mes ? m.horasExtrasPorMes.find((h) => h.mes === mes)?.horas ?? 0 : 0;

  return [
    {
      id: 'horas_extras__pct_mensal_unidade',
      base: 'horas_extras',
      variante: 'pct_mensal_unidade',
      grupo: 'Horas extras',
      rotuloVariante: `% Mensal Unidade (${rotuloMes})`,
      descricao: `Horas extras estimadas em ${rotuloMes} — percentual sobre o total do TSE nesse mês, só quem está lotado exatamente nesta unidade`,
      formato: 'pct',
      sufixo: '',
      calc: (node, raizConsolidado) => {
        if (!mes) return null;
        const total = horasNoMes(raizConsolidado);
        return total > 0 ? (horasNoMes(node.direto) / total) * 100 : null;
      },
    },
    {
      id: 'horas_extras__pct_mensal_consolidado',
      base: 'horas_extras',
      variante: 'pct_mensal_consolidado',
      grupo: 'Horas extras',
      rotuloVariante: `% Mensal Consolidado (${rotuloMes})`,
      descricao: `Horas extras estimadas em ${rotuloMes} — percentual sobre o total do TSE nesse mês, somando esta unidade e toda a subárvore`,
      formato: 'pct',
      sufixo: '',
      calc: (node, raizConsolidado) => {
        if (!mes) return null;
        const total = horasNoMes(raizConsolidado);
        return total > 0 ? (horasNoMes(node.consolidado) / total) * 100 : null;
      },
    },
  ];
}

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
