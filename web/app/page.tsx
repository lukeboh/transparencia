import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';
import { StatCards } from '@/components/dashboard/stat-cards';
import { EvolucaoChart } from '@/components/dashboard/evolucao-chart';
import { CategoriasChart } from '@/components/dashboard/categorias-chart';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { dashboardData } from '@/lib/dashboard-data';

export default function Home() {
  const { resumo, evolucao, categorias, contratos, fonte, geradoEm } = dashboardData;
  const extraidoEm = new Date(geradoEm).toLocaleDateString('pt-BR');

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Contratos do TSE
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gastos com contratos do Tribunal Superior Eleitoral ·{' '}
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
          <Link
            href="/responsaveis"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Users className="h-4 w-4" aria-hidden />
            Responsáveis
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </Link>
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-4">
        <StatCards resumo={resumo} contratos={contratos} fonte={fonte} />
        <div className="grid gap-4 lg:grid-cols-3">
          <EvolucaoChart dados={evolucao} contratos={contratos} />
          <CategoriasChart dados={categorias} contratos={contratos} />
        </div>
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        Valores conforme campo &ldquo;Valor Global&rdquo; da fonte oficial. Alguns
        contratos refletem tetos nacionais de compras centralizadas pelo TSE para
        toda a Justiça Eleitoral (ex.: urnas eletrônicas), não apenas gasto próprio
        do órgão.
      </footer>
    </main>
  );
}
