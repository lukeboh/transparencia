'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Briefcase, Coins, HardHat, Laptop, Network, Percent, Scale, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { FuncaoStatCard } from '@/components/dashboard/funcao-stat-card';
import { contarPorFuncaoAtual } from '@/components/dashboard/funcao-donut';
import { ContagemStatCard } from '@/components/dashboard/contagem-stat-card';
import { CategoriaValorServidoresCard, contarServidoresPorFaixaValor } from '@/components/dashboard/categoria-valor-servidores-card';
import { FiltroServidores } from '@/components/dashboard/filtro-servidores';
import { RankingTable } from '@/components/dashboard/ranking-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemePicker } from '@/components/theme-picker';
import { useDadosDashboard } from '@/lib/use-dados';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { bool, excluidos, incluidos } from '@/lib/url-filtros';
import { brlCompacto, numero } from '@/lib/utils';
import { ehSubstituto } from '@/lib/perfis-fiscalizacao';
import { CATEGORIAS_VALOR, categoriaDoValor, type CategoriaValorId } from '@/lib/categorias-valor';
import type { ContratoResumo, LinhaRanking, ServidorFuncoes } from '@/lib/dashboard-data';

const IDS_FAIXA_VALOR = CATEGORIAS_VALOR.map((c) => c.id);

/** Chave "FC-3" / "CJ-1" da função comissionada, ou null. FC antes de CJ, depois pelo nível. */
function ordenarFuncao(a: string, b: string): number {
  const [ta, na] = a.split('-');
  const [tb, nb] = b.split('-');
  if (ta !== tb) return ta === 'FC' ? -1 : 1;
  return Number(na) - Number(nb);
}

/** Extrai a lógica de filtro+recálculo de rankingFiltrado, reaproveitada nos dois estágios (papéis/vigência e faixa de valor) — ver servidores-dashboard.tsx. */
function filtrarRanking(
  ranking: LinhaRanking[],
  contratos: ContratoResumo[],
  categoriaIdPorIndice: CategoriaValorId[],
  papeisSelecionados: string[],
  somenteVigentes: boolean,
  categoriasSelecionadas: CategoriaValorId[] | null,
  chavesFuncaoPorNome: Map<string, Set<string>>,
  funcoesSelecionadas: string[] | null,
  incluirSemFuncao: boolean,
): LinhaRanking[] {
  const setPapeis = new Set(papeisSelecionados);
  const setCategorias = categoriasSelecionadas ? new Set(categoriasSelecionadas) : null;
  const setFuncoes = funcoesSelecionadas ? new Set(funcoesSelecionadas) : null;
  const resultado: LinhaRanking[] = [];

  for (const servidor of ranking) {
    if (setFuncoes) {
      // `chavesFuncaoPorNome` já reflete a escolha do chip "Vigente" da seção
      // "Por função": só a função atual quando ligado, atual + histórico de
      // portarias quando desligado. Conjunto vazio => "sem função".
      const chaves = chavesFuncaoPorNome.get(servidor.nome);
      if (!chaves || chaves.size === 0) {
        if (!incluirSemFuncao) continue;
      } else if (![...chaves].some((k) => setFuncoes.has(k))) {
        continue;
      }
    }

    const contratosFiltrados = servidor.contratos.filter((c) => {
      if (!c.papeis.some((p) => setPapeis.has(p))) return false;
      if (somenteVigentes && !contratos[c.i]?.vigente) return false;
      if (setCategorias && !setCategorias.has(categoriaIdPorIndice[c.i])) return false;
      return true;
    });

    if (contratosFiltrados.length === 0) continue;

    const papeisServidor = Array.from(
      new Set(contratosFiltrados.flatMap((c) => c.papeis.filter((p) => setPapeis.has(p))))
    ).sort();

    let valorConsolidado = 0;
    let valorEmpenhadoConsolidado = 0;
    let valorPagoConsolidado = 0;

    for (const c of contratosFiltrados) {
      const contr = contratos[c.i];
      if (contr) {
        valorConsolidado += contr.valorGlobal || 0;
        valorEmpenhadoConsolidado += contr.valorEmpenhado || 0;
        valorPagoConsolidado += contr.valorPago || 0;
      }
    }

    resultado.push({
      nome: servidor.nome,
      papeis: papeisServidor,
      valorConsolidado,
      valorEmpenhadoConsolidado,
      valorPagoConsolidado,
      quantidadeContratos: contratosFiltrados.length,
      contratos: contratosFiltrados,
    });
  }

  return resultado.sort((a, b) => b.valorConsolidado - a.valorConsolidado);
}

export function ServidoresDashboard() {
  const estado = useDadosDashboard();
  const { responsaveis, funcoes, contratos, fonte } = estado.dados;

  // Chave é o nome exato de `responsaveis.ranking[i].nome` — `rankingFiltrado`
  // (abaixo) copia esse mesmo texto, então o mapa continua válido mesmo com o
  // filtro de papéis aplicado (que muda os índices, mas não os nomes).
  const funcoesPorNome = useMemo(() => {
    const map = new Map<string, ServidorFuncoes>();
    for (const s of funcoes.servidores) {
      if (s.responsavelRankingIndex === null) continue;
      const nomeRanking = responsaveis.ranking[s.responsavelRankingIndex]?.nome;
      if (nomeRanking) map.set(nomeRanking, s);
    }
    return map;
  }, [funcoes.servidores, responsaveis.ranking]);

  const todosPapeis = useMemo(() => {
    const set = new Set<string>();
    for (const r of responsaveis.ranking) {
      for (const p of r.papeis) set.add(p);
    }
    return Array.from(set).sort();
  }, [responsaveis.ranking]);

  // Níveis de função comissionada (FC/CJ) que aparecem entre os servidores do
  // ranking — atuais e também os já ocupados no histórico de portarias, para
  // que os mesmos chips sirvam com o "Vigente" da seção ligado ou desligado.
  const todasFuncoes = useMemo(() => {
    const set = new Set<string>();
    for (const s of funcoesPorNome.values()) {
      if (s.funcaoAtual) set.add(`${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel}`);
      for (const m of s.mandatos) set.add(`${m.tipo}-${m.nivel}`);
    }
    return Array.from(set).sort(ordenarFuncao);
  }, [funcoesPorNome]);

  const [papeisSelecionados, setPapeisSelecionados] = useState<string[]>([]);
  // "Considerar substitutos" começa DESLIGADO — só os titulares na conta até
  // que o usuário peça os substitutos.
  const [considerarSubstitutos, setConsiderarSubstitutos] = useState(false);
  // Regra do projeto: filtro Vigente começa LIGADO (ver README, "Regra: filtro
  // Vigente sempre ligado por padrão"); "Limpar" ainda o desliga (ver tudo).
  const [somenteVigentes, setSomenteVigentes] = useState(true);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<CategoriaValorId[]>(() =>
    CATEGORIAS_VALOR.map((c) => c.id),
  );
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<string[]>([]);
  const [incluirSemFuncao, setIncluirSemFuncao] = useState(true);
  // Chip "Vigente" da seção "Por função": ligado = recorta só pela função
  // comissionada de hoje; desligado = também considera o histórico de FC/CJ.
  // Padrão ligado, mesma regra do Vigente de contratos.
  const [funcaoVigente, setFuncaoVigente] = useState(true);

  // Chaves de função de cada servidor do ranking, por nome. Com `funcaoVigente`
  // ligado (padrão) é só a função comissionada de hoje; desligado, acrescenta
  // todo FC/CJ já ocupado no histórico de portarias. Conjunto vazio = "sem
  // função" no recorte atual.
  const chavesFuncaoPorNome = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [nome, s] of funcoesPorNome) {
      const chaves = new Set<string>();
      if (s.funcaoAtual) chaves.add(`${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel}`);
      if (!funcaoVigente) {
        for (const mand of s.mandatos) chaves.add(`${mand.tipo}-${mand.nivel}`);
      }
      m.set(nome, chaves);
    }
    return m;
  }, [funcoesPorNome, funcaoVigente]);

  useEffect(() => {
    if (todosPapeis.length > 0 && papeisSelecionados.length === 0) {
      setPapeisSelecionados(todosPapeis);
    }
  }, [todosPapeis]);

  useEffect(() => {
    if (todasFuncoes.length > 0 && funcoesSelecionadas.length === 0) {
      setFuncoesSelecionadas(todasFuncoes);
    }
  }, [todasFuncoes]);

  // Filtros do card de filtro, compartilháveis pela URL. A busca/ordenação da
  // tabela ficam por conta do próprio RankingTable.
  useSincronizarUrl(
    {
      papeis: incluidos.escrever(todosPapeis, papeisSelecionados),
      func: incluidos.escrever(todasFuncoes, funcoesSelecionadas),
      faixas_off: excluidos.escrever(IDS_FAIXA_VALOR, categoriasSelecionadas),
      subs: bool.escrever(considerarSubstitutos, false),
      vig: bool.escrever(somenteVigentes, true),
      func_vig: bool.escrever(funcaoVigente, true),
      semfunc: bool.escrever(incluirSemFuncao, true),
      // esquema antigo ("guardava os desmarcados"): limpa se aparecer num link
      func_off: null,
      papeis_off: null,
    },
    (sp) => {
      const p = sp.get('papeis');
      if (p !== null) setPapeisSelecionados(incluidos.ler(todosPapeis, p));
      const f = sp.get('func');
      if (f !== null) setFuncoesSelecionadas(incluidos.ler(todasFuncoes, f));
      const xo = sp.get('faixas_off');
      if (xo !== null) {
        setCategoriasSelecionadas(excluidos.ler(IDS_FAIXA_VALOR, xo) as CategoriaValorId[]);
      }
      setConsiderarSubstitutos(bool.ler(sp.get('subs'), false));
      setSomenteVigentes(bool.ler(sp.get('vig'), true));
      setFuncaoVigente(bool.ler(sp.get('func_vig'), true));
      setIncluirSemFuncao(bool.ler(sp.get('semfunc'), true));
    },
  );

  // Papéis que efetivamente filtram o ranking: quando "considerar substitutos"
  // está desligado, os papéis 🔄 saem da conta (e some quem só entra como
  // substituto num contrato).
  const papeisEfetivos = useMemo(
    () => (considerarSubstitutos ? papeisSelecionados : papeisSelecionados.filter((p) => !ehSubstituto(p))),
    [considerarSubstitutos, papeisSelecionados],
  );
  const todosPapeisEfetivos = useMemo(
    () => (considerarSubstitutos ? todosPapeis : todosPapeis.filter((p) => !ehSubstituto(p))),
    [considerarSubstitutos, todosPapeis],
  );
  const funcoesIrrestritas =
    funcoesSelecionadas.length === todasFuncoes.length && incluirSemFuncao;

  // Faixa de valor de cada contrato, por índice em `contratos` — calculado
  // uma vez e reaproveitado nos dois estágios de filtro abaixo.
  const categoriaIdPorIndice = useMemo(
    () => contratos.map((c) => categoriaDoValor(c.valorGlobal).id),
    [contratos],
  );

  // Estágio 1: só papéis + vigência (sem a faixa de valor) — usado como base
  // estável do KPI "Fiscais por faixa de valor" abaixo, para que ele continue
  // mostrando o panorama completo mesmo quando o filtro de faixa (estágio 2)
  // está restringindo o que aparece na tabela.
  const rankingPorPapelVigencia = useMemo(() => {
    if (papeisEfetivos.length === 0) return [];
    const semCorte =
      papeisEfetivos.length === todosPapeisEfetivos.length &&
      considerarSubstitutos &&
      funcoesIrrestritas &&
      !somenteVigentes;
    if (semCorte) return responsaveis.ranking;
    return filtrarRanking(
      responsaveis.ranking,
      contratos,
      categoriaIdPorIndice,
      papeisEfetivos,
      somenteVigentes,
      null,
      chavesFuncaoPorNome,
      funcoesIrrestritas ? null : funcoesSelecionadas,
      incluirSemFuncao,
    );
  }, [
    responsaveis.ranking,
    contratos,
    categoriaIdPorIndice,
    papeisEfetivos,
    todosPapeisEfetivos,
    considerarSubstitutos,
    somenteVigentes,
    chavesFuncaoPorNome,
    funcoesSelecionadas,
    funcoesIrrestritas,
    incluirSemFuncao,
  ]);

  // Estágio 2: acrescenta o filtro de faixa de valor sobre o resultado do
  // estágio 1 — é o que efetivamente aparece na tabela e nos demais KPIs da
  // página. Papéis/vigência já vieram aplicados; função também (por isso `null`
  // aqui). Reaplica sobre `rankingPorPapelVigencia` de forma idempotente.
  const rankingFiltrado = useMemo(() => {
    if (papeisEfetivos.length === 0 || categoriasSelecionadas.length === 0) return [];
    if (categoriasSelecionadas.length === CATEGORIAS_VALOR.length) return rankingPorPapelVigencia;
    return filtrarRanking(
      rankingPorPapelVigencia,
      contratos,
      categoriaIdPorIndice,
      papeisEfetivos,
      somenteVigentes,
      categoriasSelecionadas,
      chavesFuncaoPorNome,
      null,
      incluirSemFuncao,
    );
  }, [
    rankingPorPapelVigencia,
    contratos,
    categoriaIdPorIndice,
    papeisEfetivos,
    somenteVigentes,
    categoriasSelecionadas,
    chavesFuncaoPorNome,
    incluirSemFuncao,
  ]);

  // KPI: contratos por faixa de valor — universo completo de contratos,
  // respeitando "Somente contratos vigentes" (mesmo corte usado no resto da
  // página), mas independente do filtro de papéis (que é sobre pessoas, não
  // sobre o contrato em si).
  const contratosParaFaixaValor = useMemo(
    () => (somenteVigentes ? contratos.filter((c) => c.vigente) : contratos),
    [contratos, somenteVigentes],
  );

  const fatiasContratosPorFaixa = useMemo(() => {
    const contagem = new Map(CATEGORIAS_VALOR.map((c) => [c.id, 0]));
    for (const c of contratosParaFaixaValor) {
      const id = categoriaDoValor(c.valorGlobal).id;
      contagem.set(id, (contagem.get(id) ?? 0) + 1);
    }
    return CATEGORIAS_VALOR.map((categoria) => ({
      rotulo: `${categoria.simbolo} ${categoria.nome}`,
      quantidade: contagem.get(categoria.id) ?? 0,
      cor: categoria.cor,
    }));
  }, [contratosParaFaixaValor]);

  // KPI: fiscais por faixa de valor dos contratos que fiscalizam — sobre o
  // estágio 1 (papéis + vigência), ver comentário acima.
  const fiscaisPorFaixaValor = useMemo(
    () => contarServidoresPorFaixaValor(rankingPorPapelVigencia, (i) => categoriaIdPorIndice[i] as CategoriaValorId),
    [rankingPorPapelVigencia, categoriaIdPorIndice],
  );

  const calcMediana = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    if (s.length === 0) return 0;
    return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const medianaValor = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.valorConsolidado)),
    [rankingFiltrado]
  );

  const medianaEmpenhado = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.valorEmpenhadoConsolidado)),
    [rankingFiltrado]
  );

  const medianaPago = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.valorPagoConsolidado)),
    [rankingFiltrado]
  );

  // Distribuição por função (FC/CJ) dos responsáveis visíveis no ranking
  // filtrado — mesmo donut de /funcoes, aqui aplicado só a quem fiscaliza ou
  // gerencia contrato (o universo de /funcoes é mais amplo: inclui quem
  // nunca aparece como responsável, os "Não-Fiscal").
  const donutFuncoesResponsaveis = useMemo(
    () =>
      contarPorFuncaoAtual(
        rankingFiltrado.map((r) => ({ funcaoAtual: funcoesPorNome.get(r.nome)?.funcaoAtual ?? null })),
      ),
    [rankingFiltrado, funcoesPorNome],
  );

  const emContratosVigentesCount = useMemo(() => {
    const vigentesSet = new Set<number>();
    for (let i = 0; i < contratos.length; i++) {
      if (contratos[i].vigente) vigentesSet.add(i);
    }
    let count = 0;
    for (const r of rankingFiltrado) {
      if (r.contratos.some((c) => vigentesSet.has(c.i))) {
        count++;
      }
    }
    return count;
  }, [rankingFiltrado, contratos]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Servidores (Agentes Públicos)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agentes públicos do TSE que atuam como fiscais e gestores{' '}
            <DicaTermo id="fiscalGestor" alinhamento="esquerda" /> pelos maiores valores
            consolidados <DicaTermo id="valorConsolidado" alinhamento="esquerda" /> de
            contratos ·{' '}
            <a
              href={fonte}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: Compras.gov.br
            </a>{' '}
            · <DadosStatus estado={estado} />
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
          <Link
            href="/unidades"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Network className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Unidades</span>
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

      <div className="space-y-4">
        <FiltroServidores
          todosPapeis={todosPapeis}
          papeisSelecionados={papeisSelecionados}
          onPapeisChange={setPapeisSelecionados}
          considerarSubstitutos={considerarSubstitutos}
          onConsiderarSubstitutosChange={setConsiderarSubstitutos}
          somenteVigentes={somenteVigentes}
          onSomenteVigentesChange={setSomenteVigentes}
          categoriasSelecionadas={categoriasSelecionadas}
          onCategoriasChange={setCategoriasSelecionadas}
          todasFuncoes={todasFuncoes}
          funcoesSelecionadas={funcoesSelecionadas}
          onFuncoesChange={setFuncoesSelecionadas}
          incluirSemFuncao={incluirSemFuncao}
          onIncluirSemFuncaoChange={setIncluirSemFuncao}
          funcaoVigente={funcaoVigente}
          onFuncaoVigenteChange={setFuncaoVigente}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FuncaoStatCard
            titulo="Fiscais designados"
            detalhe={
              somenteVigentes
                ? `${numero(rankingFiltrado.length)} com contrato vigente hoje`
                : `${numero(rankingFiltrado.length)} no total · ${numero(emContratosVigentesCount)} atuam em contratos vigentes hoje`
            }
            icone={<Users className="h-4 w-4" aria-hidden />}
            contagens={donutFuncoesResponsaveis}
          />
          <StatCard
            titulo="Mediana por responsável"
            valor={brlCompacto(medianaValor)}
            detalhe={`Emp: ${brlCompacto(medianaEmpenhado)} · Pg: ${brlCompacto(medianaPago)}`}
            icone={<Scale className="h-4 w-4" aria-hidden />}
          />
          <ContagemStatCard
            titulo="Contratos por faixa de valor"
            detalhe={
              somenteVigentes
                ? `${numero(contratosParaFaixaValor.length)} contratos vigentes hoje`
                : `${numero(contratosParaFaixaValor.length)} contratos no total`
            }
            icone={<Coins className="h-4 w-4" aria-hidden />}
            fatias={fatiasContratosPorFaixa}
            unidadeSingular="contrato"
            unidadePlural="contratos"
          />
          <CategoriaValorServidoresCard
            titulo="Fiscais por faixa de valor"
            detalhe={`de ${numero(rankingPorPapelVigencia.length)} fiscais/gestores no filtro (papel, função e vigência) · uma pessoa pode contar em mais de uma faixa`}
            icone={<Coins className="h-4 w-4" aria-hidden />}
            contagens={fiscaisPorFaixaValor}
            totalBase={rankingPorPapelVigencia.length}
          />
        </div>

        <RankingTable ranking={rankingFiltrado} contratos={contratos} funcoesPorNome={funcoesPorNome} />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        O valor consolidado soma o &ldquo;Valor Global&rdquo; de cada contrato em que
        o servidor aparece como responsável nos papéis selecionados
        {considerarSubstitutos ? '' : ' (sem os substitutos)'}
        {somenteVigentes ? ' e vigente hoje' : ''} e dentro das faixas de valor
        selecionadas, contando cada contrato uma única vez por pessoa. O filtro
        &ldquo;Por função&rdquo; recorta pelo cargo comissionado vigente do
        servidor (FC/CJ <DicaTermo id="fcCj" alinhamento="esquerda" />). Faixas de valor:{' '}
        {CATEGORIAS_VALOR.map((c) => `${c.simbolo} ${c.nome}`).join(' · ')}.
        <AppVersion />
      </footer>
    </main>
  );
}
