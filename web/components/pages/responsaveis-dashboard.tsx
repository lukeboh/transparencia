'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Briefcase, Crown, Scale, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { RankingChart } from '@/components/dashboard/ranking-chart';
import { RankingTable } from '@/components/dashboard/ranking-table';
import { PapeisFilter } from '@/components/dashboard/papeis-filter';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { brlCompacto, nomeProprio, numero } from '@/lib/utils';
import type { LinhaRanking } from '@/lib/dashboard-data';

export function ResponsaveisDashboard() {
  const estado = useDadosDashboard();
  const { responsaveis, contratos, fonte } = estado.dados;

  const todosPapeis = useMemo(() => {
    const set = new Set<string>();
    for (const r of responsaveis.ranking) {
      for (const p of r.papeis) set.add(p);
    }
    return Array.from(set).sort();
  }, [responsaveis.ranking]);

  const [papeisSelecionados, setPapeisSelecionados] = useState<string[]>([]);

  useEffect(() => {
    if (todosPapeis.length > 0 && papeisSelecionados.length === 0) {
      setPapeisSelecionados(todosPapeis);
    }
  }, [todosPapeis]);

  const rankingFiltrado = useMemo(() => {
    if (papeisSelecionados.length === 0) return [];
    if (papeisSelecionados.length === todosPapeis.length) {
      return responsaveis.ranking;
    }

    const setSelecao = new Set(papeisSelecionados);
    const resultado: LinhaRanking[] = [];

    for (const servidor of responsaveis.ranking) {
      const contratosFiltrados = servidor.contratos.filter((c) =>
        c.papeis.some((p) => setSelecao.has(p))
      );

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
  }, [responsaveis.ranking, contratos, papeisSelecionados, todosPapeis]);

  const topUm = rankingFiltrado[0];

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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Contratos do TSE
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Responsáveis</h1>
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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/funcoes"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Briefcase className="h-4 w-4" aria-hidden />
            Funções
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </Link>
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-4">
        <PapeisFilter
          todosPapeis={todosPapeis}
          papeisSelecionados={papeisSelecionados}
          onChange={setPapeisSelecionados}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            titulo="Responsáveis designados"
            valor={numero(rankingFiltrado.length)}
            detalhe={`${numero(emContratosVigentesCount)} atuam em contratos vigentes hoje`}
            icone={<Users className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Maior valor sob responsabilidade"
            valor={brlCompacto(topUm?.valorConsolidado ?? 0)}
            detalhe={topUm ? `${nomeProprio(topUm.nome)} (Emp: ${brlCompacto(topUm.valorEmpenhadoConsolidado || 0)})` : '—'}
            icone={<Crown className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Mediana por responsável"
            valor={brlCompacto(medianaValor)}
            detalhe={`Emp: ${brlCompacto(medianaEmpenhado)} · Pg: ${brlCompacto(medianaPago)}`}
            icone={<Scale className="h-4 w-4" aria-hidden />}
          />
        </div>

        <RankingChart ranking={rankingFiltrado} contratos={contratos} />
        <RankingTable ranking={rankingFiltrado} contratos={contratos} />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        O valor consolidado soma o &ldquo;Valor Global&rdquo; de cada contrato em que
        o servidor aparece como responsável nos papéis selecionados, contando cada contrato
        uma única vez por pessoa.
        <AppVersion />
      </footer>
    </main>
  );
}
