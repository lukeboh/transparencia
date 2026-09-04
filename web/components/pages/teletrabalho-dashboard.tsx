'use client';

import { useMemo, useState } from 'react';
import { Activity, Briefcase, Building2, Check, Laptop, Scale, ShieldCheck } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { FuncaoStatCard } from '@/components/dashboard/funcao-stat-card';
import { contarPorFuncaoAtual } from '@/components/dashboard/funcao-donut';
import { ContagemStatCard } from '@/components/dashboard/contagem-stat-card';
import type { FatiaContagem } from '@/components/dashboard/contagem-donut';
import { TeletrabalhoTable } from '@/components/dashboard/teletrabalho-table';
import { TeletrabalhoEvolucaoChart } from '@/components/dashboard/teletrabalho-evolucao-chart';
import { TeletrabalhoDetalheDialog } from '@/components/dashboard/teletrabalho-detalhe-dialog';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { contratosDoResponsavel } from '@/components/dashboard/ranking-table';
import { DadosStatus } from '@/components/dashboard/dados-status';
import { DicaTermo } from '@/components/ui/dica-termo';
import { AppVersion } from '@/components/app-version';
import { useDadosDashboard } from '@/lib/use-dados';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { bool } from '@/lib/url-filtros';
import { criarResolvedorLotacao, textoSiglas, type ResolvedorLotacao } from '@/lib/lotacao-hierarquia';
import { cn, nomeProprio, numero } from '@/lib/utils';
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

/** Vigente = tem ao menos um período sem data de fim (em aberto) hoje. */
function estaVigente(linha: LinhaTeletrabalho): boolean {
  return linha.periodos.some((p) => p.dataFim === null);
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

function textoNormalizado(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Caminho de siglas ("SEVIN / COTEL / STI") da lotação da pessoa — mesmo texto
 *  usado na coluna Lotação da tabela; cai no nome plano quando a árvore não resolve. */
function siglasDaLinha(linha: LinhaTeletrabalho, resolver: ResolvedorLotacao): string {
  const niveis = lotacaoDe(linha);
  const folha = niveis && niveis.length > 0 ? niveis[0] : null;
  const u = resolver(folha);
  return u.length > 0 ? textoSiglas(u) : (folha ?? '');
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

function calcMediana(valores: number[]) {
  const s = [...valores].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length === 0) return 0;
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function TeletrabalhoDashboard() {
  const estado = useDadosDashboard();
  const { teletrabalho, funcoes, responsaveis, contratos, resumo, unidades, servidores } = estado.dados;

  const resolverLotacao = useMemo(
    () => criarResolvedorLotacao(unidades.arvore),
    [unidades.arvore],
  );

  const funcoesPorNome = useMemo(() => {
    const map = new Map<string, ServidorFuncoes>();
    for (const s of funcoes.servidores) map.set(normalizeNome(s.nome), s);
    return map;
  }, [funcoes.servidores]);

  const funcaoDe = (linha: LinhaTeletrabalho) => funcoesPorNome.get(normalizeNome(linha.nome));

  // "Em teletrabalho agora" é sempre sobre o universo completo — não muda
  // com o filtro "somente vigentes hoje" abaixo, que só recorta o que a
  // tabela/os demais KPIs mostram.
  const emTeletrabalhoAgora = useMemo(() => teletrabalho.ranking.filter(estaVigente).length, [teletrabalho.ranking]);

  const donutAgora = useMemo<FatiaContagem[]>(
    () => [
      { rotulo: 'Em teletrabalho agora', quantidade: emTeletrabalhoAgora },
      { rotulo: 'Demais agentes públicos', quantidade: Math.max(0, resumo.totalAgentesPublicos - emTeletrabalhoAgora) },
    ],
    [emTeletrabalhoAgora, resumo.totalAgentesPublicos],
  );

  // Regra do projeto: filtro Vigente começa LIGADO (ver README, "Regra: filtro
  // Vigente sempre ligado por padrão"). O usuário desliga para ver o histórico.
  const [somenteVigentes, setSomenteVigentes] = useState(true);
  // Filtro de lotação: vive na página (não mais só na tabela) para que o gráfico
  // "mês a mês" e seu denominador também respondam a ele.
  const [filtroLotacao, setFiltroLotacao] = useState('');

  // Filtros compartilháveis pela URL (a busca/ordenação da tabela ficam por
  // conta do próprio TeletrabalhoTable).
  useSincronizarUrl(
    {
      vig: bool.escrever(somenteVigentes, true),
      lot: filtroLotacao || undefined,
    },
    (sp) => {
      setSomenteVigentes(bool.ler(sp.get('vig'), true));
      const lot = sp.get('lot');
      if (lot) setFiltroLotacao(lot);
    },
  );

  const rankingFiltrado = useMemo(
    () => (somenteVigentes ? teletrabalho.ranking.filter(estaVigente) : teletrabalho.ranking),
    [teletrabalho.ranking, somenteVigentes],
  );

  const termoLotacao = filtroLotacao.trim();

  // Recorte adicional por lotação, só para o gráfico (a tabela aplica o mesmo
  // termo internamente, mantendo a numeração do ranking antes do filtro-texto).
  const rankingGrafico = useMemo(() => {
    const t = textoNormalizado(termoLotacao);
    if (!t) return rankingFiltrado;
    return rankingFiltrado.filter((l) => textoNormalizado(siglasDaLinha(l, resolverLotacao)).includes(t));
  }, [rankingFiltrado, termoLotacao, resolverLotacao]);

  // Denominador do gráfico: TSE inteiro, ou só os agentes públicos da lotação
  // filtrada (mesma resolução de siglas da coluna Lotação).
  const denominadorGrafico = useMemo(() => {
    const t = textoNormalizado(termoLotacao);
    if (!t) return resumo.totalAgentesPublicos;
    let n = 0;
    for (const s of servidores.lista) {
      if (!s.naRelacaoAtual) continue;
      const u = resolverLotacao(s.lotacao);
      const sig = u.length > 0 ? textoSiglas(u) : (s.lotacao ?? '');
      if (textoNormalizado(sig).includes(t)) n += 1;
    }
    return n;
  }, [termoLotacao, servidores.lista, resolverLotacao, resumo.totalAgentesPublicos]);

  const medianaFiltrada = useMemo(
    () => calcMediana(rankingFiltrado.map((r) => r.diasConsolidados)),
    [rankingFiltrado],
  );

  const donutFiscais = useMemo<FatiaContagem[]>(() => {
    const fiscais = rankingFiltrado.filter((r) => r.responsavelRankingIndex !== null).length;
    const semContrato = rankingFiltrado.length - fiscais;
    return [
      { rotulo: 'Fiscal/gestor', quantidade: fiscais },
      { rotulo: 'Sem contrato', quantidade: semContrato },
    ];
  }, [rankingFiltrado]);

  const donutFuncoes = useMemo(
    () => contarPorFuncaoAtual(rankingFiltrado.map((r) => ({ funcaoAtual: funcaoDe(r)?.funcaoAtual ?? null }))),
    [rankingFiltrado, funcoesPorNome],
  );

  const donutUnidades = useMemo(() => contarPorUnidadeTopo(rankingFiltrado), [rankingFiltrado]);

  const [detalheAberto, setDetalheAberto] = useState<LinhaTeletrabalho | null>(null);
  const [contratosDe, setContratosDe] = useState<LinhaRanking | null>(null);

  return (
    <main className="max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <AppHeader
        atual="teletrabalho"
        titulo="Teletrabalho"
        descricao={
          <>
            Dias em regime de teletrabalho por servidor{' '}
            <DicaTermo id="teletrabalhoVigente" alinhamento="esquerda" /> ·{' '}
            <a
              href="https://www.tse.jus.br/transparencia-e-prestacao-de-contas/pessoal/cargos-e-funcoes/servidores-em-regime-de-teletrabalho"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              fonte: TSE — servidores em regime de teletrabalho
            </a>{' '}
            · <DadosStatus estado={estado} />
          </>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => setSomenteVigentes((v) => !v)}
            aria-pressed={somenteVigentes}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              somenteVigentes
                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {somenteVigentes && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            Somente vigentes hoje
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            titulo="Servidores em teletrabalho"
            valor={numero(rankingFiltrado.length)}
            detalhe={
              somenteVigentes
                ? `${numero(rankingFiltrado.length)} vigentes hoje`
                : `${numero(teletrabalho.total)} no total · ${numero(emTeletrabalhoAgora)} vigentes hoje`
            }
            icone={<Laptop className="h-4 w-4" aria-hidden />}
          />
          <ContagemStatCard
            titulo="Teletrabalho agora"
            detalhe={`${numero(emTeletrabalhoAgora)} de ${numero(resumo.totalAgentesPublicos)} agentes públicos do TSE`}
            icone={<Activity className="h-4 w-4" aria-hidden />}
            fatias={donutAgora}
          />
          <StatCard
            titulo="Mediana por servidor"
            valor={`${numero(medianaFiltrada)} dias`}
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

        <TeletrabalhoEvolucaoChart
          ranking={rankingGrafico}
          totalOrgao={denominadorGrafico}
          mesReferencia={estado.dados.geradoEm.slice(0, 7)}
          somenteVigentes={somenteVigentes}
          escopoLotacao={termoLotacao || null}
        />

        <TeletrabalhoTable
          ranking={rankingFiltrado}
          funcaoDe={funcaoDe}
          lotacaoDe={lotacaoDe}
          resolverLotacao={resolverLotacao}
          vigenteDe={estaVigente}
          responsaveisRanking={responsaveis.ranking}
          filtroLotacao={filtroLotacao}
          onFiltroLotacao={setFiltroLotacao}
          onVerDetalhe={setDetalheAberto}
          onVerContratos={setContratosDe}
        />
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        Vigente = tem ao menos um período em aberto (sem data de fim) hoje. Cada período soma os dias corridos entre
        início e fim (ou hoje, quando segue em aberto); períodos sobrepostos da mesma pessoa não são mesclados, então
        dias sobrepostos podem ser contados mais de uma vez. Cruzamento com fiscais/gestores e com função
        comissionada é feito pelo nome do servidor — nenhuma das fontes expõe CPF nem matrícula em comum — então
        homônimos podem gerar vínculos incorretos. O gráfico <strong>Teletrabalho mês a mês</strong> conta, para cada
        mês, os servidores do recorte atual (inclusive o filtro de lotação) com um período ativo naquele mês, sobre o
        quadro de agentes públicos de <strong>hoje</strong> — do TSE inteiro ou, quando há filtro de lotação, só o
        dessa unidade (não há série histórica de quadro de pessoal, então o denominador é fixo — os meses antigos
        ficam ligeiramente subestimados se o TSE tinha menos gente na época). Só entra aqui o <strong>regime formal
        de teletrabalho</strong>; o trabalho remoto emergencial da pandemia (2020–2021) foi outra modalidade e não
        consta nesta fonte.
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
