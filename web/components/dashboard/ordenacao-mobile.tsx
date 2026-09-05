'use client';

import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Seletor de ordenação para a versão em cards (mobile) das tabelas — o
 *  cabeçalho clicável (`CabecalhoOrdenavel`) só existe na `<table>` de
 *  telas ≥ md, então esta é a forma de ordenar abaixo disso. Cada opção já
 *  carrega campo + direção (ex.: "nome:asc"); quem chama decide a chave e o
 *  rótulo, e faz o parse no `onMudar`. */
export function OrdenacaoMobile({
  opcoes,
  valorAtual,
  onMudar,
  className,
}: {
  opcoes: { valor: string; rotulo: string }[];
  valorAtual: string;
  onMudar: (valor: string) => void;
  className?: string;
}) {
  return (
    <label className={cn('flex min-w-[160px] flex-1 items-center gap-1.5 text-xs text-muted-foreground md:hidden', className)}>
      <ArrowUpDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">Ordenar por</span>
      <select
        value={valorAtual}
        onChange={(e) => onMudar(e.target.value)}
        aria-label="Ordenar por"
        className="h-9 w-full min-w-0 rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
