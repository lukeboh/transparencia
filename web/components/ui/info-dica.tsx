'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Ícone (i) que abre uma dica curta com a explicação de um termo. Aparece no
 * hover (mouse) e fica "preso" no clique — para toque e teclado. Fecha no Esc
 * ou clique fora. O texto é conteúdo explicativo, sem links de ação.
 */
export function InfoDica({
  children,
  titulo,
  className,
  tamanho = 'sm',
  alinhamento = 'centro',
}: {
  children: ReactNode;
  /** Rótulo acessível do botão, ex.: "O que é lotação?". */
  titulo: string;
  className?: string;
  tamanho?: 'sm' | 'md';
  /** Lado da dica em relação ao ícone — evita corte na borda da tela. */
  alinhamento?: 'centro' | 'esquerda' | 'direita';
}) {
  const [preso, setPreso] = useState(false);
  const [sobre, setSobre] = useState(false);
  const aberto = preso || sobre;
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!preso) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPreso(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreso(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [preso]);

  const tamIcone = tamanho === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const posicao =
    alinhamento === 'esquerda'
      ? 'left-0'
      : alinhamento === 'direita'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex align-middle', className)}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
    >
      <button
        type="button"
        aria-label={titulo}
        aria-expanded={aberto}
        aria-describedby={aberto ? id : undefined}
        onClick={() => setPreso((v) => !v)}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Info className={tamIcone} aria-hidden />
      </button>
      {aberto && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute top-[calc(100%+6px)] z-50 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-2.5',
            // whitespace-normal: força a quebra mesmo dentro de um <th>/<td>, que
            // herdam `whitespace-nowrap` do componente de tabela e fariam a dica
            // estourar numa linha só.
            'whitespace-normal break-words text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-md',
            posicao,
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
