'use client';

import { ExternalLink } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { brlCompleto, numero } from '@/lib/utils';
import { urlContrato, type ContratoResumo } from '@/lib/dashboard-data';

export interface ContratoAuditavel extends ContratoResumo {
  /** Papéis da pessoa neste contrato, quando o modal é de um responsável. */
  papeisNoContrato?: string[];
}

interface ContratosDialogProps {
  titulo: string;
  descricao?: string;
  contratos: ContratoAuditavel[];
  open: boolean;
  onClose: () => void;
}

/**
 * Auditoria: a consulta pública do Comprasnet não aceita filtros equivalentes
 * via URL (só `unidade`), então cada dado do dashboard abre este modal com os
 * contratos que o compõem — e cada linha abre o contrato detalhado na fonte,
 * em nova aba.
 */
export function ContratosDialog({
  titulo,
  descricao,
  contratos,
  open,
  onClose,
}: ContratosDialogProps) {
  const total = contratos.reduce((s, c) => s + c.valorGlobal, 0);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        titulo={titulo}
        descricao={
          descricao ??
          `${numero(contratos.length)} contrato${contratos.length === 1 ? '' : 's'} · ${brlCompleto(total)}`
        }
        onClose={onClose}
      />
      <ul className="max-h-[60vh] overflow-y-auto p-2">
        {contratos.map((c) => (
          <li key={c.id}>
            <a
              href={urlContrato(c.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-medium tabular-nums">{c.numero}</span>
                  {c.ano !== null && (
                    <span className="text-xs text-muted-foreground">{c.ano}</span>
                  )}
                  {c.vigente && (
                    <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground">
                      vigente
                    </span>
                  )}
                  {c.papeisNoContrato && (
                    <span className="truncate text-xs text-muted-foreground">
                      {c.papeisNoContrato.join(', ')}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {c.fornecedor}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground/80">
                  {c.objeto}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                <span className="text-sm font-medium tabular-nums">
                  {brlCompleto(c.valorGlobal)}
                </span>
                <ExternalLink
                  className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        Cada linha abre o contrato detalhado na consulta pública do Compras.gov.br,
        em nova aba.
      </p>
    </Dialog>
  );
}
