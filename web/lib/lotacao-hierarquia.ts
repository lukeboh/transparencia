// Resolve o nome plano de lotação de um servidor (relação de agentes públicos,
// ver src/tse/scrapeAgentesPublicos.js) para o caminho de unidades da árvore
// oficial do TSE (ver src/tse/scrapeUnidades.js), da unidade mais específica
// para a mais alta — ex.: "SETOT / CSELE / STI".
//
// Regras de exibição do caminho:
//  - no máximo 3 níveis;
//  - a exibição PARA no nível de secretaria (inclusive): uma vez incluída uma
//    "SECRETARIA …" / "SECRETARIA-GERAL …", não se sobe mais (ex.: quem está
//    lotado direto na STI vira só "STI");
//  - a "SECRETARIA DO TRIBUNAL" (SEC) é o guarda-chuva administrativo e NUNCA
//    aparece — quem é filho dela mostra só o próprio caminho até ali (a raiz
//    TSE também já fica de fora, por ser raiz);
//  - o que está sob a Presidência / Gabinete do Diretor-Geral segue a regra
//    normal e mostra os pais visíveis (SPR, GAB.DG, PRES…).
//
// O cruzamento é por nome de unidade normalizado, o mesmo critério de
// src/tse/agregarUnidades.js: quando o nome não bate em nenhum nó, ou bate em
// mais de um, não há caminho confiável e devolvemos [].
import type { UnidadeNode } from './dashboard-data';

const MAX_NIVEIS = 3;

/** Nome normalizado da "Secretaria do Tribunal" — o guarda-chuva que não aparece. */
const NOME_UMBRELLA = 'SECRETARIA DO TRIBUNAL';

/** Uma unidade do caminho de lotação: a sigla (exibida) e o nome por extenso (tooltip). */
export interface UnidadeLotacao {
  sigla: string;
  nome: string;
}

function normalizarUnidade(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** SEC ("Secretaria do Tribunal"): guarda-chuva administrativo, nunca exibido. */
function ehUmbrella(no: UnidadeNode): boolean {
  return no.sigla === 'SEC' || normalizarUnidade(no.nome) === NOME_UMBRELLA;
}

/** "SECRETARIA DE …", "SECRETARIA-GERAL …", "SECRETARIA DA …" — o teto da exibição. */
function ehSecretaria(no: UnidadeNode): boolean {
  return /^SECRETARIA[ -]/.test(normalizarUnidade(no.nome));
}

/** "SETOT / CSELE / STI" a partir do caminho resolvido. */
export function textoSiglas(unidades: UnidadeLotacao[]): string {
  return unidades.map((u) => u.sigla).join(' / ');
}

export type ResolvedorLotacao = (lotacao: string | null) => UnidadeLotacao[];

/**
 * Caminho de um nó (inclusive) até 3 unidades, da menor para a maior, parando
 * no nível de secretaria e pulando a "Secretaria do Tribunal" (ver regras no
 * topo do arquivo). Núcleo comum entre `criarResolvedorLotacao` (resolve um
 * nome plano de servidor até um nó) e a listagem de /indicadores (que já parte
 * do próprio nó).
 */
export function caminhoAcimaDe(
  no: UnidadeNode,
  porId: Map<string, UnidadeNode>,
): UnidadeLotacao[] {
  const caminho: UnidadeLotacao[] = [];
  let atual: UnidadeNode | undefined = no;
  while (atual && atual.parentId !== null && caminho.length < MAX_NIVEIS) {
    if (ehUmbrella(atual)) break; // "Secretaria do Tribunal" nunca aparece
    caminho.push({ sigla: atual.sigla, nome: atual.nome });
    if (ehSecretaria(atual)) break; // a exibição para no nível de secretaria
    atual = porId.get(atual.parentId);
  }
  return caminho;
}

/**
 * Constrói um resolvedor a partir da árvore de unidades já agregada. O
 * resultado é o caminho (até 3 unidades) da menor para a maior, parando no
 * nível de secretaria e pulando a "Secretaria do Tribunal" (ver regras no topo
 * do arquivo); lista vazia quando `arvore` é null, `lotacao` é vazia, ou o nome
 * não resolve para exatamente um nó.
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
    const no = porId.get(ids[0]);
    return no ? caminhoAcimaDe(no, porId) : [];
  };
}

/** Caminho de lotação como chave hierárquica (do topo para a folha), para
 *  ordenar agrupando por unidade-mãe: "SETOT / CSELE / STI" → ["STI","CSELE","SETOT"]. */
export function chaveHierarquicaLotacao(siglas: string): string[] {
  return siglas ? siglas.split(' / ').reverse() : [];
}

/** Compara duas chaves hierárquicas nível a nível; a mais curta (unidade-mãe)
 *  vem primeiro. */
export function compararHierarquico(a: string[], b: string[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const c = a[i].localeCompare(b[i], 'pt-BR');
    if (c) return c;
  }
  return 0;
}
