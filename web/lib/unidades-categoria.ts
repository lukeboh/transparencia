// Classifica cada nó da árvore oficial de unidades do TSE (ver
// src/tse/scrapeUnidades.js / agregarUnidades.js) numa única categoria, para
// alimentar os filtros de "o que aparece na árvore" da tela /unidades.
//
// A categoria sai do NOME da unidade (prefixo: "SECRETARIA…", "COORDENADORIA…")
// combinado com a posição na árvore (é folha? a que profundidade?). Não há um
// campo de tipo na fonte — é tudo heurística sobre o nome + a estrutura.

import type { UnidadeNode } from './dashboard-data';

export type CategoriaUnidade =
  | 'tribunal'
  | 'alta-gestao'
  | 'secretaria'
  | 'coordenadoria'
  | 'ramo'
  | 'folha';

export interface CategoriaInfo {
  id: CategoriaUnidade;
  rotulo: string;
  descricao: string;
}

// Ordem = ordem dos toggles na tela. `tribunal` fica de fora: a raiz é sempre
// exibida (esconder o TSE não faria sentido).
export const CATEGORIAS_UNIDADE: CategoriaInfo[] = [
  {
    id: 'alta-gestao',
    rotulo: 'Alta gestão',
    descricao:
      'Unidades-folha da cúpula: gabinetes de ministros, presidência e assessorias diretamente ligadas a ministros/plenário.',
  },
  {
    id: 'secretaria',
    rotulo: 'Secretarias e diretorias',
    descricao: 'Ramos cujo nome começa com Secretaria, Diretoria, Corregedoria, Procuradoria ou Escola.',
  },
  {
    id: 'coordenadoria',
    rotulo: 'Coordenadorias',
    descricao: 'Ramos cujo nome começa com Coordenadoria.',
  },
  {
    id: 'ramo',
    rotulo: 'Demais ramos',
    descricao: 'Outros nós com subunidades: presidência, grupo de ministros, gabinetes e assessorias com seções abaixo.',
  },
  {
    id: 'folha',
    rotulo: 'Unidades-folha',
    descricao: 'Nós sem subunidades (seções, núcleos e assessorias na ponta) que não são da alta gestão.',
  },
];

const ROTULO_POR_CATEGORIA = new Map<CategoriaUnidade, string>([
  ['tribunal', 'Tribunal'],
  ...CATEGORIAS_UNIDADE.map((c) => [c.id, c.rotulo] as const),
]);

export const rotuloCategoria = (id: CategoriaUnidade) => ROTULO_POR_CATEGORIA.get(id) ?? id;

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Folha "de cúpula": gabinete de ministro, órgão ligado direto à presidência
 *  ou assessoria de ministros/plenário/cerimonial. Só se aplica a folhas. */
function ehAltaGestao(nome: string, paiSigla: string | null, paiNome: string | null, profundidade: number) {
  const n = normalizar(nome);
  const pai = normalizar(`${paiSigla ?? ''} ${paiNome ?? ''}`);

  if (/\bMIN\b|\bMINISTROS\b/.test(pai)) return true; // filha do grupo "MINISTROS"
  if (/^MINISTRO\b/.test(n)) return true; // gabinete de ministro
  if (profundidade <= 2) return true; // filha direta da raiz ou da PRESIDÊNCIA
  return /\b(PLENARIO|CERIMONIAL DA PRESIDENCIA|MINISTROS SUBSTITUTOS|ARTICULACAO PARLAMENTAR|GABINETE DA PRESIDENCIA)\b/.test(
    n,
  );
}

function classificarRamo(nome: string): CategoriaUnidade {
  const n = normalizar(nome);
  if (/^(SECRETARIA|DIRETORIA|CORREGEDORIA|PROCURADORIA|ESCOLA)\b/.test(n)) return 'secretaria';
  if (/^COORDENADORIA\b/.test(n)) return 'coordenadoria';
  return 'ramo';
}

/**
 * Percorre a árvore e devolve `id do nó → categoria`. Cada nó cai em exatamente
 * uma categoria.
 */
export function classificarUnidades(raiz: UnidadeNode): Map<string, CategoriaUnidade> {
  const mapa = new Map<string, CategoriaUnidade>();

  function visita(no: UnidadeNode, profundidade: number, pai: UnidadeNode | null) {
    let categoria: CategoriaUnidade;
    if (profundidade === 0) {
      categoria = 'tribunal';
    } else if (no.children.length === 0) {
      categoria = ehAltaGestao(no.nome, pai?.sigla ?? null, pai?.nome ?? null, profundidade)
        ? 'alta-gestao'
        : 'folha';
    } else {
      categoria = classificarRamo(no.nome);
    }
    mapa.set(no.id, categoria);
    for (const filho of no.children) visita(filho, profundidade + 1, no);
  }

  visita(raiz, 0, null);
  return mapa;
}
