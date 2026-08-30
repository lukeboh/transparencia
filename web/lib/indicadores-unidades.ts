// Catálogo de "relações" (indicadores percentuais) para a tela /indicadores.
//
// Uma relação = uma MÉTRICA BASE (numerador) × uma VARIANTE (que define o
// denominador e se o numerador é o valor direto do nó ou o consolidado da
// subárvore). O catálogo é o produto cartesiano das duas listas — acrescentar
// uma métrica no futuro é uma linha em METRICAS_BASE, sem tocar na tela.

import type { UnidadeMetricas, UnidadeNode } from './dashboard-data';
import { somaFiscais, somaFuncoes } from './unidades-flat';

export type MetricaBaseId = 'servidores' | 'fc' | 'cj' | 'fiscais' | 'teletrabalho' | 'terceirizados';
export type VarianteId = 'unidade' | 'consolidada' | 'orgao_direto' | 'orgao_subarvore';

interface MetricaBase {
  id: MetricaBaseId;
  /** Rótulo curto, vira a 1ª linha do cabeçalho da coluna. */
  grupo: string;
  /** Frase completa, usada no menu de colunas. */
  descricao: string;
  valor: (m: UnidadeMetricas) => number;
}

const METRICAS_BASE: MetricaBase[] = [
  {
    id: 'servidores',
    grupo: 'Servidores',
    descricao: 'Percentual de servidores',
    valor: (m) => m.servidores,
  },
  {
    id: 'fc',
    grupo: 'Com FC',
    descricao: 'Percentual de servidores com FC',
    valor: (m) => somaFuncoes(m, 'FC'),
  },
  {
    id: 'cj',
    grupo: 'Com CJ',
    descricao: 'Percentual de servidores com CJ',
    valor: (m) => somaFuncoes(m, 'CJ'),
  },
  {
    id: 'fiscais',
    grupo: 'Fiscais',
    descricao: 'Percentual de servidores que são fiscais',
    valor: (m) => somaFiscais(m),
  },
  {
    id: 'teletrabalho',
    grupo: 'Teletrabalho',
    descricao: 'Percentual de servidores em teletrabalho',
    valor: (m) => m.teletrabalho,
  },
  {
    id: 'terceirizados',
    grupo: 'Terceirizados',
    descricao: 'Terceirizados por servidor (aprox., do PDF mensal do TSE)',
    valor: (m) => m.terceirizados,
  },
];

interface Variante {
  id: VarianteId;
  /** 2ª linha do cabeçalho da coluna. */
  rotulo: string;
  /** Texto completo, para o menu e o tooltip. */
  descricao: string;
  calc: (
    base: (m: UnidadeMetricas) => number,
    node: UnidadeNode,
    tseServidores: number,
  ) => { num: number; den: number };
}

const VARIANTES: Variante[] = [
  {
    id: 'unidade',
    rotulo: 'unidade',
    descricao: 'sobre os servidores lotados exatamente nesta unidade',
    calc: (base, n) => ({ num: base(n.direto), den: n.direto.servidores }),
  },
  {
    id: 'consolidada',
    rotulo: 'consolidada',
    descricao: 'sobre os servidores desta unidade e de toda a subárvore',
    calc: (base, n) => ({ num: base(n.consolidado), den: n.consolidado.servidores }),
  },
  {
    id: 'orgao_direto',
    rotulo: 'órgão · direto',
    descricao: 'valor lotado exatamente nesta unidade, sobre o total do TSE',
    calc: (base, n, tse) => ({ num: base(n.direto), den: tse }),
  },
  {
    id: 'orgao_subarvore',
    rotulo: 'órgão · subárvore',
    descricao: 'valor consolidado desta unidade e subárvore, sobre o total do TSE',
    calc: (base, n, tse) => ({ num: base(n.consolidado), den: tse }),
  },
];

export interface Relacao {
  id: string;
  base: MetricaBaseId;
  variante: VarianteId;
  /** 1ª linha do cabeçalho (nome da métrica). */
  grupo: string;
  /** 2ª linha do cabeçalho (variante). */
  rotuloVariante: string;
  /** Frase completa "Percentual de … — sobre …". */
  descricao: string;
  /** Percentual (0–100+, pode passar de 100 em "fiscais"); null quando o
   *  denominador é 0 (unidade sem servidor lotado direto). */
  calc: (node: UnidadeNode, tseServidores: number) => number | null;
}

/** Combinações que dariam sempre 100% e não informam nada. */
const ehDegenerada = (base: MetricaBaseId, v: VarianteId) =>
  base === 'servidores' && (v === 'unidade' || v === 'consolidada');

export const RELACOES: Relacao[] = METRICAS_BASE.flatMap((mb) =>
  VARIANTES.filter((v) => !ehDegenerada(mb.id, v.id)).map((v) => ({
    id: `${mb.id}__${v.id}`,
    base: mb.id,
    variante: v.id,
    grupo: mb.grupo,
    rotuloVariante: v.rotulo,
    descricao: `${mb.descricao} — ${v.descricao}`,
    calc: (node: UnidadeNode, tse: number) => {
      const { num, den } = v.calc(mb.valor, node, tse);
      return den > 0 ? (num / den) * 100 : null;
    },
  })),
);

export const RELACOES_POR_ID = new Map(RELACOES.map((r) => [r.id, r]));

/** Relações agrupadas por métrica base, na ordem do catálogo — para o menu. */
export const GRUPOS_RELACOES = METRICAS_BASE.map((mb) => ({
  base: mb.id,
  grupo: mb.grupo,
  descricao: mb.descricao,
  relacoes: RELACOES.filter((r) => r.base === mb.id),
}));

/** Colunas mostradas na primeira visita. */
export const RELACOES_PADRAO: string[] = [
  'servidores__orgao_subarvore',
  'fc__consolidada',
  'cj__consolidada',
  'fiscais__consolidada',
  'teletrabalho__consolidada',
  'terceirizados__consolidada',
];

/** Mesma regra de `percentual()` em utils.ts: 1 casa abaixo de 10%, inteiro
 *  acima — só que sobre um valor já calculado. */
export function formatarPct(v: number): string {
  if (v > 0 && v < 10) return v.toFixed(1);
  return String(Math.round(v));
}
