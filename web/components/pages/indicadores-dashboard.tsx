'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Briefcase, HardHat, Laptop, Network, Users } from 'lucide-react';
import { IndicadoresTable } from '@/components/dashboard/indicadores-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { achatarUnidades } from '@/lib/unidades-flat';
import { classificarUnidades, type CategoriaUnidade } from '@/lib/unidades-categoria';

export function IndicadoresDashboard() {
  const estado = useDadosDashboard();
  const { unidades } = estado.dados;

  const linhas = useMemo(
    () => (unidades.arvore ? achatarUnidades(unidades.arvore) : []),
    [unidades.arvore],
  );

  const categoriaPorId = useMemo<Map<string, CategoriaUnidade>>(
    () => (unidades.arvore ? classificarUnidades(unidades.arvore) : new Map()),
    [unidades.arvore],
  );

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
          <h1 className="text-2xl font-semibold tracking-tight">Indicadores por unidade</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Relações percentuais comparáveis entre unidades — escolha as colunas e ordene por qualquer uma{' '}
            <DicaTermo id="consolidado" alinhamento="esquerda" /> ·{' '}
            <Link
              href="/unidades"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              base: estrutura de unidades
            </Link>{' '}
            · <DadosStatus estado={estado} />
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/fiscais"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Users className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Fiscais</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
          </Link>
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
          <Link
            href="/terceirizados"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <HardHat className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Terceirizados</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
          </Link>
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      {!unidades.arvore ? (
        <p className="text-sm text-muted-foreground">
          Estrutura de unidades ainda não disponível — aguarde a atualização automática dos dados ou rode{' '}
          <code className="rounded-sm bg-accent px-1 py-0.5">npm run tse:scrape-unidades</code>.
        </p>
      ) : (
        <div className="space-y-4">
          <IndicadoresTable
            linhas={linhas}
            tseServidores={unidades.totalServidoresTSE}
            categoriaPorId={categoriaPorId}
          />
        </div>
      )}

      <footer className="mt-8 text-xs text-muted-foreground">
        Cada coluna é uma relação percentual: uma métrica (servidores, com FC, com CJ, fiscais, teletrabalho,
        terceirizados) sobre um denominador. Variantes: <strong>unidade</strong> (só quem está lotado exatamente no nó),{' '}
        <strong>consolidada</strong> (o nó e toda a subárvore), <strong>órgão · direto</strong> (valor do nó
        sobre o total de servidores do TSE) e <strong>órgão · subárvore</strong> (valor consolidado sobre o
        total do TSE). &ldquo;—&rdquo; aparece quando o denominador é zero (unidade sem servidor lotado
        direto). &ldquo;Fiscais&rdquo; soma papéis: quem tem mais de um papel conta em cada um, então o
        percentual pode passar de 100% e a barra trava em 100%. Tudo reflete só o momento atual (relação de
        agentes públicos vigente, contratos vigentes, teletrabalho em aberto). &ldquo;Terceirizados&rdquo; é
        a razão terceirizados/servidores, estimada do PDF mensal do TSE de postos de cessão de mão de obra
        {estado.dados.unidades.terceirizadosCompetencia
          ? ` (competência ${estado.dados.unidades.terceirizadosCompetencia})`
          : ''}
        {' '}— aproximada, já que a fonte é um PDF escaneado.
        <AppVersion />
      </footer>
    </main>
  );
}
