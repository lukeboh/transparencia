'use client';

import { ExternalLink } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { dataUTC, nomeProprio, numero } from '@/lib/utils';
import { urlTeletrabalho, type LinhaTeletrabalho } from '@/lib/dashboard-data';

export function TeletrabalhoDetalheDialog({
  linha,
  open,
  onClose,
}: {
  linha: LinhaTeletrabalho;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        titulo={nomeProprio(linha.nome)}
        descricao={`${numero(linha.diasConsolidados)} dia${linha.diasConsolidados === 1 ? '' : 's'} em teletrabalho em ${numero(linha.periodos.length)} período${linha.periodos.length === 1 ? '' : 's'}`}
        onClose={onClose}
      />

      <ul className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
        {linha.periodos.length === 0 && (
          <li className="px-2.5 py-6 text-center text-xs text-muted-foreground">
            Nenhum período encontrado.
          </li>
        )}
        {linha.periodos.map((p, i) => (
          <li key={i} className="flex flex-col gap-1.5 rounded-md px-2.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium tabular-nums">
                {p.dataInicio ? dataUTC(p.dataInicio) : '—'} – {p.dataFim ? dataUTC(p.dataFim) : 'hoje'}
              </span>
              {!p.dataFim && (
                <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
                  em aberto
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {numero(p.dias)} dia{p.dias === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {p.unidadeNiveis.length > 0 ? p.unidadeNiveis.join(' · ') : p.unidade}
            </p>
          </li>
        ))}
      </ul>

      <p className="flex flex-col gap-1.5 border-t border-border p-3 text-xs text-muted-foreground">
        Unidade listada do menor nível (seção) para o maior (secretaria/gabinete/assessoria).
        <a
          href={urlTeletrabalho(linha.nome)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 self-start text-primary hover:underline font-medium"
        >
          Ver na fonte (TSE), filtrado por este servidor
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>
    </Dialog>
  );
}
