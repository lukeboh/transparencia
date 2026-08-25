'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Briefcase, Check, Laptop, Network, Scale, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { FuncaoStatCard } from '@/components/dashboard/funcao-stat-card';
import { contarPorFuncaoAtual } from '@/components/dashboard/funcao-donut';
import { RankingTable } from '@/components/dashboard/ranking-table';
import { PapeisFilter } from '@/components/dashboard/papeis-filter';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { brlCompacto, cn, numero } from '@/lib/utils';
import type { LinhaRanking, ServidorFuncoes } from '@/lib/dashboard-data';

export function FiscaisDashboard() {
  const estado = useDadosDashboard();
  const { responsaveis, funcoes, contratos, fonte } = estado.dados;

  // Chave é o nome exato de `responsaveis.ranking[i].nome` — `rankingFiltrado`
  // (abaixo) copia esse mesmo texto, então o mapa continua válido mesmo com o
  // filtro de papéis aplicado (que muda os índices, mas não os nomes).
  const funcoesPorNome = useMemo(() => {
    const map = new Map<string, ServidorFuncoes>();
    for (const s of funcoes.servidores) {
      if (s.responsavelRankingIndex === null) continue;
      const nomeRanking = responsaveis.ranking[s.responsavelRankingIndex]?.nome;
      if (nomeRanking) map.set(nomeRanking, s);
    }
    return map;
  }, [funcoes.servidores, responsaveis.ranking]);

  const todosPapeis = useMemo(() => {
    const set = new Set<string>();
    for (const r of responsaveis.ranking) {
      for (const p of r.papeis) set.add(p);
    }
    return Array.from(set).sort();
  }, [responsaveis.ranking]);

  const [papeisSelecionados, setPapeisSelecionados] = useState<string[]>([]);
  const [somenteVigentes, setSomenteVigentes] = useState(false);

  useEffect(() => {
    if (todosPapeis.length > 0 && papeisSelecionados.length === 0) {
      setPapeisSelecionados(todosPapeis);
    }
  }, [todosPapeis]);

  const rankingFiltrado = useMemo(() => {
    if (papeisSelecionados.length === 0) return [];
    if (papeisSelecionados.length === todosPapeis.length && !somenteVigentes) {
      return responsaveis.ranking;
    }

    const setSelecao = new Set(papeisSelecionados);
    const resultado: LinhaRanking[] = [];

    for (const servidor of responsaveis.ranking) {
      const contratosFiltrados = servidor.contratos.filter((c) => {
        if (!c.papeis.some((p) => setSelecao.has(p))) return false;
        if (somenteVigentes && !contratos[c.i]?.vigente) return false;
        return true;
      });

      if (contratosFiltrados.length === 0) continue;

      const papeisServidor = Array.from(
        new Set(contratosFiltrados.flatMap((c) => c.papeis.filter((p) => setSelecao.has(p))))
      ).sort();

      let valorConsolidado = 0;
      let valorEmpenhadoConsolidado = 0;
      let valorPagoConsolidado = 0;

      for (const c of contratosFiltrados) {
        const contr = contratos[c.i];
        if (contr) {
          valorConsolidado += contr.valorGlobal || 0;
          valorEmpenhadoConsolidado += contr.valorEmpenhado || 0;
          valorPagoConsolidado += contr.valorPago || 0;
        }
      }

      resultado.push({
        nome: servidor.nome,
        papeis: papeisServidor,
        valorConsolidado,
        valorEmpenhadoConsolidado,
        valorPagoConsolidado,
        quantidadeContratos: contratosFiltrados.length,
        contratos: contratosFiltrados,
      });
    }

    return resultado.sort((a, b) => b.valorConsolidado - a.valorConsolidado);
  }, [responsaveis.ranking, contratos, papeisSelecionados, todosPapeis, somenteVigentes]);

  const calcMediana = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    if (s.length === 0) return 0;
    return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const medianaValor = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.valorConsolidado)),
    [rankingFiltrado]
  );

  const medianaEmpenhado = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.valorEmpenhadoConsolidado)),
    [rankingFiltrado]
  );

  const medianaPago = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.valorPagoConsolidado)),
    [rankingFiltrado]
  );

  // Distribuição por função (FC/CJ) dos responsáveis visíveis no ranking
  // filtrado — mesmo donut de /funcoes, aqui aplicado só a quem fiscaliza ou
  // gerencia contrato (o universo de /funcoes é mais amplo: inclui quem
  // nunca aparece como responsável, os "Não-Fiscal").
  const donutFuncoesResponsaveis = useMemo(
    () =>
      contarPorFuncaoAtual(
        rankingFiltrado.map((r) => ({ funcaoAtual: funcoesPorNome.get(r.nome)?.funcaoAtual ?? null })),
      ),
    [rankingFiltrado, funcoesPorNome],
  );

  const emContratosVigentesCount = useMemo(() => {
    const vigentesSet = new Set<number>();
    for (let i = 0; i < contratos.length; i++) {
      if (contratos[i].vigente) vigentesSet.add(i);
    }
    let count = 0;
    for (const r of rankingFiltrado) {
      if (r.contratos.some((c) => vigentesSet.has(c.i))) {
        count++;
      }
    }
    return count;
  }, [rankingFiltrado, contratos]);

  return (
    <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Contratos do TSE
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Fiscais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Servidores fiscais e gestores pelos maiores valores consolidados de
            contratos ·{' '}
            <a
              href={fonte}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: Compras.gov.br
            </a>{' '}
            · <DadosStatus estado={estado} />
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/funcoes"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Briefcase className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Funções</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
          </Link>
          <Link
            href="/teletrabalho"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Laptop className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Teletrabalho</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
          </Link>
          <Link
            href="/unidades"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Network className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Unidades</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
          </Link>
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <PapeisFilter
            todosPapeis={todosPapeis}
            papeisSelecionados={papeisSelecionados}
            onChange={setPapeisSelecionados}
            className="min-w-[280px] flex-1"
          />
          <button
            type="button"
            onClick={() => setSomenteVigentes((v) => !v)}
            aria-pressed={somenteVigentes}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              somenteVigentes
                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {somenteVigentes && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            Somente contratos vigentes
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FuncaoStatCard
            titulo="Fiscais designados"
            detalhe={
              somenteVigentes
                ? `${numero(rankingFiltrado.length)} com contrato vigente hoje`
                : `${numero(rankingFiltrado.length)} no total · ${numero(emContratosVigentesCount)} atuam em contratos vigentes hoje`
            }
            icone={<Users className="h-4 w-4" aria-hidden />}
            contagens={donutFuncoesResponsaveis}
          />
          <StatCard
            titulo="Mediana por responsável"
            valor={brlCompacto(medianaValor)}
            detalhe={`Emp: ${brlCompacto(medianaEmpenhado)} · Pg: ${brlCompacto(medianaPago)}`}
            icone={<Scale className="h-4 w-4" aria-hidden />}
          />
        </div>

        <RankingTable ranking={rankingFiltrado} contratos={contratos} funcoesPorNome={funcoesPorNome} />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        O valor consolidado soma o &ldquo;Valor Global&rdquo; de cada contrato em que
        o servidor aparece como responsável nos papéis selecionados
        {somenteVigentes ? ' e vigente hoje' : ''}, contando cada contrato
        uma única vez por pessoa.
        <AppVersion />
      </footer>
    </main>
  );
}
