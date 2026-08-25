'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Briefcase, Building2, GitBranch, Laptop, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { UnidadeArvore } from '@/components/dashboard/unidade-arvore';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { numero } from '@/lib/utils';
import type { UnidadeNode } from '@/lib/dashboard-data';

function contarNos(no: UnidadeNode): number {
  return 1 + no.children.reduce((s, filho) => s + contarNos(filho), 0);
}

function contarFolhas(no: UnidadeNode): number {
  if (no.children.length === 0) return 1;
  return no.children.reduce((s, filho) => s + contarFolhas(filho), 0);
}

export function UnidadesDashboard() {
  const estado = useDadosDashboard();
  const { unidades } = estado.dados;

  const totalUnidades = useMemo(() => (unidades.arvore ? contarNos(unidades.arvore) : 0), [unidades.arvore]);
  const totalFolhas = useMemo(() => (unidades.arvore ? contarFolhas(unidades.arvore) : 0), [unidades.arvore]);

  const { naoLocalizados } = unidades;
  const totalNaoLocalizados = naoLocalizados.servidores + naoLocalizados.teletrabalho + naoLocalizados.ambiguos;

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
          <h1 className="text-2xl font-semibold tracking-tight">Unidades e Lotações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estrutura hierárquica do TSE, do tribunal até a última seção ·{' '}
            <a
              href="https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/lotacao-geral/sem-assinatura/agrupamento-por-unidade"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: agrupamento por unidade
            </a>{' '}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              titulo="Servidores na estrutura"
              valor={numero(unidades.totalServidoresTSE)}
              detalhe="total consolidado no TSE"
              icone={<Users className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              titulo="Unidades"
              valor={numero(totalUnidades)}
              detalhe={`${numero(totalFolhas)} unidades-folha`}
              icone={<Building2 className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              titulo="Não localizados na estrutura"
              valor={numero(totalNaoLocalizados)}
              detalhe={`${numero(naoLocalizados.servidores)} servidor(es) · ${numero(naoLocalizados.teletrabalho)} teletrabalho · ${numero(naoLocalizados.ambiguos)} ambíguo(s)`}
              icone={<GitBranch className="h-4 w-4" aria-hidden />}
            />
          </div>

          <UnidadeArvore arvore={unidades.arvore} totalServidoresTSE={unidades.totalServidoresTSE} />
        </div>
      )}

      <footer className="mt-8 text-xs text-muted-foreground">
        Estrutura oficial de unidades do TSE, cruzada por nome normalizado com a relação atual de agentes públicos,
        com o cadastro de teletrabalho vigente e com o ranking de fiscais/gestores de contrato — nenhuma das fontes
        compartilha um id de unidade ou matrícula/CPF em comum, então homônimos e pequenas divergências de grafia
        entre as fontes podem gerar vínculos incorretos ou registros não localizados (ver &ldquo;Não localizados na
        estrutura&rdquo; acima). O toggle &ldquo;Consolidado&rdquo; de cada unidade soma toda a subárvore quando
        ligado, ou só quem está lotado exatamente naquele nó quando desligado; o percentual de &ldquo;Servidores
        vigentes&rdquo; é sempre sobre o total do TSE, independente do toggle — os demais percentuais (funções,
        fiscais, teletrabalho) são sempre sobre o total da própria unidade, no estado atual do toggle. Uma pessoa
        pode ter mais de um papel de fiscal/gestor, então a soma dos chips de fiscal pode passar do total de
        servidores da unidade.
        <AppVersion />
      </footer>
    </main>
  );
}
