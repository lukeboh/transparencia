'use client';

import { ExternalLink } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { dataUTC, nomeProprio, numero } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

function LinkPortaria({
  data,
  numero: numeroPortaria,
  url,
}: {
  data: string | null;
  numero: string | null;
  url?: string;
}) {
  if (!data) return <span className="text-muted-foreground">não localizada</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {dataUTC(data)}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
          title={numeroPortaria ? `Portaria nº ${numeroPortaria}` : 'Ver portaria'}
        >
          portaria
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </span>
  );
}

export function FuncoesHistoricoDialog({
  servidor,
  open,
  onClose,
}: {
  servidor: ServidorFuncoes;
  open: boolean;
  onClose: () => void;
}) {
  const mandatos = [...servidor.mandatos].sort((a, b) =>
    (b.nomeacaoData ?? '').localeCompare(a.nomeacaoData ?? ''),
  );

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        titulo={nomeProprio(servidor.nome)}
        descricao={`${numero(mandatos.length)} função${mandatos.length === 1 ? '' : 'ões'} comissionada${mandatos.length === 1 ? '' : 's'} no histórico`}
        onClose={onClose}
      />
      <ul className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
        {mandatos.map((m, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-md px-2.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                {m.tipo}-{m.nivel}
              </span>
              <span className="text-sm font-medium">{m.cargoTitulo}</span>
              {m.vigente && (
                <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
                  vigente
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{m.unidade}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Nomeação: </span>
                <LinkPortaria
                  data={m.nomeacaoData}
                  numero={m.nomeacaoPortaria?.numero ?? null}
                  url={m.nomeacaoPortaria?.url}
                />
              </div>
              <div>
                <span className="text-muted-foreground">Exoneração: </span>
                {m.vigente ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <LinkPortaria
                    data={m.exoneracaoData}
                    numero={m.exoneracaoPortaria?.numero ?? null}
                    url={m.exoneracaoPortaria?.url}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        Datas de nomeação/exoneração conforme a publicação no Diário Oficial da
        União referenciada em cada portaria; cada link abre o texto integral
        no site do TSE.
      </p>
    </Dialog>
  );
}
