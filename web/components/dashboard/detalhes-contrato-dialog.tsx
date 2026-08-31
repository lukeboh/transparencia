'use client';

import { ExternalLink, HardHat, PencilLine } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { brlCompleto, numero as fmtNumero } from '@/lib/utils';
import { urlContrato, type ContratoResumo } from '@/lib/dashboard-data';

interface DetalhesContratoDialogProps {
  open: boolean;
  onClose: () => void;
  /** Número do contrato ("31/2023") — sempre exibido, mesmo sem vínculo com o Compras.gov.br. */
  numero: string;
  /** Enriquecimento do Compras.gov.br; null quando o número não casou com nenhum contrato da base. */
  contrato: ContratoResumo | null;
  /** Empresa da fonte de origem (ex.: PDF de terceirizados), usada quando `contrato` é null. */
  fornecedorFallback?: string;
  /** Quantidade de terceirizados neste contrato — informe só quando for contrato de cessão de mão de obra. */
  qtdeTerceirizados?: number;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/**
 * Modal padrão "Detalhes do Contrato": número, fornecedor, objeto em uma linha,
 * valores (global / empenhado / pago), vigência, classificação do app e — para
 * contratos de cessão de mão de obra — a quantidade de terceirizados. Fecha com
 * o link para o contrato detalhado no Compras.gov.br.
 */
export function DetalhesContratoDialog({
  open,
  onClose,
  numero,
  contrato,
  fornecedorFallback,
  qtdeTerceirizados,
}: DetalhesContratoDialogProps) {
  const fornecedor = contrato?.fornecedor || fornecedorFallback || '—';
  const temValores = contrato != null;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader
        titulo="Detalhes do Contrato"
        descricao={contrato ? undefined : 'Não vinculado ao Compras.gov.br — dados parciais.'}
        onClose={onClose}
      />

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{numero}</span>
          {contrato?.vigente && (
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
              Vigente
            </span>
          )}
          {contrato?.correcoes && contrato.correcoes.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
              title={contrato.correcoes.map((c) => `${c.motivo}\n\nFonte: ${c.fonte}`).join('\n\n---\n\n')}
            >
              <PencilLine className="h-3 w-3" aria-hidden />
              corrigido
            </span>
          )}
        </div>

        <p className="text-sm">{fornecedor}</p>

        {contrato?.objeto && (
          <p className="truncate text-xs text-muted-foreground" title={contrato.objeto}>
            {contrato.objeto}
          </p>
        )}

        <dl className="divide-y divide-border/50 rounded-md border border-border bg-card px-3 py-1">
          <Linha rotulo="Valor global">
            {temValores ? brlCompleto(contrato!.valorGlobal || 0) : '—'}
          </Linha>
          <Linha rotulo="Valor empenhado">
            {temValores ? brlCompleto(contrato!.valorEmpenhado || 0) : '—'}
          </Linha>
          <Linha rotulo="Valor pago">
            {temValores ? brlCompleto(contrato!.valorPago || 0) : '—'}
          </Linha>
          <Linha rotulo="Vigência">
            {contrato
              ? `${contrato.vigente ? 'Vigente' : 'Encerrado'}${contrato.ano ? ` · desde ${contrato.ano}` : ''}`
              : '—'}
          </Linha>
          <Linha rotulo="Classificação">{contrato?.categoria || '—'}</Linha>
          {qtdeTerceirizados != null && (
            <Linha rotulo="Terceirizados">
              <span className="inline-flex items-center gap-1">
                <HardHat className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {fmtNumero(qtdeTerceirizados)} no contrato
              </span>
            </Linha>
          )}
        </dl>
      </div>

      <div className="border-t border-border p-3">
        {contrato ? (
          <a
            href={urlContrato(contrato.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Abrir no Compras.gov.br
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            O número deste contrato não foi encontrado na base do Compras.gov.br do TSE.
          </p>
        )}
      </div>
    </Dialog>
  );
}
