'use client';

import Link from 'next/link';
import { ArrowUpRight, HardHat, Laptop, Network, Percent, Timer, Users, type LucideIcon } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { StatCards } from '@/components/dashboard/stat-cards';
import { StatCard } from '@/components/dashboard/stat-card';
import { EvolucaoChart } from '@/components/dashboard/evolucao-chart';
import { CategoriasChart } from '@/components/dashboard/categorias-chart';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { useDadosDashboard } from '@/lib/use-dados';
import { numero } from '@/lib/utils';
import type { UnidadeNode } from '@/lib/dashboard-data';

/** Total de nós na árvore de unidades (mesma contagem da tela /unidades). */
function contarUnidades(no: UnidadeNode): number {
  return 1 + no.children.reduce((soma, filho) => soma + contarUnidades(filho), 0);
}

const umDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

interface KpiSecao {
  href: string;
  Icone: LucideIcon;
  titulo: string;
  valor: string;
  detalhe: string;
}

export function HomeDashboard() {
  const estado = useDadosDashboard();
  const {
    resumo, evolucao, categorias, contratos, fonte, servidores, teletrabalho,
    horasExtras, unidades, terceirizados,
  } = estado.dados;

  const totalUnidades = unidades.arvore ? contarUnidades(unidades.arvore) : 0;
  const servidoresLotados = unidades.arvore?.consolidado.servidores ?? 0;
  const terceirizadosPorServidor =
    servidores.total > 0 ? terceirizados.ativos / servidores.total : 0;

  // Ciclo eleitoral mais recente com horas extras (ignora o balde "fora").
  const ciclosOrdenados = [...horasExtras.ciclos]
    .filter((c) => c.ciclo !== 'fora')
    .sort((a, b) => a.ciclo.localeCompare(b.ciclo));
  const cicloRecenteHE = ciclosOrdenados[ciclosOrdenados.length - 1];

  // Um KPI ilustrativo por seção, cada card levando ao detalhamento da página.
  const kpisSecao: KpiSecao[] = [
    {
      href: '/servidores',
      Icone: Users,
      titulo: 'Servidores (agentes públicos)',
      valor: numero(servidores.total),
      detalhe: `${numero(servidores.comContrato)} atuam como fiscais/gestores de contrato`,
    },
    {
      href: '/teletrabalho',
      Icone: Laptop,
      titulo: 'Em teletrabalho',
      valor: numero(teletrabalho.total),
      detalhe: `mediana de ${numero(Math.round(teletrabalho.medianaDias))} dias em regime`,
    },
    {
      href: '/unidades',
      Icone: Network,
      titulo: 'Unidades na estrutura',
      valor: numero(totalUnidades),
      detalhe: `${numero(servidoresLotados)} servidores lotados, do tribunal à seção`,
    },
    {
      href: '/terceirizados',
      Icone: HardHat,
      titulo: 'Terceirizados ativos',
      valor: numero(terceirizados.ativos),
      detalhe: `em ${numero(terceirizados.contratos)} contratos de cessão de mão de obra`,
    },
    {
      href: '/indicadores',
      Icone: Percent,
      titulo: 'Terceirizados / servidores',
      valor: `${Math.round(terceirizadosPorServidor * 100)}%`,
      detalhe: `${umDecimal.format(terceirizadosPorServidor)}× o quadro · relações comparáveis por unidade`,
    },
    {
      href: '/servidores',
      Icone: Timer,
      titulo: 'Horas extras estimadas',
      valor: cicloRecenteHE
        ? `${numero(Math.round(cicloRecenteHE.horas))} h`
        : `${numero(Math.round(horasExtras.totalHoras))} h`,
      detalhe: cicloRecenteHE
        ? `${cicloRecenteHE.rotulo} · ${numero(cicloRecenteHE.servidores ?? 0)} servidores · estimativa (limite superior)`
        : 'serviço extraordinário desde 2009 · estimativa',
    },
  ];

  return (
    <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <AppHeader
        titulo="Transparência TSE"
        descricao={
          <>
            Panorama dos gastos com contratos{' '}
            <DicaTermo id="valoresContrato" alinhamento="esquerda" /> e do quadro de pessoal do
            Tribunal Superior Eleitoral ·{' '}
            <a
              href={fonte}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: Compras.gov.br
            </a>{' '}
            · <DadosStatus estado={estado} />
          </>
        }
      />

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Contratos
          </h2>
          <StatCards resumo={resumo} contratos={contratos} />
          <div className="grid gap-4 lg:grid-cols-3">
            <EvolucaoChart dados={evolucao} contratos={contratos} />
            <CategoriasChart dados={categorias} contratos={contratos} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Panorama por seção
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpisSecao.map(({ href, Icone, titulo, valor, detalhe }) => (
              <Link
                key={titulo}
                href={href}
                aria-label={`${titulo} — ver detalhamento`}
                className="rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
              >
                <StatCard
                  titulo={titulo}
                  valor={valor}
                  detalhe={
                    <span className="inline-flex items-center gap-1">
                      {detalhe}
                      <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                    </span>
                  }
                  icone={<Icone className="h-4 w-4" aria-hidden />}
                />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        Valores conforme campo &ldquo;Valor Global&rdquo; da fonte oficial. Alguns
        contratos refletem tetos nacionais de compras centralizadas pelo TSE para
        toda a Justiça Eleitoral (ex.: urnas eletrônicas), não apenas gasto próprio
        do órgão.
        <AppVersion />
      </footer>
    </main>
  );
}
