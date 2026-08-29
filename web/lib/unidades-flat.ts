// Achata a árvore de unidades (ver dashboard-data.ts / agregarUnidades.js) numa
// lista plana, uma linha por unidade, para telas que precisam ordenar/comparar
// unidades entre si em vez de navegar a hierarquia.

import type { UnidadeMetricas, UnidadeNode } from './dashboard-data';

export interface LinhaUnidade {
  id: string;
  /** Siglas dos ancestrais + a própria, ex.: "TSE / PRES / DG / STI". */
  caminho: string;
  sigla: string;
  nome: string;
  /** Profundidade na árvore — 0 = raiz. */
  nivel: number;
  node: UnidadeNode;
}

/** Soma as quantidades de função de um tipo (FC ou CJ) — como cada servidor tem
 *  no máximo uma função, equivale à contagem de servidores com aquele tipo. */
export const somaFuncoes = (m: UnidadeMetricas, tipo: 'FC' | 'CJ') =>
  m.funcoes.filter((f) => f.tipo === tipo).reduce((s, f) => s + f.quantidade, 0);

/** Soma as quantidades de papel de fiscal/gestor. Pode passar da contagem de
 *  pessoas: alguém com mais de um papel conta em cada um. */
export const somaFiscais = (m: UnidadeMetricas) =>
  m.fiscais.reduce((s, f) => s + f.quantidade, 0);

/**
 * Percorre a árvore em profundidade e devolve uma linha por nó. Quando
 * `visiveis` é informado, só entram os nós desse conjunto — mas o `caminho`
 * sempre carrega as siglas dos ancestrais.
 */
export function achatarUnidades(
  arvore: UnidadeNode,
  visiveis: Set<string> | null = null,
): LinhaUnidade[] {
  const acc: LinhaUnidade[] = [];
  const visita = (no: UnidadeNode, prefixo: string[], nivel: number) => {
    const caminho = [...prefixo, no.sigla];
    if (!visiveis || visiveis.has(no.id)) {
      acc.push({ id: no.id, caminho: caminho.join(' / '), sigla: no.sigla, nome: no.nome, nivel, node: no });
    }
    for (const filho of no.children) visita(filho, caminho, nivel + 1);
  };
  visita(arvore, [], 0);
  return acc;
}
