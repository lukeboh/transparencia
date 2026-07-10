import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Crown, Scale, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { RankingChart } from '@/components/dashboard/ranking-chart';
import { RankingTable } from '@/components/dashboard/ranking-table';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { dashboardData } from '@/lib/dashboard-data';
import { brlCompacto, nomeProprio, numero } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Responsáveis · Contratos TSE',
  description:
    'Ranking de servidores fiscais e gestores pelos maiores valores consolidados de contratos do TSE.',
};

export default function ResponsaveisPage() {
  const { responsaveis, contratos, fonte, geradoEm } = dashboardData;
  const extraidoEm = new Date(geradoEm).toLocaleDateString('pt-BR');
  const topUm = responsaveis.ranking[0];

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
            · extraído em {extraidoEm}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            titulo="Responsáveis designados"
            valor={numero(responsaveis.total)}
            detalhe={`${numero(responsaveis.emContratosVigentes)} atuam em contratos vigentes hoje`}
            icone={<Users className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Maior valor sob responsabilidade"
            valor={brlCompacto(topUm?.valorConsolidado ?? 0)}
            detalhe={topUm ? nomeProprio(topUm.nome) : '—'}
            icone={<Crown className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Mediana por responsável"
            valor={brlCompacto(responsaveis.medianaValor)}
            detalhe="metade dos servidores responde por menos que isso"
            icone={<Scale className="h-4 w-4" aria-hidden />}
          />
        </div>

        <RankingChart ranking={responsaveis.ranking} contratos={contratos} />
        <RankingTable ranking={responsaveis.ranking} contratos={contratos} />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        O valor consolidado soma o &ldquo;Valor Global&rdquo; de cada contrato em que
        o servidor aparece como responsável (qualquer papel), contando cada contrato
        uma única vez por pessoa. Contratos de compras centralizadas (ex.: urnas
        eletrônicas) elevam o valor de seus responsáveis por refletirem tetos
        nacionais.
      </footer>
    </main>
  );
}
