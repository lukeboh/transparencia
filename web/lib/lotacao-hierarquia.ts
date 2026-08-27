// Resolve o nome plano de lotação de um servidor (relação de agentes públicos,
// ver src/tse/scrapeAgentesPublicos.js) para o caminho de siglas da árvore
// oficial de unidades do TSE (ver src/tse/scrapeUnidades.js), da unidade mais
// específica para a mais alta — ex.: "SEVIN / COTEL / STI". Só os 3 primeiros
// níveis (a partir da lotação real), o suficiente para identificar a lotação
// sem arrastar secretaria/presidência em toda linha; a raiz (TSE) já fica de
// fora de qualquer forma. O cruzamento é por nome de unidade normalizado, o
// mesmo critério de src/tse/agregarUnidades.js: quando o nome não bate em
// nenhum nó, ou bate em mais de um, não há caminho confiável e devolvemos [].
import type { UnidadeNode } from './dashboard-data';

const MAX_NIVEIS = 3;

function normalizarUnidade(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export type ResolvedorLotacao = (lotacao: string | null) => string[];

/**
 * Constrói um resolvedor a partir da árvore de unidades já agregada. O
 * resultado é uma lista de até 3 siglas da menor para a maior unidade; lista
 * vazia quando `arvore` é null, `lotacao` é vazia, ou o nome não resolve para
 * exatamente um nó.
 */
export function criarResolvedorLotacao(arvore: UnidadeNode | null): ResolvedorLotacao {
  const porId = new Map<string, UnidadeNode>();
  const idsPorNome = new Map<string, string[]>();

  function indexar(no: UnidadeNode) {
    porId.set(no.id, no);
    const chave = normalizarUnidade(no.nome);
    if (chave) {
      const lista = idsPorNome.get(chave) ?? [];
      lista.push(no.id);
      idsPorNome.set(chave, lista);
    }
    for (const filho of no.children) indexar(filho);
  }
  if (arvore) indexar(arvore);

  return (lotacao) => {
    if (!lotacao) return [];
    const ids = idsPorNome.get(normalizarUnidade(lotacao));
    if (!ids || ids.length !== 1) return [];

    const caminho: string[] = [];
    let atual: UnidadeNode | undefined = porId.get(ids[0]);
    while (atual && atual.parentId !== null && caminho.length < MAX_NIVEIS) {
      caminho.push(atual.sigla);
      atual = porId.get(atual.parentId);
    }
    return caminho;
  };
}
