'use client';

// Filtros compartilháveis pela URL, sem recarregar a página: cada tela lê a
// query string uma vez no mount (ver use-sincronizar-url.ts) e reescreve os
// próprios parâmetros a cada mudança com history.replaceState — nada de
// navegação do Next, nada de refetch, o scroll fica onde está.

/** Parâmetros da URL atual — vazio no servidor. */
export function lerParamsUrl(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/**
 * Reescreve na URL só os parâmetros informados; os demais são preservados.
 * Valor null/undefined/'' remove o parâmetro. Usa replaceState (não polui o
 * histórico a cada clique) e só toca a URL se algo mudou de fato.
 */
export function escreverParamsUrl(
  mudancas: Record<string, string | number | null | undefined>,
) {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null || valor === undefined || valor === '') sp.delete(chave);
    else sp.set(chave, String(valor));
  }
  const qs = sp.toString();
  const nova = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  const atual = `${window.location.pathname}${window.location.search}`;
  if (nova !== atual) window.history.replaceState(window.history.state, '', nova);
}

// ---------------------------------------------------------------------------
// Codecs para os tipos de filtro que se repetem pelas telas.
// ---------------------------------------------------------------------------

/** Lista <-> csv. Lista vazia => undefined (o parâmetro sai da URL). */
export const csv = {
  escrever: (lista: readonly string[]): string | undefined =>
    lista.length ? lista.join(',') : undefined,
  ler: (v: string | null): string[] | null =>
    v === null ? null : v.split(',').filter(Boolean),
};

/**
 * Multi-seleção "padrão = tudo marcado" cujo UNIVERSO pode mudar em runtime
 * (ex.: níveis de função / papéis derivados dos dados, que o scraper atualiza).
 * Guarda a lista de SELECIONADOS, e só quando é um subconjunto próprio e
 * não-vazio: "tudo" e "nada" (que essas telas tratam como "tudo") não vão para
 * a URL. Assim o link não muda de significado se o universo ganhar/perder um
 * item entre o momento de copiar e o de abrir.
 */
export const incluidos = {
  escrever: (universo: readonly string[], selecionados: readonly string[]): string | undefined => {
    const uni = new Set(universo);
    const dentro = selecionados.filter((x) => uni.has(x));
    if (dentro.length === 0 || dentro.length >= universo.length) return undefined;
    return dentro.join(',');
  },
  /** csv de selecionados; ausente ou vazio/ inválido => o universo inteiro. */
  ler: (universo: readonly string[], v: string | null): string[] => {
    if (v === null) return [...universo];
    const uni = new Set(universo);
    const sel = v.split(',').filter((x) => uni.has(x));
    return sel.length > 0 ? sel : [...universo];
  },
};

/**
 * Multi-seleção "padrão = tudo marcado" com UNIVERSO FIXO: guarda na URL só os
 * itens DESMARCADOS, então o link fica curto no caso comum. Só use quando o
 * universo é estático (ex.: uma lista de constantes) — se ele muda em runtime,
 * prefira `incluidos`.
 */
export const excluidos = {
  escrever: (universo: readonly string[], selecionados: readonly string[]): string | undefined => {
    const sel = new Set(selecionados);
    const fora = universo.filter((x) => !sel.has(x));
    return fora.length ? fora.join(',') : undefined;
  },
  /** csv de excluídos aplicado sobre o universo => lista de selecionados. */
  ler: (universo: readonly string[], v: string | null): string[] => {
    if (v === null) return [...universo];
    const fora = new Set(v.split(',').filter(Boolean));
    return universo.filter((x) => !fora.has(x));
  },
};

/** Booleano só aparece na URL quando difere do padrão. */
export const bool = {
  escrever: (valor: boolean, padrao: boolean): string | undefined =>
    valor === padrao ? undefined : valor ? '1' : '0',
  ler: (v: string | null, padrao: boolean): boolean => (v === null ? padrao : v === '1'),
};

/** Ordenação "campo.direcao" (ex.: "valor.desc"); null => sem parâmetro. */
export const ordem = {
  escrever: (campo: string | null | undefined, direcao: string | null | undefined): string | undefined =>
    campo && direcao ? `${campo}.${direcao}` : undefined,
  ler: (v: string | null): { campo: string; direcao: 'asc' | 'desc' } | null => {
    if (!v) return null;
    const i = v.lastIndexOf('.');
    if (i < 0) return null;
    const campo = v.slice(0, i);
    const direcao = v.slice(i + 1);
    if (!campo || (direcao !== 'asc' && direcao !== 'desc')) return null;
    return { campo, direcao };
  },
};

/** Número inteiro >= min; fora disso ou ausente => padrao. */
export const inteiro = {
  escrever: (valor: number, padrao: number): string | undefined =>
    valor === padrao ? undefined : String(valor),
  ler: (v: string | null, padrao: number, min = 0): number => {
    if (v === null) return padrao;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= min ? n : padrao;
  },
};
