'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ExternalLink, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FiscalChips, FuncaoChips, type BasePercentual, type NivelDetalhe } from '@/components/dashboard/unidade-chips';
import { cn, numero, percentual } from '@/lib/utils';
import { urlUnidadeDetalhe, type UnidadeNode } from '@/lib/dashboard-data';

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

function PillToggle({ pressionado, onClick, children }: { pressionado: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressionado}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        pressionado
          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {pressionado && <Check className="h-3 w-3 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

interface UnidadeCardProps {
  node: UnidadeNode;
  profundidade: number;
  totalServidoresTSE: number;
  expandedIds: Set<string>;
  consolidadoIds: Set<string>;
  detalhadoIds: Set<string>;
  baseGeralIds: Set<string>;
  visibleIds: Set<string> | null;
  onToggleExpand: (id: string) => void;
  onToggleConsolidado: (id: string) => void;
  onToggleDetalhe: (id: string) => void;
  onToggleBase: (id: string) => void;
}

function UnidadeCard({
  node,
  profundidade,
  totalServidoresTSE,
  expandedIds,
  consolidadoIds,
  detalhadoIds,
  baseGeralIds,
  visibleIds,
  onToggleExpand,
  onToggleConsolidado,
  onToggleDetalhe,
  onToggleBase,
}: UnidadeCardProps) {
  const temFilhos = node.children.length > 0;
  const isRaiz = node.parentId === null;
  // Raiz não tem população própria (só filhos) e folha não tem subárvore — em
  // ambos os casos o toggle de consolidação seria decorativo, então nem aparece.
  const mostrarToggleConsolidado = !isRaiz && temFilhos;
  const consolidar = isRaiz || consolidadoIds.has(node.id);
  const metricas = consolidar ? node.consolidado : node.direto;
  const expandido = expandedIds.has(node.id);
  const modoDetalhe: NivelDetalhe = detalhadoIds.has(node.id) ? 'detalhado' : 'simples';
  const modoBase: BasePercentual = baseGeralIds.has(node.id) ? 'geral' : 'unidade';
  const denominador = modoBase === 'geral' ? totalServidoresTSE : metricas.servidores;

  return (
    <div className={cn(profundidade > 0 && 'ml-4 border-l border-border pl-4 sm:ml-6 sm:pl-6')}>
      <Card className="mb-3">
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
                <a
                  href={urlUnidadeDetalhe(node.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver ${node.sigla} na fonte`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </CardTitle>
              <CardDescription>{node.nome}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mostrarToggleConsolidado && (
              <PillToggle pressionado={consolidar} onClick={() => onToggleConsolidado(node.id)}>
                Consolidado: {consolidar ? 'sim' : 'não'}
              </PillToggle>
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
          {node.children
            .filter((filho) => !visibleIds || visibleIds.has(filho.id))
            .map((filho) => (
              <UnidadeCard
                key={filho.id}
                node={filho}
                profundidade={profundidade + 1}
                totalServidoresTSE={totalServidoresTSE}
                expandedIds={expandedIds}
                consolidadoIds={consolidadoIds}
                detalhadoIds={detalhadoIds}
                baseGeralIds={baseGeralIds}
                visibleIds={visibleIds}
                onToggleExpand={onToggleExpand}
                onToggleConsolidado={onToggleConsolidado}
                onToggleDetalhe={onToggleDetalhe}
                onToggleBase={onToggleBase}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function UnidadeArvore({ arvore, totalServidoresTSE }: { arvore: UnidadeNode; totalServidoresTSE: number }) {
  const porId = useMemo(() => indexarPorId(arvore), [arvore]);

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

  function expandirTudo() {
    setExpandedIds(idsComFilhos(arvore));
  }

  function recolherTudo() {
    setExpandedIds(new Set());
  }

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
          <PillToggle pressionado={baseGlobal === 'geral'} onClick={alternarBaseGlobal}>
            Base do %: {baseGlobal}
          </PillToggle>
        </div>
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
          visibleIds={resultadoBusca?.visibleIds ?? null}
          onToggleExpand={toggleExpand}
          onToggleConsolidado={toggleConsolidado}
          onToggleDetalhe={toggleDetalhe}
          onToggleBase={toggleBase}
        />
      )}
    </div>
  );
}
