'use client';

import { ExternalLink, PencilLine } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { brlCompleto, numero } from '@/lib/utils';
import { rotuloPerfil } from '@/lib/perfis-fiscalizacao';
import { urlContrato, type ContratoResumo, type FuncaoResumo } from '@/lib/dashboard-data';

export interface ContratoAuditavel extends ContratoResumo {
  /** Papéis da pessoa neste contrato, quando o modal é de um responsável. */
  papeisNoContrato?: string[];
  /** Função comissionada que a pessoa ocupava durante a vigência deste contrato, quando houver. */
  funcaoNoContrato?: FuncaoResumo | null;
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
  const totalGlobal = contratos.reduce((s, c) => s + (c.valorGlobal || 0), 0);
  const totalEmpenhado = contratos.reduce((s, c) => s + (c.valorEmpenhado || 0), 0);
  const totalPago = contratos.reduce((s, c) => s + (c.valorPago || 0), 0);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        titulo={titulo}
        descricao={
          descricao ??
          `${numero(contratos.length)} contrato${contratos.length === 1 ? '' : 's'} · Global: ${brlCompleto(totalGlobal)} | Emp: ${brlCompleto(totalEmpenhado)} | Pg: ${brlCompleto(totalPago)}`
        }
        onClose={onClose}
      />
      <ul className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
        {contratos.map((c) => (
          <li key={c.id}>
            <a
              href={urlContrato(c.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium tabular-nums">{c.numero}</span>
                  {c.ano !== null && (
                    <span className="text-xs text-muted-foreground">{c.ano}</span>
                  )}
                  {c.vigente && (
                    <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
                      vigente
                    </span>
                  )}
                  {c.papeisNoContrato && (
                    <span
                      title={c.papeisNoContrato.join(', ')}
                      className="truncate text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                    >
                      {c.papeisNoContrato.map(rotuloPerfil).join(', ')}
                    </span>
                  )}
                  {c.funcaoNoContrato && (
                    <span
                      className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                      title={`${c.funcaoNoContrato.cargoTitulo} — ${c.funcaoNoContrato.tipo}-${c.funcaoNoContrato.nivel} durante a vigência deste contrato`}
                    >
                      {c.funcaoNoContrato.tipo}-{c.funcaoNoContrato.nivel}
                    </span>
                  )}
                  {c.correcoes.length > 0 && (
                    <span
                      className="shrink-0 flex items-center gap-0.5 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                      title={c.correcoes.map((cor) => `${cor.motivo}\n\nFonte: ${cor.fonte}`).join('\n\n---\n\n')}
                    >
                      <PencilLine className="h-3 w-3" aria-hidden />
                      corrigido
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
              <span className="flex shrink-0 flex-col sm:items-end text-xs font-mono gap-0.5 border-t sm:border-t-0 pt-1 sm:pt-0 border-border/50">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                  <span>Global: {brlCompleto(c.valorGlobal)}</span>
                  <ExternalLink
                    className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
                <span className="text-muted-foreground">Emp: {brlCompleto(c.valorEmpenhado || 0)}</span>
                <span className="text-muted-foreground">Pg: {brlCompleto(c.valorPago || 0)}</span>
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
