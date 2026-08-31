'use client';

import { Check, ChevronDown, ChevronUp, Search, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Campo de busca textual reaproveitável (mesmo visual das tabelas do projeto). */
export function CampoBusca({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  icone: Icone = Search,
  listId,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
  rotulo: string;
  icone?: LucideIcon;
  listId?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative max-w-sm flex-1 min-w-[220px]', className)}>
      <Icone
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={valor}
        list={listId}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm text-foreground',
          'placeholder:text-muted-foreground outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {valor && (
        <button
          type="button"
          onClick={() => aoMudar('')}
          aria-label={`Limpar ${rotulo.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Toggle padrão **Vigente**: "está valendo agora — não é do passado, ainda não
 * acabou". Regra do projeto (ver README, seção "Regra: filtro Vigente sempre
 * ligado por padrão"): todo filtro Vigente começa **ligado**; o usuário
 * desliga de propósito para enxergar também o histórico.
 */
export function VigenteToggle({
  ligado,
  onChange,
  titulo,
  className,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  titulo?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!ligado)}
      aria-pressed={ligado}
      title={titulo ?? 'Mostrar só o que está vigente agora; desligue para ver também o histórico'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-ring',
        ligado
          ? 'bg-primary text-primary-foreground shadow-2xs'
          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {ligado && <Check className="h-3 w-3 shrink-0" aria-hidden />}
      Vigente
    </button>
  );
}

/** Botão "Recolher / Expandir" para o corpo de um card (tabela, lista…). */
export function ColapsarBotao({
  colapsado,
  onToggle,
  rotulo,
  className,
}: {
  colapsado: boolean;
  onToggle: () => void;
  /** Nome do que colapsa, para o title (ex.: "a tabela"). */
  rotulo?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!colapsado}
      title={`${colapsado ? 'Expandir' : 'Recolher'}${rotulo ? ` ${rotulo}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      {colapsado ? 'Expandir' : 'Recolher'}
      {colapsado ? <ChevronDown className="h-3 w-3" aria-hidden /> : <ChevronUp className="h-3 w-3" aria-hidden />}
    </button>
  );
}
