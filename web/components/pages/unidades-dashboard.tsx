'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Building2, GitBranch, HardHat, Laptop, Percent, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { UnidadeArvore } from '@/components/dashboard/unidade-arvore';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
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
  const totalNaoLocalizados =
    naoLocalizados.servidores +
    naoLocalizados.teletrabalho +
    naoLocalizados.terceirizados +
    naoLocalizados.ambiguos;
  const totalTerceirizados = unidades.arvore ? unidades.arvore.consolidado.terceirizados : 0;

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
            href="/servidores"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Users className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Servidores</span>
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
            href="/terceirizados"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <HardHat className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Terceirizados</span>
            <ArrowUpRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
          </Link>
          <Link
            href="/indicadores"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Percent className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Indicadores</span>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              titulo="Servidores na estrutura"
              valor={numero(unidades.totalServidoresTSE)}
              detalhe="total consolidado no TSE"
              icone={<Users className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              titulo={
                <span className="inline-flex items-center gap-1">
                  Terceirizados alocados <DicaTermo id="terceirizados" />
                </span>
              }
              valor={numero(totalTerceirizados)}
              detalhe={
                unidades.terceirizadosCompetencia
                  ? `estimado · PDF de ${unidades.terceirizadosCompetencia}`
                  : 'estimado do PDF mensal do TSE'
              }
              icone={<HardHat className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              titulo={
                <span className="inline-flex items-center gap-1">
                  Unidades <DicaTermo id="unidadeFolha" />
                </span>
              }
              valor={numero(totalUnidades)}
              detalhe={`${numero(totalFolhas)} unidades-folha`}
              icone={<Building2 className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              titulo={
                <span className="inline-flex items-center gap-1">
                  Não localizados na estrutura <DicaTermo id="naoLocalizados" />
                </span>
              }
              valor={numero(totalNaoLocalizados)}
              detalhe={`${numero(naoLocalizados.servidores)} servidor(es) · ${numero(naoLocalizados.teletrabalho)} teletrabalho · ${numero(naoLocalizados.terceirizados)} terceirizado(s) · ${numero(naoLocalizados.ambiguos)} ambíguo(s)`}
              icone={<GitBranch className="h-4 w-4" aria-hidden />}
            />
          </div>

          <UnidadeArvore
            arvore={unidades.arvore}
            totalServidoresTSE={unidades.totalServidoresTSE}
            terceirizados={unidades.terceirizados}
            terceirizadosCompetencia={unidades.terceirizadosCompetencia}
          />
        </div>
      )}

      <footer className="mt-8 text-xs text-muted-foreground">
        Estrutura oficial de unidades do TSE, cruzada por nome normalizado com a relação atual de agentes públicos,
        com o cadastro de teletrabalho vigente e com o ranking de fiscais/gestores de contrato — nenhuma das fontes
        compartilha um id de unidade ou matrícula/CPF em comum, então homônimos e pequenas divergências de grafia
        entre as fontes podem gerar vínculos incorretos ou registros não localizados (ver &ldquo;Não localizados na
        estrutura&rdquo; acima). Cada unidade tem três toggles independentes, com botão geral e por card: &ldquo;
        Consolidado&rdquo; (soma toda a subárvore quando ligado, ou só quem está lotado exatamente naquele nó quando
        desligado), &ldquo;Nível de detalhe&rdquo; (detalhado = um chip por função/papel; simples = FC, CJ e
        fiscais consolidados em um chip cada) e &ldquo;Base do %&rdquo; (geral = percentual sobre o total de
        servidores do TSE; unidade = sobre os servidores da própria unidade — nesse caso a linha &ldquo;Servidores
        vigentes&rdquo; mostra sempre 100%, já que é a própria base). Uma pessoa pode ter mais de um papel de
        fiscal/gestor, então a soma dos chips de fiscal pode passar de 100%.{' '}
        <strong>Terceirizados alocados</strong> vem de outra fonte: o PDF mensal de &ldquo;postos de trabalho
        &ndash; contratos de cessão de mão de obra&rdquo; do TSE
        {unidades.terceirizadosCompetencia ? ` (competência ${unidades.terceirizadosCompetencia})` : ''}. Cada
        posto é ligado à unidade pela sigla da coluna &ldquo;Alocação&rdquo;; como o arquivo é um PDF escaneado,
        alguns registros não são localizados e o total por unidade é aproximado. Não são servidores públicos —
        entram numa contagem à parte, e o percentual mostrado é a parcela do total de terceirizados do TSE que
        está naquela unidade (soma 100% na raiz).
        <AppVersion />
      </footer>
    </main>
  );
}
