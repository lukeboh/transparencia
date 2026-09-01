'use client';

import type { ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContagemDonut, type FatiaContagem } from '@/components/dashboard/contagem-donut';
import { cn, numero } from '@/lib/utils';

interface KpiRoscaCardProps {
  titulo: ReactNode;
  icone: ReactNode;
  fatias: FatiaContagem[];
  formatar?: (n: number) => string;
  unidadeSingular?: string;
  unidadePlural?: string;
  /** Clique numa fatia/legenda com `meta` definido. */
  onSelecionar?: (fatia: FatiaContagem) => void;
  /** Linha de texto abaixo do donut. */
  nota?: ReactNode;
  /** Botão-link abaixo da nota (rola/abre um detalhe da página). */
  acaoRotulo?: string;
  onAcao?: () => void;
  /** Mostrado quando não há fatias com quantidade > 0. */
  fallbackValor?: string;
  fallbackNota?: ReactNode;
  /** Rosca menor — para KPIs simples (2 fatias) que ocupam menos colunas. */
  compacto?: boolean;
  className?: string;
}

/**
 * Card de KPI cujo conteúdo é uma rosca (`ContagemDonut`) — mesmo recibo visual
 * dos KPIs de /terceirizados: título + ícone no topo, donut, uma nota e um
 * link opcional para ver os detalhes.
 */
export function KpiRoscaCard({
  titulo,
  icone,
  fatias,
  formatar,
  unidadeSingular,
  unidadePlural,
  onSelecionar,
  nota,
  acaoRotulo,
  onAcao,
  fallbackValor,
  fallbackNota,
  compacto = false,
  className,
}: KpiRoscaCardProps) {
  const total = fatias.reduce((s, f) => s + f.quantidade, 0);
  const temDados = fatias.length > 0 && total > 0;

  return (
    <Card className={cn('transition-colors duration-200', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{titulo}</CardTitle>
        <span className="text-muted-foreground">{icone}</span>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-1">
        {temDados ? (
          <ContagemDonut
            fatias={fatias}
            tamanho={compacto ? 116 : 168}
            formatar={formatar}
            unidadeSingular={unidadeSingular}
            unidadePlural={unidadePlural}
            onSelecionar={onSelecionar ? (f) => onSelecionar(f) : undefined}
          />
        ) : (
          <div className="py-4 text-center">
            <div className="text-3xl font-semibold tabular-nums">{fallbackValor ?? numero(0)}</div>
            {fallbackNota && <p className="mt-1 text-xs text-muted-foreground">{fallbackNota}</p>}
          </div>
        )}
        {nota && <p className="text-center text-xs text-muted-foreground">{nota}</p>}
        {onAcao && acaoRotulo && (
          <button
            type="button"
            onClick={onAcao}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {acaoRotulo} <ArrowDown className="h-3 w-3" aria-hidden />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
