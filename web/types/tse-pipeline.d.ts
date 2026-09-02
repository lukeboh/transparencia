// Declarações dos módulos JS do pipeline compartilhado (src/tse, fora de web/),
// consumidos pela rota /api/tse/dados.

declare module '*src/tse/scrapeContratos.js' {
  export interface OpcoesScrape {
    pageSize?: number;
    concurrency?: number;
    cacheContratos?: unknown[];
    onProgress?: (feitos: number, total: number) => void;
  }
  export function scrapeContratos(
    unidade?: string,
    opcoes?: OpcoesScrape,
  ): Promise<unknown[]>;
}

declare module '*src/tse/agregarDashboard.js' {
  export function agregarDashboard(
    contratos: unknown[],
    movimentosFuncoes?: unknown[],
    agentesPublicos?: unknown[],
    excecoes?: unknown[],
    movimentosTeletrabalho?: unknown[],
    arvoreUnidades?: unknown,
    terceirizados?: unknown[],
    horasExtras?: unknown,
  ): unknown;
}

declare module '*src/tse/excecoes.js' {
  export interface Excecao {
    id: string;
    overrides: Record<string, unknown>;
    motivo: string;
    fonte: string;
    registradoEm?: string;
  }
  export function carregarExcecoes(caminho?: string): Excecao[];
  export function aplicarExcecoes<T extends { id: string }>(contratos: T[], excecoes?: Excecao[]): T[];
}

declare module '*src/tse/scrapeFuncoes.js' {
  export interface OpcoesScrapeFuncoes {
    anoInicio?: number;
    anoFim?: number;
    concurrency?: number;
    cacheMovimentos?: unknown[];
    onProgress?: (feitos: number, total: number) => void;
  }
  export function scrapeFuncoes(opcoes?: OpcoesScrapeFuncoes): Promise<unknown[]>;
}

declare module '*src/tse/scrapeAgentesPublicos.js' {
  export function scrapeAgentesPublicos(): Promise<unknown[]>;
}

declare module '*src/tse/scrapeTeletrabalho.js' {
  export function scrapeTeletrabalho(): Promise<unknown[]>;
}

declare module '*src/tse/scrapeUnidades.js' {
  export function scrapeUnidades(): Promise<unknown>;
}
