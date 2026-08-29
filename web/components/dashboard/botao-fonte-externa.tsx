'use client';

import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Botão padrão de "sair para a fonte externa". Por convenção da aplicação, ele
 * só aparece DENTRO de um modal de detalhe: o primeiro nível de detalhamento é
 * sempre interno, e este botão é o único ponto em que mandamos o usuário para
 * outra aba (a página de origem do dado, no TSE / Compras.gov.br / etc.).
 */
export function BotaoFonteExterna({
  href,
  children = 'Fonte externa',
  titulo,
  className,
}: {
  href: string;
  children?: ReactNode;
  titulo?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-card px-2.5 py-1.5',
        'text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {children}
    </a>
  );
}
