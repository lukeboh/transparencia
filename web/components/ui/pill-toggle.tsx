import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Pílula de ligar/desligar: acesa = incluído, apagada = fora. */
export function PillToggle({
  pressionado,
  onClick,
  children,
  className,
}: {
  pressionado: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressionado}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        pressionado
          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      {pressionado && <Check className="h-3 w-3 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
