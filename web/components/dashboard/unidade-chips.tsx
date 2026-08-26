import { percentual } from '@/lib/utils';
import type { FiscalContagem, FuncaoContagem } from '@/lib/dashboard-data';

export type NivelDetalhe = 'detalhado' | 'simples';
export type BasePercentual = 'geral' | 'unidade';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary">
      {children}
    </span>
  );
}

/**
 * "detalhado": um chip por tipo-nível (FC-1, FC-2…CJ-4). "simples": só 2
 * chips — todos os FC somados, todos os CJ somados. Em ambos os casos, o
 * percentual de cada chip é sobre `denominador` — os servidores do órgão
 * inteiro ou só da própria unidade, conforme o toggle "Base do percentual"
 * (não é mais composição entre os chips: eles não somam 100%).
 */
export function FuncaoChips({
  contagens,
  modo,
  denominador,
}: {
  contagens: FuncaoContagem[];
  modo: NivelDetalhe;
  denominador: number;
}) {
  if (contagens.length === 0) {
    return <span className="text-xs text-muted-foreground">Nenhuma função nesta unidade</span>;
  }

  if (modo === 'simples') {
    const porTipo = (tipo: 'FC' | 'CJ') => contagens.filter((f) => f.tipo === tipo).reduce((s, f) => s + f.quantidade, 0);
    const chips = (['FC', 'CJ'] as const).map((tipo) => ({ tipo, quantidade: porTipo(tipo) })).filter((c) => c.quantidade > 0);
    return (
      <span className="flex flex-wrap items-center gap-1">
        {chips.map((c) => (
          <Chip key={c.tipo}>
            {c.tipo} · {c.quantidade} · {percentual(c.quantidade, denominador)}%
          </Chip>
        ))}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {contagens.map((f) => (
        <Chip key={`${f.tipo}-${f.nivel}`}>
          {f.tipo}-{f.nivel} · {f.quantidade} · {percentual(f.quantidade, denominador)}%
        </Chip>
      ))}
    </span>
  );
}

/**
 * "detalhado": um chip por papel (Fiscal Titular, Gestor…). "simples": um
 * único chip "Fiscal" com a soma de todos os papéis. Percentual sobre
 * `denominador` (servidores do órgão ou da unidade, ver FuncaoChips) — como
 * uma pessoa pode ter mais de um papel, a soma pode passar de 100%.
 */
export function FiscalChips({
  contagens,
  modo,
  denominador,
}: {
  contagens: FiscalContagem[];
  modo: NivelDetalhe;
  denominador: number;
}) {
  if (contagens.length === 0) {
    return <span className="text-xs text-muted-foreground">Nenhum fiscal/gestor nesta unidade</span>;
  }

  if (modo === 'simples') {
    const total = contagens.reduce((s, f) => s + f.quantidade, 0);
    return (
      <span className="flex flex-wrap items-center gap-1">
        <Chip>
          Fiscal · {total} · {percentual(total, denominador)}%
        </Chip>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {contagens.map((f) => (
        <Chip key={f.papel}>
          {f.papel} · {f.quantidade} · {percentual(f.quantidade, denominador)}%
        </Chip>
      ))}
    </span>
  );
}
