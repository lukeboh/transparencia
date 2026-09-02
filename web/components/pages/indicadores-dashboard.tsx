'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { IndicadoresTable } from '@/components/dashboard/indicadores-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
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
      <AppHeader
        atual="indicadores"
        titulo="Indicadores por unidade"
        descricao={
          <>
            Relações percentuais comparáveis entre unidades — escolha as colunas e ordene por qualquer uma{' '}
            <DicaTermo id="consolidado" alinhamento="esquerda" /> ·{' '}
            <Link
              href="/unidades"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              base: estrutura de unidades
            </Link>{' '}
            · <DadosStatus estado={estado} />
          </>
        }
      />

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
        Cada coluna é uma relação: em geral um percentual — uma métrica (servidores, com FC, com CJ, fiscais,
        teletrabalho, terceirizados) sobre um denominador —, exceto <strong>Horas extras</strong>, que é a
        média de horas extras <strong>estimadas</strong> por servidor (serviço extraordinário desde 2009: o
        valor pago na folha ÷ valor da hora normal ÷ 1,5, conforme a Resolução TSE nº 22.901/2008; é um limite
        superior). Variantes: <strong>unidade</strong>{' '}
        (só quem está lotado exatamente no nó),{' '}
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
