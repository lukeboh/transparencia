// Categorização de contratos por faixa de "Valor Global" — visão adicional
// à divisão por categoria de compra (ver categorias-chart.tsx), pensada para
// destacar contratos com valor irrisório/simbólico em contraste com os de
// valor altíssimo (ver nota sobre tetos nacionais no README). Cada faixa tem
// um símbolo (estilo "faixa de preço") e uma cor fixa dos 6 slots
// categóricos validados do projeto (--chart-1..6, ver globals.css) — como são
// exatamente 6 faixas para 6 slots, não há necessidade de ciclar/reusar cor.
import { brlCompleto } from '@/lib/utils';
import type { ContratoDoResponsavel, ContratoResumo } from '@/lib/dashboard-data';

export type CategoriaValorId = 'irrisorio' | 'baixo' | 'medio' | 'alto' | 'altissimo' | 'extraAlto';

export interface CategoriaValor {
  id: CategoriaValorId;
  nome: string;
  simbolo: string;
  /** Teto (inclusive) em reais para entrar nesta faixa; null = sem teto (última faixa). */
  teto: number | null;
  cor: string;
}

export const CATEGORIAS_VALOR: CategoriaValor[] = [
  { id: 'irrisorio', nome: 'Irrisório', simbolo: '$', teto: 100, cor: 'var(--chart-1)' },
  { id: 'baixo', nome: 'Baixo custo', simbolo: '$$', teto: 10_000, cor: 'var(--chart-2)' },
  { id: 'medio', nome: 'Médio custo', simbolo: '$$$', teto: 100_000, cor: 'var(--chart-3)' },
  { id: 'alto', nome: 'Alto custo', simbolo: '$$$$', teto: 1_000_000, cor: 'var(--chart-4)' },
  { id: 'altissimo', nome: 'Altíssimo custo', simbolo: '$👑', teto: 10_000_000, cor: 'var(--chart-5)' },
  { id: 'extraAlto', nome: 'Custo extra alto', simbolo: '$👑🥷', teto: null, cor: 'var(--chart-6)' },
];

/** Faixa de um valor, pelo primeiro teto (inclusive) que o valor não ultrapassa. */
export function categoriaDoValor(valor: number): CategoriaValor {
  for (const categoria of CATEGORIAS_VALOR) {
    if (categoria.teto === null || valor <= categoria.teto) return categoria;
  }
  return CATEGORIAS_VALOR[CATEGORIAS_VALOR.length - 1];
}

/** Texto humano do intervalo da faixa (para tooltip/título), ex.: "de R$ 100 até R$ 10.000". */
export function descricaoFaixa(categoria: CategoriaValor): string {
  const indice = CATEGORIAS_VALOR.findIndex((c) => c.id === categoria.id);
  const anterior = indice > 0 ? CATEGORIAS_VALOR[indice - 1] : null;
  if (categoria.teto === null) return `acima de ${brlCompleto(anterior?.teto ?? 0)}`;
  if (!anterior) return `até ${brlCompleto(categoria.teto)}`;
  return `de ${brlCompleto(anterior.teto ?? 0)} até ${brlCompleto(categoria.teto)}`;
}

/**
 * Faixas distintas entre os contratos de um responsável (ordem fixa das
 * faixas, da mais baixa à mais alta) — usada para os símbolos no perfil de
 * cada fiscal na tabela de ranking.
 */
export function categoriasDeContratos(
  contratosDoResponsavel: ContratoDoResponsavel[],
  contratos: ContratoResumo[],
): CategoriaValor[] {
  const vistas = new Set<CategoriaValorId>();
  for (const { i } of contratosDoResponsavel) {
    const contrato = contratos[i];
    if (!contrato) continue;
    vistas.add(categoriaDoValor(contrato.valorGlobal).id);
  }
  return CATEGORIAS_VALOR.filter((c) => vistas.has(c.id));
}
