'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
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

function LinhaPerfil({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <span className="text-muted-foreground">{rotulo}: </span>
      <span className="font-medium">{valor}</span>
    </div>
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
        descricao={
          servidor.naRelacaoAtual
            ? 'Dados atuais da Relação de agentes públicos do TSE + histórico de portarias'
            : 'Não consta na relação atual de agentes públicos — dados só do histórico de portarias'
        }
        onClose={onClose}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-border p-3 text-xs">
        <LinhaPerfil rotulo="Matrícula" valor={servidor.matricula} />
        <LinhaPerfil rotulo="Cargo efetivo" valor={servidor.cargo} />
        <LinhaPerfil rotulo="Lotação" valor={servidor.lotacao} />
        <LinhaPerfil
          rotulo="Função vigente"
          valor={
            servidor.funcaoAtual
              ? `${servidor.funcaoAtual.tipo}-${servidor.funcaoAtual.nivel} — ${servidor.funcaoAtual.cargoTitulo}`
              : null
          }
        />
        {!servidor.funcaoAtual && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Função vigente: </span>
            <span className="font-medium">nenhuma na relação atual de agentes públicos</span>
          </div>
        )}
      </div>

      {servidor.observacoes.length > 0 && (
        <div className="flex gap-2 border-b border-border bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-0.5" aria-hidden />
          <ul className="space-y-1">
            {servidor.observacoes.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
        {mandatos.length === 0 && (
          <li className="px-2.5 py-6 text-center text-xs text-muted-foreground">
            Nenhum mandato encontrado no histórico de portarias cobertas.
          </li>
        )}
        {mandatos.map((m, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-md px-2.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                {m.tipo}-{m.nivel}
              </span>
              <span className="text-sm font-medium">{m.cargoTitulo}</span>
              {m.vigente && (
                <span
                  className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold"
                  title="Nenhuma portaria de exoneração foi localizada para este mandato no histórico coberto"
                >
                  sem exoneração localizada
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
        Função vigente e dados de matrícula/cargo/lotação vêm da Relação de
        agentes públicos do TSE (fonte primária, atualizada diariamente, sem
        histórico). Datas de nomeação/exoneração vêm do histórico de
        portarias (fonte secundária); cada link abre o texto integral no site
        do TSE.
      </p>
    </Dialog>
  );
}
