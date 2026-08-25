import { percentual } from '@/lib/utils';
import type { FiscalContagem, FuncaoContagem } from '@/lib/dashboard-data';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary">
      {children}
    </span>
  );
}

/** Chips "FC-1 · 12 · 34%" — percentual sobre a soma de todas as funções DESSA unidade (somam ~100% entre si). */
export function FuncaoChips({ contagens }: { contagens: FuncaoContagem[] }) {
  if (contagens.length === 0) {
    return <span className="text-xs text-muted-foreground">Nenhuma função nesta unidade</span>;
  }
  const total = contagens.reduce((s, f) => s + f.quantidade, 0);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {contagens.map((f) => (
        <Chip key={`${f.tipo}-${f.nivel}`}>
          {f.tipo}-{f.nivel} · {f.quantidade} · {percentual(f.quantidade, total)}%
        </Chip>
      ))}
    </span>
  );
}

/** Chips "Fiscal Titular · 3 · 60%" — percentual sobre a soma de todos os fiscais DESSA unidade. Uma pessoa pode ter mais de um papel, então a soma pode passar do total de servidores da unidade. */
export function FiscalChips({ contagens }: { contagens: FiscalContagem[] }) {
  if (contagens.length === 0) {
    return <span className="text-xs text-muted-foreground">Nenhum fiscal/gestor nesta unidade</span>;
  }
  const total = contagens.reduce((s, f) => s + f.quantidade, 0);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {contagens.map((f) => (
        <Chip key={f.papel}>
          {f.papel} · {f.quantidade} · {percentual(f.quantidade, total)}%
        </Chip>
      ))}
    </span>
  );
}
