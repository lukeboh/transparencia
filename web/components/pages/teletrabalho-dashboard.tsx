'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  Crown,
  Laptop,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { FuncaoStatCard } from '@/components/dashboard/funcao-stat-card';
import { contarPorFuncaoAtual } from '@/components/dashboard/funcao-donut';
import { ContagemStatCard } from '@/components/dashboard/contagem-stat-card';
import type { FatiaContagem } from '@/components/dashboard/contagem-donut';
import { TeletrabalhoTable } from '@/components/dashboard/teletrabalho-table';
import { TeletrabalhoDetalheDialog } from '@/components/dashboard/teletrabalho-detalhe-dialog';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { contratosDoResponsavel } from '@/components/dashboard/ranking-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { nomeProprio, numero } from '@/lib/utils';
import type { LinhaRanking, LinhaTeletrabalho, PeriodoTeletrabalho, ServidorFuncoes } from '@/lib/dashboard-data';

/** Mesma normalização de src/tse/rankResponsaveis.js — a fonte de teletrabalho não expõe matrícula/CPF, então o cruzamento com as outras fontes só pode ser por nome. */
function normalizeNome(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Período mais recente da pessoa — o período em aberto, se houver, senão o de maior data de início (periodos já vem ordenado desc por dataInicio do agregador). */
function periodoMaisRecente(linha: LinhaTeletrabalho): PeriodoTeletrabalho | null {
  if (linha.periodos.length === 0) return null;
  return linha.periodos.find((p) => p.dataFim === null) ?? linha.periodos[0];
}

/** Unidade de topo (secretaria/assessoria/gabinete) do período mais recente da pessoa. */
function unidadeTopoDe(linha: LinhaTeletrabalho): string | null {
  const p = periodoMaisRecente(linha);
  if (!p) return null;
  return p.unidadeNiveis.length > 0 ? p.unidadeNiveis[p.unidadeNiveis.length - 1] : p.unidade || null;
}

/** Níveis da lotação do período mais recente, do menor (seção) para o maior (secretaria/gabinete/assessoria). */
function lotacaoDe(linha: LinhaTeletrabalho): string[] | null {
  const p = periodoMaisRecente(linha);
  if (!p) return null;
  if (p.unidadeNiveis.length > 0) return p.unidadeNiveis;
  return p.unidade ? [p.unidade] : null;
}

const MAX_UNIDADES = 5;

function contarPorUnidadeTopo(ranking: LinhaTeletrabalho[]): FatiaContagem[] {
  const contagem = new Map<string, number>();
  for (const linha of ranking) {
    const topo = unidadeTopoDe(linha) ?? 'Não informado';
    contagem.set(topo, (contagem.get(topo) ?? 0) + 1);
  }
  const ordenado = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rotulo, quantidade]) => ({ rotulo, quantidade }));
  if (ordenado.length <= MAX_UNIDADES) return ordenado;
  const principais = ordenado.slice(0, MAX_UNIDADES);
  const resto = ordenado.slice(MAX_UNIDADES);
  return [...principais, { rotulo: 'Outros', quantidade: resto.reduce((s, f) => s + f.quantidade, 0) }];
}

export function TeletrabalhoDashboard() {
  const estado = useDadosDashboard();
  const { teletrabalho, funcoes, responsaveis, contratos } = estado.dados;

  const funcoesPorNome = useMemo(() => {
    const map = new Map<string, ServidorFuncoes>();
    for (const s of funcoes.servidores) map.set(normalizeNome(s.nome), s);
    return map;
  }, [funcoes.servidores]);

  const funcaoDe = (linha: LinhaTeletrabalho) => funcoesPorNome.get(normalizeNome(linha.nome));

  const topUm = teletrabalho.ranking[0];

  const donutFiscais = useMemo<FatiaContagem[]>(() => {
    const fiscais = teletrabalho.ranking.filter((r) => r.responsavelRankingIndex !== null).length;
    const semContrato = teletrabalho.ranking.length - fiscais;
    return [
      { rotulo: 'Fiscal/gestor', quantidade: fiscais },
      { rotulo: 'Sem contrato', quantidade: semContrato },
    ];
  }, [teletrabalho.ranking]);

  const donutFuncoes = useMemo(
    () => contarPorFuncaoAtual(teletrabalho.ranking.map((r) => ({ funcaoAtual: funcaoDe(r)?.funcaoAtual ?? null }))),
    [teletrabalho.ranking, funcoesPorNome],
  );

  const donutUnidades = useMemo(() => contarPorUnidadeTopo(teletrabalho.ranking), [teletrabalho.ranking]);

  const [detalheAberto, setDetalheAberto] = useState<LinhaTeletrabalho | null>(null);
  const [contratosDe, setContratosDe] = useState<LinhaRanking | null>(null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Contratos do TSE
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Teletrabalho</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dias em regime de teletrabalho por servidor ·{' '}
            <a
              href="https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/cargos-e-funcoes/servidores-em-regime-de-teletrabalho"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: TSE — servidores em regime de teletrabalho
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
          <ThemePicker />
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            titulo="Servidores em teletrabalho"
            valor={numero(teletrabalho.total)}
            detalhe={`${numero(teletrabalho.ranking.reduce((s, r) => s + r.periodos.length, 0))} períodos registrados`}
            icone={<Laptop className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Maior quantitativo"
            valor={topUm ? `${numero(topUm.diasConsolidados)} dias` : '—'}
            detalhe={topUm ? nomeProprio(topUm.nome) : '—'}
            icone={<Crown className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            titulo="Mediana por servidor"
            valor={`${numero(teletrabalho.medianaDias)} dias`}
            detalhe="dias consolidados em teletrabalho"
            icone={<Scale className="h-4 w-4" aria-hidden />}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ContagemStatCard
            titulo="Teletrabalho × Fiscais"
            detalhe="quantos servidores em teletrabalho são fiscais/gestores de contrato"
            icone={<ShieldCheck className="h-4 w-4" aria-hidden />}
            fatias={donutFiscais}
          />
          <FuncaoStatCard
            titulo="Teletrabalho × Funções"
            detalhe="função comissionada (FC/CJ) de quem está em teletrabalho"
            icone={<Briefcase className="h-4 w-4" aria-hidden />}
            contagens={donutFuncoes}
          />
          <ContagemStatCard
            titulo="Teletrabalho × Secretaria/Assessoria/Gabinete"
            detalhe="unidade de topo do período mais recente de cada servidor"
            icone={<Building2 className="h-4 w-4" aria-hidden />}
            fatias={donutUnidades}
          />
        </div>

        <TeletrabalhoTable
          ranking={teletrabalho.ranking}
          funcaoDe={funcaoDe}
          lotacaoDe={lotacaoDe}
          responsaveisRanking={responsaveis.ranking}
          onVerDetalhe={setDetalheAberto}
          onVerContratos={setContratosDe}
        />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        Cada período soma os dias corridos entre início e fim (ou hoje, quando o período segue em aberto); períodos
        sobrepostos da mesma pessoa não são mesclados, então dias sobrepostos podem ser contados mais de uma vez.
        Cruzamento com fiscais/gestores e com função comissionada é feito pelo nome do servidor — nenhuma das fontes
        expõe CPF nem matrícula em comum — então homônimos podem gerar vínculos incorretos.
        <AppVersion />
      </footer>

      {detalheAberto && (
        <TeletrabalhoDetalheDialog linha={detalheAberto} open onClose={() => setDetalheAberto(null)} />
      )}

      {contratosDe && (
        <ContratosDialog
          titulo={nomeProprio(contratosDe.nome)}
          contratos={contratosDoResponsavel(contratosDe, contratos)}
          open
          onClose={() => setContratosDe(null)}
        />
      )}
    </main>
  );
}
