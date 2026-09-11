'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { SazonalidadeServidoresChart } from '@/components/dashboard/sazonalidade-servidores-chart';
import { SazonalidadeHorasExtrasChart } from '@/components/dashboard/sazonalidade-horas-extras-chart';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { AppVersion } from '@/components/app-version';
import { useDadosDashboard } from '@/lib/use-dados';
import { classificarUnidades } from '@/lib/unidades-categoria';

export function SazonalidadeDashboard() {
  const estado = useDadosDashboard();
  const { unidades, teletrabalho, horasExtras } = estado.dados;

  const categoriaPorId = useMemo(
    () => (unidades.arvore ? classificarUnidades(unidades.arvore) : new Map()),
    [unidades.arvore],
  );

  return (
    <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <AppHeader
        atual="sazonalidade"
        titulo="Sazonalidade"
        descricao={
          <>
            Séries mês a mês do quadro de pessoal e das horas extras — para ver picos e tendências ao
            longo do tempo, não só o total acumulado. · <DadosStatus estado={estado} />
          </>
        }
      />

      <div className="space-y-4">
        <SazonalidadeServidoresChart
          ranking={teletrabalho.ranking}
          totalOrgao={unidades.totalServidoresTSE}
          mesReferencia={estado.dados.geradoEm.slice(0, 7)}
        />

        {!unidades.arvore ? (
          <p className="text-sm text-muted-foreground">
            Estrutura de unidades ainda não disponível — aguarde a atualização automática dos dados ou rode{' '}
            <code className="rounded-sm bg-accent px-1 py-0.5">npm run tse:scrape-unidades</code>.
          </p>
        ) : (
          <SazonalidadeHorasExtrasChart
            arvore={unidades.arvore}
            categoriaPorId={categoriaPorId}
            competencias={horasExtras.competencias}
          />
        )}
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        O gráfico de horas extras soma horas <strong>estimadas</strong> (serviço extraordinário desde 2009;
        valor pago ÷ hora normal ÷ 1,5, Res. TSE 22.901/2008 — limite superior), atribuídas à lotação da
        pessoa NAQUELE mês (histórico, não a lotação de hoje). Veja também{' '}
        <Link
          href="/indicadores"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          /indicadores
        </Link>{' '}
        para os percentuais consolidados e mensais por unidade.
        <AppVersion />
      </footer>
    </main>
  );
}
