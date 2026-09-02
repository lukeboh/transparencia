'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ExternalLink, PencilLine } from 'lucide-react';
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { BotaoFonteExterna } from '@/components/dashboard/botao-fonte-externa';
import { brlCompleto, cn, dataUTC, nomeProprio, numero } from '@/lib/utils';
import { rotuloPerfil } from '@/lib/perfis-fiscalizacao';
import {
  urlContrato,
  urlTeletrabalho,
  type ContratoResumo,
  type LinhaRanking,
  type LinhaTeletrabalho,
  type ServidorFuncoes,
} from '@/lib/dashboard-data';

// ── seção colapsável ────────────────────────────────────────────────────────
function SecaoColapsavel({
  titulo,
  resumo,
  inicialAberta = true,
  children,
}: {
  titulo: string;
  resumo?: string;
  inicialAberta?: boolean;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(inicialAberta);
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{titulo}</span>
          {resumo && <span className="text-xs text-muted-foreground">{resumo}</span>}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            aberta && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {aberta && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

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

// ── seção: Histórico de Funções ─────────────────────────────────────────────
function HistoricoFuncoes({ servidor }: { servidor: ServidorFuncoes | null }) {
  if (!servidor) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma função comissionada (FC/CJ) registrada para este servidor, nem na relação atual de
        agentes públicos, nem no histórico de portarias.
      </p>
    );
  }

  const mandatos = [...servidor.mandatos].sort((a, b) =>
    (b.nomeacaoData ?? '').localeCompare(a.nomeacaoData ?? ''),
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Função vigente: </span>
          <span className="font-medium">
            {servidor.funcaoAtual
              ? `${servidor.funcaoAtual.tipo}-${servidor.funcaoAtual.nivel} — ${servidor.funcaoAtual.cargoTitulo}`
              : 'nenhuma na relação atual de agentes públicos'}
          </span>
        </div>
      </div>

      {servidor.observacoes.length > 0 && (
        <div className="flex gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-0.5" aria-hidden />
          <ul className="space-y-1">
            {servidor.observacoes.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border/40">
        {mandatos.length === 0 && (
          <li className="py-3 text-center text-xs text-muted-foreground">
            Nenhum mandato encontrado no histórico de portarias cobertas.
          </li>
        )}
        {mandatos.map((m, i) => (
          <li key={i} className="flex flex-col gap-1.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                {m.tipo}-{m.nivel}
              </span>
              <span className="text-sm font-medium">{m.cargoTitulo}</span>
              {m.vigente && (
                <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
                  sem exoneração localizada
                </span>
              )}
              {m.exoneracaoInferida && (
                <span
                  className="rounded-sm bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground font-semibold"
                  title="Sem função na relação atual — mandato encerrado sem portaria de exoneração localizada"
                >
                  encerrada — exoneração não localizada
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
                ) : m.exoneracaoInferida ? (
                  <span className="text-muted-foreground">não localizada (inferida)</span>
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
    </div>
  );
}

// ── seção: Consolidado de Dias de Teletrabalho ──────────────────────────────
function ConsolidadoTeletrabalho({
  nome,
  linha,
}: {
  nome: string;
  linha: LinhaTeletrabalho | null;
}) {
  return (
    <div className="space-y-3">
      {!linha || linha.periodos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum período de teletrabalho registrado para este servidor.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {numero(linha.diasConsolidados)}
            </span>{' '}
            dia{linha.diasConsolidados === 1 ? '' : 's'} somados em{' '}
            {numero(linha.periodos.length)} período{linha.periodos.length === 1 ? '' : 's'} (sem
            merge de sobreposição).
          </p>
          <ul className="divide-y divide-border/40">
            {linha.periodos.map((p, i) => (
              <li key={i} className="flex flex-col gap-1 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {p.dataInicio ? dataUTC(p.dataInicio) : '—'} –{' '}
                    {p.dataFim ? dataUTC(p.dataFim) : 'hoje'}
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
        </>
      )}
      <BotaoFonteExterna
        href={urlTeletrabalho(nome)}
        titulo="Abre a consulta de teletrabalho do TSE já filtrada por este servidor, em nova aba"
      >
        Consulta de teletrabalho deste servidor no portal do TSE
      </BotaoFonteExterna>
    </div>
  );
}

// ── seção: Histórico de Contratos ──────────────────────────────────────────
function HistoricoContratos({
  linha,
  contratos,
}: {
  linha: LinhaRanking;
  contratos: ContratoResumo[];
}) {
  const itens = linha.contratos
    .map(({ i, papeis, funcaoNoContrato }) => ({
      ...contratos[i],
      papeisNoContrato: papeis,
      funcaoNoContrato,
    }))
    .filter((c) => c.id)
    .sort((a, b) => b.valorGlobal - a.valorGlobal);

  if (itens.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Este servidor não aparece como fiscal ou gestor em nenhum contrato do TSE.
      </p>
    );
  }

  const totalGlobal = itens.reduce((s, c) => s + (c.valorGlobal || 0), 0);
  const totalEmpenhado = itens.reduce((s, c) => s + (c.valorEmpenhado || 0), 0);
  const totalPago = itens.reduce((s, c) => s + (c.valorPago || 0), 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground tabular-nums">
        Global: {brlCompleto(totalGlobal)} · Emp: {brlCompleto(totalEmpenhado)} · Pg:{' '}
        {brlCompleto(totalPago)}
      </p>
      <ul className="divide-y divide-border/40">
        {itens.map((c) => (
          <li key={c.id}>
            <a
              href={urlContrato(c.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between gap-2 rounded-md py-2.5 transition-colors hover:bg-accent sm:flex-row sm:items-center"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium tabular-nums">{c.numero}</span>
                  {c.ano !== null && (
                    <span className="text-xs text-muted-foreground">{c.ano}</span>
                  )}
                  {c.vigente && (
                    <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
                      vigente
                    </span>
                  )}
                  {c.papeisNoContrato.length > 0 && (
                    <span
                      title={c.papeisNoContrato.join(', ')}
                      className="truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
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
              <span className="flex shrink-0 flex-col gap-0.5 border-t border-border/50 pt-1 font-mono text-xs sm:items-end sm:border-t-0 sm:pt-0">
                <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
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
      <p className="text-xs text-muted-foreground">
        Cada linha abre o contrato detalhado na consulta pública do Compras.gov.br, em nova aba.
      </p>
    </div>
  );
}

// ── modal ──────────────────────────────────────────────────────────────────
export function ServidorDetalheDialog({
  linha,
  servidorFuncoes,
  teletrabalho,
  lotacao,
  contratos,
  open,
  onClose,
}: {
  linha: LinhaRanking;
  servidorFuncoes: ServidorFuncoes | null;
  teletrabalho: LinhaTeletrabalho | null;
  /** Lotação atual resolvida: `siglas` = "SETOT / CSELE / STI" (ou nome plano
   *  quando não resolve); `unidades` = cada nível com sigla + nome por extenso. */
  lotacao: { siglas: string; unidades: { sigla: string; nome: string }[] };
  contratos: ContratoResumo[];
  open: boolean;
  onClose: () => void;
}) {
  const identidade = servidorFuncoes
    ? [servidorFuncoes.matricula && `Matrícula ${servidorFuncoes.matricula}`, servidorFuncoes.cargo]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        titulo="Detalhes do Servidor"
        descricao={nomeProprio(linha.nome) + (identidade ? ` — ${identidade}` : '')}
        onClose={onClose}
      />
      {lotacao.siglas && (
        <div className="border-b border-border px-4 py-3 text-xs">
          <div className="text-muted-foreground">Lotação atual</div>
          <div className="mt-0.5 font-medium tabular-nums">{lotacao.siglas}</div>
          {lotacao.unidades.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {lotacao.unidades.map((u, i) => (
                <li key={u.sigla + i}>
                  <span className="font-semibold">{u.sigla}</span> — {u.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="max-h-[75vh] overflow-y-auto">
        <SecaoColapsavel
          titulo="Histórico de Funções"
          resumo={
            servidorFuncoes
              ? `${numero(servidorFuncoes.mandatos.length)} mandato${servidorFuncoes.mandatos.length === 1 ? '' : 's'}`
              : 'sem registro'
          }
        >
          <HistoricoFuncoes servidor={servidorFuncoes} />
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Consolidado de Dias de Teletrabalho"
          resumo={
            teletrabalho
              ? `${numero(teletrabalho.diasConsolidados)} dia${teletrabalho.diasConsolidados === 1 ? '' : 's'}`
              : 'sem registro'
          }
        >
          <ConsolidadoTeletrabalho nome={linha.nome} linha={teletrabalho} />
        </SecaoColapsavel>

        <SecaoColapsavel
          titulo="Histórico de Contratos"
          resumo={`${numero(linha.contratos.length)} contrato${linha.contratos.length === 1 ? '' : 's'}`}
        >
          <HistoricoContratos linha={linha} contratos={contratos} />
        </SecaoColapsavel>
      </div>
    </Dialog>
  );
}
