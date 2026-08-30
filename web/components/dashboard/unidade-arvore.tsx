'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Info, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PillToggle } from '@/components/ui/pill-toggle';
import { FiscalChips, FuncaoChips, type BasePercentual, type NivelDetalhe } from '@/components/dashboard/unidade-chips';
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { UnidadeDetalheDialog } from '@/components/dashboard/unidade-detalhe-dialog';
import { DicaTermo } from '@/components/ui/dica-termo';
import { InfoDica } from '@/components/ui/info-dica';
import { cn, numero, percentual } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import { achatarUnidades, somaFiscais, somaFuncoes, type LinhaUnidade } from '@/lib/unidades-flat';
import type { UnidadeNode } from '@/lib/dashboard-data';
import {
  CATEGORIAS_UNIDADE,
  IDS_CATEGORIA,
  classificarUnidades,
  rotuloCategoria,
  type CategoriaUnidade,
} from '@/lib/unidades-categoria';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { bool, excluidos } from '@/lib/url-filtros';

const PROFUNDIDADE_PADRAO_EXPANDIDA = 2;

function normalizarBusca(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Ids dos nós com filhos até (sem incluir) `profundidadeMax` — expandi-los revela nós até essa profundidade. */
function idsExpandidosPadrao(no: UnidadeNode, profundidadeMax: number, profundidade = 0, acc = new Set<string>()) {
  if (profundidade < profundidadeMax && no.children.length > 0) {
    acc.add(no.id);
    for (const filho of no.children) idsExpandidosPadrao(filho, profundidadeMax, profundidade + 1, acc);
  }
  return acc;
}

function idsComFilhos(no: UnidadeNode, acc = new Set<string>()) {
  if (no.children.length > 0) {
    acc.add(no.id);
    for (const filho of no.children) idsComFilhos(filho, acc);
  }
  return acc;
}

function idsTodos(no: UnidadeNode, acc = new Set<string>()) {
  acc.add(no.id);
  for (const filho of no.children) idsTodos(filho, acc);
  return acc;
}

function indexarPorId(no: UnidadeNode, acc = new Map<string, UnidadeNode>()) {
  acc.set(no.id, no);
  for (const filho of no.children) indexarPorId(filho, acc);
  return acc;
}

// Exportação: uma linha por unidade, achatada de `achatarUnidades`.
const COLUNAS_EXPORT_UNIDADES: ColunaExport<LinhaUnidade>[] = [
  { cabecalho: 'Caminho', valor: (u) => u.caminho },
  { cabecalho: 'Sigla', valor: (u) => u.sigla },
  { cabecalho: 'Unidade', valor: (u) => u.nome },
  { cabecalho: 'Nível', valor: (u) => u.nivel },
  { cabecalho: 'Servidores (direto)', valor: (u) => u.node.direto.servidores },
  { cabecalho: 'Servidores (consolidado)', valor: (u) => u.node.consolidado.servidores },
  { cabecalho: 'FC (consolidado)', valor: (u) => somaFuncoes(u.node.consolidado, 'FC') },
  { cabecalho: 'CJ (consolidado)', valor: (u) => somaFuncoes(u.node.consolidado, 'CJ') },
  { cabecalho: 'Fiscais (consolidado)', valor: (u) => somaFiscais(u.node.consolidado) },
  { cabecalho: 'Teletrabalho (direto)', valor: (u) => u.node.direto.teletrabalho },
  { cabecalho: 'Teletrabalho (consolidado)', valor: (u) => u.node.consolidado.teletrabalho },
];

interface UnidadeCardProps {
  node: UnidadeNode;
  profundidade: number;
  totalServidoresTSE: number;
  expandedIds: Set<string>;
  consolidadoIds: Set<string>;
  detalhadoIds: Set<string>;
  baseGeralIds: Set<string>;
  /** id do nó → filhos que devem ser renderizados (já com netos promovidos quando um nível intermediário está oculto pelo filtro de tipo). */
  filhosVisiveisPorId: Map<string, UnidadeNode[]>;
  onToggleExpand: (id: string) => void;
  onToggleConsolidado: (id: string) => void;
  onToggleDetalhe: (id: string) => void;
  onToggleBase: (id: string) => void;
  onAbrirDetalhe: (id: string) => void;
}

function UnidadeCard({
  node,
  profundidade,
  totalServidoresTSE,
  expandedIds,
  consolidadoIds,
  detalhadoIds,
  baseGeralIds,
  filhosVisiveisPorId,
  onToggleExpand,
  onToggleConsolidado,
  onToggleDetalhe,
  onToggleBase,
  onAbrirDetalhe,
}: UnidadeCardProps) {
  const filhosRender = filhosVisiveisPorId.get(node.id) ?? node.children;
  const temFilhos = filhosRender.length > 0;
  const isRaiz = node.parentId === null;
  // Raiz não tem população própria (só filhos) e folha não tem subárvore — em
  // ambos os casos o toggle de consolidação seria decorativo, então nem aparece.
  // Usa a subárvore real (`node.children`), não a filtrada: as métricas
  // consolidadas continuam somando todos os descendentes, mesmo os que o filtro
  // de tipo estiver escondendo da árvore.
  const mostrarToggleConsolidado = !isRaiz && node.children.length > 0;
  const consolidar = isRaiz || consolidadoIds.has(node.id);
  const metricas = consolidar ? node.consolidado : node.direto;
  const expandido = expandedIds.has(node.id);
  const modoDetalhe: NivelDetalhe = detalhadoIds.has(node.id) ? 'detalhado' : 'simples';
  const modoBase: BasePercentual = baseGeralIds.has(node.id) ? 'geral' : 'unidade';
  const denominador = modoBase === 'geral' ? totalServidoresTSE : metricas.servidores;

  return (
    <div className={cn(profundidade > 0 && 'ml-4 border-l border-border pl-4 sm:ml-6 sm:pl-6')}>
      {/* No desktop o card encolhe até a largura do próprio conteúdo (nome
          longo ainda quebra dentro do teto); no mobile ocupa a linha toda. */}
      <Card className="mb-3 w-full sm:w-fit sm:max-w-2xl">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
          <div className="flex min-w-0 items-start gap-2">
            {temFilhos ? (
              <button
                type="button"
                onClick={() => onToggleExpand(node.id)}
                aria-expanded={expandido}
                aria-label={expandido ? `Recolher ${node.sigla}` : `Expandir ${node.sigla}`}
                className="mt-0.5 shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {expandido ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
              </button>
            ) : (
              <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-1.5">
                <span>{node.sigla}</span>
                <button
                  type="button"
                  onClick={() => onAbrirDetalhe(node.id)}
                  aria-label={`Ver detalhes de ${node.sigla}`}
                  title={`Ver detalhes de ${node.sigla}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </CardTitle>
              <CardDescription>{node.nome}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mostrarToggleConsolidado && (
              <span className="inline-flex items-center gap-1">
                <PillToggle pressionado={consolidar} onClick={() => onToggleConsolidado(node.id)}>
                  Consolidado: {consolidar ? 'sim' : 'não'}
                </PillToggle>
                <DicaTermo id="consolidado" />
              </span>
            )}
            <PillToggle pressionado={modoDetalhe === 'detalhado'} onClick={() => onToggleDetalhe(node.id)}>
              Detalhe: {modoDetalhe}
            </PillToggle>
            <PillToggle pressionado={modoBase === 'geral'} onClick={() => onToggleBase(node.id)}>
              Base do %: {modoBase}
            </PillToggle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Servidores vigentes</span>
            <span className="font-medium tabular-nums">
              {numero(metricas.servidores)} · {percentual(metricas.servidores, denominador)}%
            </span>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Funções vigentes</div>
            <FuncaoChips contagens={metricas.funcoes} modo={modoDetalhe} denominador={denominador} />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Fiscais vigentes</div>
            <FiscalChips contagens={metricas.fiscais} modo={modoDetalhe} denominador={denominador} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Em teletrabalho vigentes</span>
            <span className="font-medium tabular-nums">
              {numero(metricas.teletrabalho)} · {percentual(metricas.teletrabalho, denominador)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {temFilhos && expandido && (
        <div>
          {filhosRender.map((filho) => (
            <UnidadeCard
              key={filho.id}
              node={filho}
              profundidade={profundidade + 1}
              totalServidoresTSE={totalServidoresTSE}
              expandedIds={expandedIds}
              consolidadoIds={consolidadoIds}
              detalhadoIds={detalhadoIds}
              baseGeralIds={baseGeralIds}
              filhosVisiveisPorId={filhosVisiveisPorId}
              onToggleExpand={onToggleExpand}
              onToggleConsolidado={onToggleConsolidado}
              onToggleDetalhe={onToggleDetalhe}
              onToggleBase={onToggleBase}
              onAbrirDetalhe={onAbrirDetalhe}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function UnidadeArvore({ arvore, totalServidoresTSE }: { arvore: UnidadeNode; totalServidoresTSE: number }) {
  const porId = useMemo(() => indexarPorId(arvore), [arvore]);
  const categoriaPorId = useMemo(() => classificarUnidades(arvore), [arvore]);

  // Filtro de tipo: cada categoria liga/desliga a exibição dos nós dela na
  // árvore. Um nó oculto não some com a subárvore — os filhos visíveis sobem
  // para o ancestral visível mais próximo. Todas ligadas por padrão.
  const [categoriasAtivas, setCategoriasAtivas] = useState<Set<CategoriaUnidade>>(
    () => new Set(CATEGORIAS_UNIDADE.map((c) => c.id)),
  );

  const [expandedIds, setExpandedIds] = useState(() => idsExpandidosPadrao(arvore, PROFUNDIDADE_PADRAO_EXPANDIDA));
  // "Consolidado: sim" por padrão em todo nó com filhos — senão um nó
  // puramente organizacional (sem gente lotada direto nele) apareceria
  // zerado por padrão, o que parece quebrado; "não" fica como drill-down.
  const [consolidadoIds, setConsolidadoIds] = useState(() => idsComFilhos(arvore));
  // Nível de detalhe por unidade: ausente do Set = "simples" (padrão — a
  // árvore inteira detalhada de uma vez fica densa demais). O botão geral
  // reseta todas as unidades de uma vez; cada card pode sobrescrever o seu.
  const [detalhadoIds, setDetalhadoIds] = useState<Set<string>>(() => new Set());
  const [nivelGlobal, setNivelGlobal] = useState<NivelDetalhe>('simples');
  // Base do percentual por unidade: presente no Set = "geral" (servidores do
  // TSE inteiro), ausente = "unidade" (só os servidores daquele nó, no
  // estado atual do toggle Consolidado). Mesmo padrão de botão geral +
  // override por card do nível de detalhe.
  const [baseGeralIds, setBaseGeralIds] = useState<Set<string>>(() => new Set(idsTodos(arvore)));
  const [baseGlobal, setBaseGlobal] = useState<BasePercentual>('geral');
  const [busca, setBusca] = useState('');
  // Primeiro nível de detalhamento de uma unidade — modal interno.
  const [detalheId, setDetalheId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedIds((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function toggleConsolidado(id: string) {
    setConsolidadoIds((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function toggleDetalhe(id: string) {
    setDetalhadoIds((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  /** Botão geral: aplica o mesmo nível de detalhe a toda a árvore de uma vez, substituindo overrides individuais de cada card. */
  function alternarNivelGlobal() {
    const proximo: NivelDetalhe = nivelGlobal === 'detalhado' ? 'simples' : 'detalhado';
    setNivelGlobal(proximo);
    setDetalhadoIds(proximo === 'detalhado' ? idsTodos(arvore) : new Set());
  }

  function toggleBase(id: string) {
    setBaseGeralIds((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  /** Botão geral: aplica a mesma base de percentual a toda a árvore de uma vez, substituindo overrides individuais de cada card. */
  function alternarBaseGlobal() {
    const proximo: BasePercentual = baseGlobal === 'geral' ? 'unidade' : 'geral';
    setBaseGlobal(proximo);
    setBaseGeralIds(proximo === 'geral' ? idsTodos(arvore) : new Set());
  }

  function toggleCategoria(id: CategoriaUnidade) {
    setCategoriasAtivas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const todasCategoriasAtivas = categoriasAtivas.size === CATEGORIAS_UNIDADE.length;

  function mostrarTodasCategorias() {
    setCategoriasAtivas(new Set(CATEGORIAS_UNIDADE.map((c) => c.id)));
  }

  useSincronizarUrl(
    {
      q: busca || undefined,
      tipos_off: excluidos.escrever(IDS_CATEGORIA, [...categoriasAtivas]),
      det: bool.escrever(nivelGlobal === 'detalhado', false),
      base: baseGlobal === 'unidade' ? 'unidade' : undefined,
    },
    (sp) => {
      const q = sp.get('q');
      if (q) setBusca(q);

      const off = sp.get('tipos_off');
      if (off !== null) {
        setCategoriasAtivas(new Set(excluidos.ler(IDS_CATEGORIA, off) as CategoriaUnidade[]));
      }

      if (bool.ler(sp.get('det'), false)) {
        setNivelGlobal('detalhado');
        setDetalhadoIds(idsTodos(arvore));
      }

      if (sp.get('base') === 'unidade') {
        setBaseGlobal('unidade');
        setBaseGeralIds(new Set());
      }
    },
  );

  const buscaNormalizada = normalizarBusca(busca);

  const resultadoBusca = useMemo(() => {
    if (!buscaNormalizada) return null;

    const matchIds = new Set<string>();
    for (const node of porId.values()) {
      if (normalizarBusca(node.nome).includes(buscaNormalizada) || normalizarBusca(node.sigla).includes(buscaNormalizada)) {
        matchIds.add(node.id);
      }
    }

    const visibleIds = new Set<string>();
    const expandirIds = new Set<string>();

    function incluirSubarvore(node: UnidadeNode) {
      visibleIds.add(node.id);
      for (const filho of node.children) incluirSubarvore(filho);
    }

    for (const id of matchIds) {
      const node = porId.get(id);
      if (!node) continue;
      incluirSubarvore(node);

      let paiId = node.parentId;
      while (paiId) {
        visibleIds.add(paiId);
        expandirIds.add(paiId);
        paiId = porId.get(paiId)?.parentId ?? null;
      }
    }

    return { matchIds, visibleIds, expandirIds };
  }, [buscaNormalizada, porId]);

  const expandedEfetivo = useMemo(() => {
    if (!resultadoBusca) return expandedIds;
    return new Set([...expandedIds, ...resultadoBusca.expandirIds, ...resultadoBusca.matchIds]);
  }, [expandedIds, resultadoBusca]);

  // Para cada nó, a lista de filhos que devem ser renderizados: os filhos cuja
  // categoria está ligada, e — no lugar de cada filho oculto — os netos
  // visíveis dele (promovidos). A busca tem prioridade: um nó que casa com a
  // busca (e seus ancestrais, para chegar até ele) aparece mesmo com a
  // categoria desligada; dentro da subárvore do resultado o filtro de tipo
  // ainda vale.
  const filhosVisiveisPorId = useMemo(() => {
    const busca = resultadoBusca;

    function noVisivel(no: UnidadeNode): boolean {
      const cat = categoriaPorId.get(no.id) ?? 'ramo';
      if (cat === 'tribunal') return true;
      if (busca) {
        if (busca.matchIds.has(no.id) || busca.expandirIds.has(no.id)) return true;
        if (!busca.visibleIds.has(no.id)) return false;
      }
      return categoriasAtivas.has(cat);
    }

    function filhosRenderizados(no: UnidadeNode): UnidadeNode[] {
      const out: UnidadeNode[] = [];
      for (const filho of no.children) {
        if (noVisivel(filho)) out.push(filho);
        else out.push(...filhosRenderizados(filho));
      }
      return out;
    }

    const mapa = new Map<string, UnidadeNode[]>();
    function visita(no: UnidadeNode) {
      mapa.set(no.id, filhosRenderizados(no));
      for (const filho of no.children) visita(filho);
    }
    visita(arvore);
    return mapa;
  }, [arvore, categoriaPorId, categoriasAtivas, resultadoBusca]);

  // Todo id que aparece renderizado em algum lugar da árvore (raiz + todos os
  // filhos visíveis de todos os nós) — base do que a exportação enxerga.
  const idsVisiveis = useMemo(() => {
    const ids = new Set<string>([arvore.id]);
    for (const filhos of filhosVisiveisPorId.values()) {
      for (const filho of filhos) ids.add(filho.id);
    }
    return ids;
  }, [arvore, filhosVisiveisPorId]);

  // Exporta uma linha por unidade — só as que estão visíveis na árvore agora
  // (filtro de tipo + busca).
  const linhasExport = useMemo(() => achatarUnidades(arvore, idsVisiveis), [arvore, idsVisiveis]);

  function expandirTudo() {
    setExpandedIds(idsComFilhos(arvore));
  }

  function recolherTudo() {
    setExpandedIds(new Set());
  }

  const detalheNode = detalheId ? porId.get(detalheId) ?? null : null;
  const detalheCaminho = useMemo(() => {
    if (!detalheNode) return [];
    const siglas: string[] = [];
    let paiId = detalheNode.parentId;
    while (paiId) {
      const pai = porId.get(paiId);
      if (!pai) break;
      siglas.unshift(pai.sigla);
      paiId = pai.parentId;
    }
    return siglas;
  }, [detalheNode, porId]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar unidade por sigla ou nome…"
            aria-label="Buscar unidade por sigla ou nome"
            className={cn(
              'h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring',
              '[&::-webkit-search-cancel-button]:hidden',
            )}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={expandirTudo}
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={recolherTudo}
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Recolher tudo
          </button>
          <PillToggle pressionado={nivelGlobal === 'detalhado'} onClick={alternarNivelGlobal}>
            Nível de detalhe: {nivelGlobal}
          </PillToggle>
          <span className="inline-flex items-center gap-1">
            <PillToggle pressionado={baseGlobal === 'geral'} onClick={alternarBaseGlobal}>
              Base do %: {baseGlobal}
            </PillToggle>
            <DicaTermo id="basePercentual" alinhamento="direita" />
          </span>
          <BotaoExportar
            linhas={linhasExport}
            colunas={COLUNAS_EXPORT_UNIDADES}
            nomeArquivo="unidades"
            nomeAba="Unidades"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Mostrar
          <InfoDica titulo="Como funcionam os filtros de tipo" alinhamento="esquerda">
            Ligam e desligam a exibição de cada tipo de unidade na árvore. Ao ocultar um nível
            intermediário (uma coordenadoria, por exemplo), as subunidades dela sobem para o
            ramo visível acima — nada some da contagem, só da navegação. A busca sempre mostra
            o que casa, mesmo com o tipo desligado.
          </InfoDica>
        </span>
        {CATEGORIAS_UNIDADE.map((categoria) => (
          <PillToggle
            key={categoria.id}
            pressionado={categoriasAtivas.has(categoria.id)}
            onClick={() => toggleCategoria(categoria.id)}
          >
            <span title={categoria.descricao}>{categoria.rotulo}</span>
          </PillToggle>
        ))}
        {!todasCategoriasAtivas && (
          <button
            type="button"
            onClick={mostrarTodasCategorias}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> Mostrar tudo
          </button>
        )}
      </div>

      {resultadoBusca && resultadoBusca.matchIds.size === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada para &ldquo;{busca}&rdquo;.</p>
      ) : (
        <UnidadeCard
          node={arvore}
          profundidade={0}
          totalServidoresTSE={totalServidoresTSE}
          expandedIds={expandedEfetivo}
          consolidadoIds={consolidadoIds}
          detalhadoIds={detalhadoIds}
          baseGeralIds={baseGeralIds}
          filhosVisiveisPorId={filhosVisiveisPorId}
          onToggleExpand={toggleExpand}
          onToggleConsolidado={toggleConsolidado}
          onToggleDetalhe={toggleDetalhe}
          onToggleBase={toggleBase}
          onAbrirDetalhe={setDetalheId}
        />
      )}

      <UnidadeDetalheDialog
        node={detalheNode}
        caminho={detalheCaminho}
        categoriaRotulo={detalheNode ? rotuloCategoria(categoriaPorId.get(detalheNode.id) ?? 'ramo') : ''}
        totalServidoresTSE={totalServidoresTSE}
        open={detalheNode !== null}
        onClose={() => setDetalheId(null)}
      />
    </div>
  );
}
