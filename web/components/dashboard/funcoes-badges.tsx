'use client';

import { cn } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

/**
 * Função vigente segundo a fonte primária (relação atual de agentes
 * públicos), quando houver; senão a mais recente do histórico de portarias
 * (fonte secundária) — cobre quem só consta no histórico.
 */
export function funcaoDestaque(servidor: ServidorFuncoes) {
  if (servidor.funcaoAtual) {
    return { ...servidor.funcaoAtual, vigente: true, exoneracaoInferida: false };
  }
  const ordenados = [...servidor.mandatos].sort((a, b) =>
    (b.nomeacaoData ?? '').localeCompare(a.nomeacaoData ?? ''),
  );
  return ordenados[0] ?? null;
}

/** Nível FC/CJ vigente hoje ("FC-3"), ou null quando o servidor não tem função
 *  vigente — nem na relação atual, nem "em aberto" nas portarias. */
function chaveFuncaoVigente(servidor: ServidorFuncoes): string | null {
  if (servidor.funcaoAtual) {
    return `${servidor.funcaoAtual.tipo}-${servidor.funcaoAtual.nivel}`;
  }
  const m = servidor.mandatos.find((x) => x.vigente);
  return m ? `${m.tipo}-${m.nivel}` : null;
}

/** Todas as funções FC/CJ que o servidor já ocupou, distintas por nível, da
 *  vigente (se houver) para a mais antiga. */
function funcoesOcupadas(servidor: ServidorFuncoes) {
  const vigente = chaveFuncaoVigente(servidor);
  const porChave = new Map<
    string,
    { tipo: string; nivel: number; cargoTitulo: string; recente: string }
  >();
  if (servidor.funcaoAtual) {
    const k = `${servidor.funcaoAtual.tipo}-${servidor.funcaoAtual.nivel}`;
    porChave.set(k, { ...servidor.funcaoAtual, recente: '￿' });
  }
  for (const m of servidor.mandatos) {
    const k = `${m.tipo}-${m.nivel}`;
    const recente = m.nomeacaoData ?? m.exoneracaoData ?? '';
    const atual = porChave.get(k);
    if (!atual || recente > atual.recente) {
      porChave.set(k, { tipo: m.tipo, nivel: m.nivel, cargoTitulo: m.cargoTitulo, recente });
    }
  }
  return [...porChave.entries()]
    .map(([chave, f]) => ({ chave, ...f, vigente: chave === vigente }))
    .sort((a, b) => {
      if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;
      return b.recente.localeCompare(a.recente);
    });
}

/** "FC-3 (vigente), FC-1, CJ-2" — para exportação. */
export function funcoesTexto(servidor: ServidorFuncoes): string {
  const itens = funcoesOcupadas(servidor);
  if (itens.length === 0) return '';
  return itens.map((f) => (f.vigente ? `${f.chave} (vigente)` : f.chave)).join(', ');
}

export function FuncoesBadges({
  servidor,
  todas = false,
}: {
  servidor: ServidorFuncoes;
  /** Mostra TODAS as funções já ocupadas (a vigente destacada, as anteriores
   *  apagadas) em vez de só a de destaque + "+N". */
  todas?: boolean;
}) {
  if (todas) {
    const itens = funcoesOcupadas(servidor);
    if (itens.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {itens.map((f) => (
          <span
            key={f.chave}
            title={
              f.vigente
                ? `${f.cargoTitulo} — função vigente hoje`
                : `${f.cargoTitulo} — função que o servidor já ocupou`
            }
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
              f.vigente
                ? 'border border-primary/40 bg-primary/15 text-primary'
                : 'bg-muted/40 text-muted-foreground/50',
            )}
          >
            {f.tipo}-{f.nivel}
          </span>
        ))}
      </span>
    );
  }

  const destaque = funcaoDestaque(servidor);
  const restantes = servidor.mandatos.length - (destaque?.vigente ? 0 : destaque ? 1 : 0);
  if (!destaque) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span
        className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary"
        title={
          destaque.exoneracaoInferida
            ? `${destaque.cargoTitulo} — encerrada: a relação atual mostra o servidor sem função (exoneração não localizada)`
            : destaque.cargoTitulo
        }
      >
        {destaque.tipo}-{destaque.nivel}
      </span>
      {destaque.vigente && (
        <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
          vigente
        </span>
      )}
      {destaque.exoneracaoInferida && (
        <span
          className="rounded-sm bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground font-semibold"
          title="Sem função na relação atual — mandato encerrado sem portaria de exoneração localizada"
        >
          encerrada
        </span>
      )}
      {restantes > 0 && <span className="text-xs text-muted-foreground">+{restantes}</span>}
    </span>
  );
}
