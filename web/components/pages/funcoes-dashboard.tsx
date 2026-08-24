'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Ban, Briefcase, ShieldCheck, Users } from 'lucide-react';
import { FuncaoStatCard } from '@/components/dashboard/funcao-stat-card';
import { contarPorFuncaoAtual } from '@/components/dashboard/funcao-donut';
import { PapeisFilter } from '@/components/dashboard/papeis-filter';
import { FuncoesTable } from '@/components/dashboard/funcoes-table';
import { FuncoesHistoricoDialog } from '@/components/dashboard/funcoes-historico-dialog';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { contratosDoResponsavel } from '@/components/dashboard/ranking-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { nomeProprio, numero } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

export function FuncoesDashboard() {
  const estado = useDadosDashboard();
  const { funcoes, responsaveis, contratos, fonte } = estado.dados;

  const todasFuncoes = useMemo(() => {
    const set = new Set<string>();
    for (const s of funcoes.servidores) {
      for (const m of s.mandatos) set.add(`${m.tipo}-${m.nivel}`);
    }
    return Array.from(set).sort();
  }, [funcoes.servidores]);

  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<string[]>([]);

  const servidoresFiltrados = useMemo(() => {
    if (funcoesSelecionadas.length === 0 || funcoesSelecionadas.length === todasFuncoes.length) {
      return funcoes.servidores;
    }
    const set = new Set(funcoesSelecionadas);
    return funcoes.servidores.filter((s) => s.mandatos.some((m) => set.has(`${m.tipo}-${m.nivel}`)));
  }, [funcoes.servidores, funcoesSelecionadas, todasFuncoes]);

  // Seleciona todas as funções assim que a lista carrega (mesmo padrão do
  // filtro de papéis em /responsaveis).
  useEffect(() => {
    if (todasFuncoes.length > 0 && funcoesSelecionadas.length === 0) {
      setFuncoesSelecionadas(todasFuncoes);
    }
  }, [todasFuncoes]);

  // Os 3 KPIs (e seus donuts) refletem o filtro de função aplicado acima —
  // "com função" aqui significa vigente hoje, não o histórico completo.
  const vigentesFiltrados = useMemo(
    () => servidoresFiltrados.filter((s) => s.mandatos.some((m) => m.vigente)),
    [servidoresFiltrados],
  );
  const zeroFiscalFiltrados = useMemo(
    () => servidoresFiltrados.filter((s) => s.zeroFiscal),
    [servidoresFiltrados],
  );
  const fiscaisFiltrados = useMemo(
    () => servidoresFiltrados.filter((s) => !s.zeroFiscal),
    [servidoresFiltrados],
  );

  const donutVigentes = useMemo(() => contarPorFuncaoAtual(vigentesFiltrados), [vigentesFiltrados]);
  const donutZeroFiscal = useMemo(() => contarPorFuncaoAtual(zeroFiscalFiltrados), [zeroFiscalFiltrados]);
  const donutFiscais = useMemo(() => contarPorFuncaoAtual(fiscaisFiltrados), [fiscaisFiltrados]);

  const [historicoAberto, setHistoricoAberto] = useState<ServidorFuncoes | null>(null);
  const [contratosDe, setContratosDe] = useState<ServidorFuncoes | null>(null);

  const linhaRankingDe =
    contratosDe?.responsavelRankingIndex != null
      ? responsaveis.ranking[contratosDe.responsavelRankingIndex]
      : null;

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
          <h1 className="text-2xl font-semibold tracking-tight">Funções comissionadas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de FC-1 a FC-6 e CJ-1 a CJ-4 de cada servidor, a partir das portarias do TSE ·{' '}
            <a
              href="https://www.tse.jus.br/legislacao/compilada/prt"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: legislação compilada do TSE
            </a>{' '}
            · <DadosStatus estado={estado} />
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
        <PapeisFilter
          todosPapeis={todasFuncoes}
          papeisSelecionados={funcoesSelecionadas}
          onChange={setFuncoesSelecionadas}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FuncaoStatCard
            titulo="Servidores com função"
            detalhe={`${numero(servidoresFiltrados.length)} no histórico`}
            icone={<Briefcase className="h-4 w-4" aria-hidden />}
            contagens={donutVigentes}
          />
          <FuncaoStatCard
            titulo="Zero Fiscal"
            detalhe="nunca aparecem como fiscal/gestor de contrato"
            icone={<Ban className="h-4 w-4" aria-hidden />}
            contagens={donutZeroFiscal}
          />
          <FuncaoStatCard
            titulo="Servidores Fiscais"
            detalhe="com função comissionada e ao menos um contrato"
            icone={<ShieldCheck className="h-4 w-4" aria-hidden />}
            contagens={donutFiscais}
          />
        </div>

        <FuncoesTable
          servidores={servidoresFiltrados}
          onVerHistorico={setHistoricoAberto}
          onVerContratos={setContratosDe}
        />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        Cruzamento entre portarias e contratos feito pelo nome do servidor (a
        fonte de portarias não expõe CPF nem matrícula) — homônimos podem gerar
        vínculos incorretos. Datas de nomeação/exoneração conforme a publicação
        no Diário Oficial da União; quando a função ainda está em curso, ou a
        portaria de início/fim não foi localizada, o histórico indica isso
        explicitamente.
        <AppVersion />
      </footer>

      {historicoAberto && (
        <FuncoesHistoricoDialog
          servidor={historicoAberto}
          open
          onClose={() => setHistoricoAberto(null)}
        />
      )}

      {contratosDe && linhaRankingDe && (
        <ContratosDialog
          titulo={nomeProprio(contratosDe.nome)}
          contratos={contratosDoResponsavel(linhaRankingDe, contratos)}
          open
          onClose={() => setContratosDe(null)}
        />
      )}
    </main>
  );
}
