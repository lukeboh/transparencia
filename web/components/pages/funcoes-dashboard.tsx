'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Ban, Briefcase, Laptop, Network, Percent, ShieldCheck, Users } from 'lucide-react';
import { FuncaoStatCard } from '@/components/dashboard/funcao-stat-card';
import { contarPorFuncaoAtual } from '@/components/dashboard/funcao-donut';
import { FuncoesFilter, NAO_FISCAL } from '@/components/dashboard/funcoes-filter';
import { FuncoesTable } from '@/components/dashboard/funcoes-table';
import { FuncoesHistoricoDialog } from '@/components/dashboard/funcoes-historico-dialog';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { contratosDoResponsavel } from '@/components/dashboard/ranking-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { criarResolvedorLotacao } from '@/lib/lotacao-hierarquia';
import { nomeProprio, numero } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

export function FuncoesDashboard() {
  const estado = useDadosDashboard();
  const { funcoes, responsaveis, contratos, fonte, unidades } = estado.dados;

  const resolverLotacao = useMemo(
    () => criarResolvedorLotacao(unidades.arvore),
    [unidades.arvore],
  );

  // Níveis de função (FC-1…CJ-4) que aparecem no histórico completo.
  const todasFuncoes = useMemo(() => {
    const set = new Set<string>();
    for (const s of funcoes.servidores) {
      if (s.funcaoAtual) set.add(`${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel}`);
      for (const m of s.mandatos) set.add(`${m.tipo}-${m.nivel}`);
    }
    return Array.from(set).sort();
  }, [funcoes.servidores]);

  // Papel de cada servidor na fiscalização/gestão de contratos: os papéis
  // reais do ranking de responsáveis, ou NAO_FISCAL para quem nunca aparece
  // como responsável (zeroFiscal).
  const papeisPorServidor = useMemo(() => {
    const map = new Map<ServidorFuncoes, string[]>();
    for (const s of funcoes.servidores) {
      if (s.zeroFiscal || s.responsavelRankingIndex == null) {
        map.set(s, [NAO_FISCAL]);
        continue;
      }
      map.set(s, responsaveis.ranking[s.responsavelRankingIndex]?.papeis ?? [NAO_FISCAL]);
    }
    return map;
  }, [funcoes.servidores, responsaveis.ranking]);

  // Lista de toggles de "Atuação em contratos": NAO_FISCAL primeiro, depois os
  // papéis reais em ordem alfabética.
  const todosPapeis = useMemo(() => {
    const set = new Set<string>();
    for (const paps of papeisPorServidor.values()) {
      for (const p of paps) if (p !== NAO_FISCAL) set.add(p);
    }
    return [NAO_FISCAL, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [papeisPorServidor]);

  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<string[]>([]);
  const [papeisSelecionados, setPapeisSelecionados] = useState<string[]>([]);
  // Toggle "Vigente" do filtro: quando ativo, só entram servidores com função
  // vigente hoje (funcaoAtual), e o casamento com os níveis selecionados
  // ignora o histórico de mandatos.
  const [somenteVigentes, setSomenteVigentes] = useState(false);

  const servidoresFiltrados = useMemo(() => {
    const todosNiveis =
      funcoesSelecionadas.length === 0 || funcoesSelecionadas.length === todasFuncoes.length;
    const todosPap =
      papeisSelecionados.length === 0 || papeisSelecionados.length === todosPapeis.length;
    const setNiveis = new Set(funcoesSelecionadas);
    const setPapeis = new Set(papeisSelecionados);
    return funcoes.servidores.filter((s) => {
      if (somenteVigentes && !s.funcaoAtual) return false;

      if (!todosNiveis) {
        const casaNivel = somenteVigentes
          ? s.funcaoAtual != null && setNiveis.has(`${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel}`)
          : (s.funcaoAtual != null && setNiveis.has(`${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel}`)) ||
            s.mandatos.some((m) => setNiveis.has(`${m.tipo}-${m.nivel}`));
        if (!casaNivel) return false;
      }

      if (!todosPap) {
        const paps = papeisPorServidor.get(s) ?? [];
        if (!paps.some((p) => setPapeis.has(p))) return false;
      }

      return true;
    });
  }, [
    funcoes.servidores,
    funcoesSelecionadas,
    todasFuncoes,
    papeisSelecionados,
    todosPapeis,
    papeisPorServidor,
    somenteVigentes,
  ]);

  // Seleciona tudo assim que cada lista carrega (mesmo padrão do filtro de
  // papéis em /responsaveis).
  useEffect(() => {
    if (todasFuncoes.length > 0 && funcoesSelecionadas.length === 0) {
      setFuncoesSelecionadas(todasFuncoes);
    }
  }, [todasFuncoes]);

  useEffect(() => {
    if (todosPapeis.length > 1 && papeisSelecionados.length === 0) {
      setPapeisSelecionados(todosPapeis);
    }
  }, [todosPapeis]);

  // Os 3 KPIs (e seus donuts) refletem o filtro de função aplicado acima —
  // "com função" aqui significa vigente hoje, não o histórico completo.
  const vigentesFiltrados = useMemo(
    () => servidoresFiltrados.filter((s) => s.funcaoAtual !== null),
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
          <h1 className="text-2xl font-semibold tracking-tight">Funções comissionadas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            FC-1 a FC-6 e CJ-1 a CJ-4 <DicaTermo id="fcCj" alinhamento="esquerda" /> de cada
            servidor ·{' '}
            <a
              href="https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/servidor/relacao-agentes-publicos"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: relação de agentes públicos
            </a>
            <DicaTermo id="agentesPublicos" alinhamento="esquerda" /> + histórico de{' '}
            <a
              href="https://www.tse.jus.br/legislacao/compilada/prt"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              portarias do TSE
            </a>
            <DicaTermo id="portaria" alinhamento="esquerda" /> ·{' '}
            <DadosStatus estado={estado} />
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

      <div className="space-y-4">
        <FuncoesFilter
          niveis={todasFuncoes}
          niveisSelecionados={funcoesSelecionadas}
          onNiveisChange={setFuncoesSelecionadas}
          papeis={todosPapeis}
          papeisSelecionados={papeisSelecionados}
          onPapeisChange={setPapeisSelecionados}
          vigente={somenteVigentes}
          onVigenteChange={setSomenteVigentes}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FuncaoStatCard
            titulo="Servidores com função"
            detalhe={`${numero(servidoresFiltrados.length)} no histórico`}
            icone={<Briefcase className="h-4 w-4" aria-hidden />}
            contagens={donutVigentes}
          />
          <FuncaoStatCard
            titulo="Não-Fiscal"
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
          resolverLotacao={resolverLotacao}
          onVerHistorico={setHistoricoAberto}
          onVerContratos={setContratosDe}
        />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        Quem tem função hoje vem da relação atual de agentes públicos do TSE
        (fonte primária, sem histórico); nomeação/exoneração e servidores que
        já saíram do órgão vêm do histórico de portarias (fonte secundária,
        cobertura parcial). Cruzamento entre as duas fontes, e com os
        contratos, é feito pelo nome do servidor — nenhuma delas expõe CPF
        nem matrícula em comum — então homônimos podem gerar vínculos
        incorretos. Divergências entre as fontes aparecem como observação no
        histórico de cada servidor.
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
