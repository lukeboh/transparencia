'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { cn, numero } from '@/lib/utils';
import { exportarDados, type ColunaExport, type FormatoExport } from '@/lib/exportar-dados';

interface BotaoExportarProps<T> {
  /** Linhas já filtradas/ordenadas, exatamente como estão na tela. */
  linhas: T[];
  colunas: ColunaExport<T>[];
  /** Base do nome do arquivo, sem data nem extensão (ex.: "fiscais"). */
  nomeArquivo: string;
  /** Nome da aba na planilha .xls (default "Dados"). */
  nomeAba?: string;
  className?: string;
}

/** Botão "Exportar" com menu de formato (Excel .xls / CSV). Exporta sempre o
 *  conjunto de linhas recebido — quem chama passa o recorte já filtrado. */
export function BotaoExportar<T>({
  linhas,
  colunas,
  nomeArquivo,
  nomeAba,
  className,
}: BotaoExportarProps<T>) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const vazio = linhas.length === 0;

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('pointerdown', fechar);
    return () => document.removeEventListener('pointerdown', fechar);
  }, [aberto]);

  function exportar(formato: FormatoExport) {
    setAberto(false);
    if (!vazio) exportarDados(formato, linhas, colunas, nomeArquivo, nomeAba);
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        disabled={vazio}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors',
          'hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Download className="h-4 w-4" aria-hidden />
        Exportar
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {numero(linhas.length)} {linhas.length === 1 ? 'linha' : 'linhas'} · filtro atual
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => exportar('xls')}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="font-medium">Excel</span>
            <span className="text-xs text-muted-foreground">.xls</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => exportar('csv')}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="font-medium">CSV</span>
            <span className="text-xs text-muted-foreground">.csv</span>
          </button>
        </div>
      )}
    </div>
  );
}
