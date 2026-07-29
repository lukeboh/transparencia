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
  export function agregarDashboard(contratos: unknown[]): unknown;
}
