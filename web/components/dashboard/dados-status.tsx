'use client';

import { LoaderCircle } from 'lucide-react';
import { dataUTC, numero } from '@/lib/utils';
import type { EstadoDados } from '@/lib/use-dados';

/** Chip de status da carga automática de dados no header. */
export function DadosStatus({ estado }: { estado: EstadoDados }) {
  if (estado.atualizando) {
    const { progresso } = estado;
    const rotulo =
      progresso?.fase === 'funcoes'
        ? 'atualizando funções comissionadas'
        : progresso?.fase === 'unidades'
          ? 'atualizando unidades e lotações'
          : 'atualizando da fonte';
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {rotulo}
        {progresso && progresso.total > 0 && (
          <span className="tabular-nums">
            {numero(progresso.feitos)}/{numero(progresso.total)}
          </span>
        )}
        {progresso?.fase === 'funcoes' && (
          <span className="hidden sm:inline">(1ª vez pode levar dezenas de minutos)</span>
        )}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      dados de {dataUTC(estado.dados.geradoEm)}
      {estado.origem === 'fonte' && ' · atualizados da fonte'}
    </span>
  );
}
