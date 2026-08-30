'use client';

import { Dialog, DialogHeader } from '@/components/ui/dialog';
import { FiscalChips, FuncaoChips } from '@/components/dashboard/unidade-chips';
import { BotaoFonteExterna } from '@/components/dashboard/botao-fonte-externa';
import { numero, percentual } from '@/lib/utils';
import {
  urlTerceirizados,
  urlUnidadeDetalhe,
  type UnidadeMetricas,
  type UnidadeNode,
} from '@/lib/dashboard-data';

function contarSubarvore(no: UnidadeNode): number {
  return no.children.reduce((s, filho) => s + 1 + contarSubarvore(filho), 0);
}

function BlocoMetricas({
  titulo,
  legenda,
  metricas,
  totalServidoresTSE,
}: {
  titulo: string;
  legenda: string;
  metricas: UnidadeMetricas;
  totalServidoresTSE: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2">
        <div className="text-sm font-semibold">{titulo}</div>
        <div className="text-xs text-muted-foreground">{legenda}</div>
      </div>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Servidores vigentes</dt>
          <dd className="font-medium tabular-nums">
            {numero(metricas.servidores)} · {percentual(metricas.servidores, totalServidoresTSE)}% do TSE
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs text-muted-foreground">Funções comissionadas (FC/CJ)</dt>
          <dd>
            <FuncaoChips contagens={metricas.funcoes} modo="detalhado" denominador={totalServidoresTSE} />
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs text-muted-foreground">Fiscais e gestores de contrato</dt>
          <dd>
            <FiscalChips contagens={metricas.fiscais} modo="detalhado" denominador={totalServidoresTSE} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Em teletrabalho vigente</dt>
          <dd className="font-medium tabular-nums">
            {numero(metricas.teletrabalho)} · {percentual(metricas.teletrabalho, totalServidoresTSE)}% do TSE
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Terceirizados alocados</dt>
          <dd className="font-medium tabular-nums" title="Estimado do PDF mensal do TSE">
            {numero(metricas.terceirizados)} · {percentual(metricas.terceirizados, metricas.servidores)}% dos servidores
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Primeiro nível de detalhamento de uma unidade da árvore — modal interno, com
 * a comparação "só nesta unidade" × "com as subunidades" e um botão para a
 * página de origem no TSE. Substitui o link que antes ia direto para fora.
 */
export function UnidadeDetalheDialog({
  node,
  caminho,
  categoriaRotulo,
  totalServidoresTSE,
  open,
  onClose,
}: {
  node: UnidadeNode | null;
  /** Siglas dos ancestrais, da raiz até o pai (sem a própria unidade). */
  caminho: string[];
  categoriaRotulo?: string;
  totalServidoresTSE: number;
  open: boolean;
  onClose: () => void;
}) {
  if (!node) return null;

  const subunidadesDiretas = node.children.length;
  const subunidadesTotal = contarSubarvore(node);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader titulo={node.sigla} descricao={node.nome} onClose={onClose} />

      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {categoriaRotulo && (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
              {categoriaRotulo}
            </span>
          )}
          {caminho.length > 0 && (
            <span className="text-muted-foreground">
              {caminho.join(' / ')} <span aria-hidden>/</span>{' '}
              <span className="font-medium text-foreground">{node.sigla}</span>
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <BlocoMetricas
            titulo="Só nesta unidade"
            legenda="quem está lotado exatamente aqui"
            metricas={node.direto}
            totalServidoresTSE={totalServidoresTSE}
          />
          <BlocoMetricas
            titulo="Com as subunidades"
            legenda={
              subunidadesTotal > 0
                ? `esta unidade + ${numero(subunidadesTotal)} subunidade${subunidadesTotal === 1 ? '' : 's'}`
                : 'sem subunidades — igual à coluna ao lado'
            }
            metricas={node.consolidado}
            totalServidoresTSE={totalServidoresTSE}
          />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            Subunidades diretas: <span className="font-medium text-foreground tabular-nums">{numero(subunidadesDiretas)}</span>
          </span>
          <span>
            Subunidades no total: <span className="font-medium text-foreground tabular-nums">{numero(subunidadesTotal)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3 text-xs text-muted-foreground">
        Percentuais de servidores, funções, fiscais e teletrabalho são sobre o total de servidores do
        TSE; o de terceirizados é sobre os servidores da própria unidade (pode passar de 100%). Tudo
        vem de cruzamento por nome/sigla de unidade entre a estrutura oficial e as relações de agentes
        públicos, teletrabalho, fiscais de contrato e o PDF mensal de terceirizados — pequenas
        divergências de grafia entre as fontes podem deslocar alguns registros.
        <div className="flex flex-wrap gap-2">
          <BotaoFonteExterna
            href={urlUnidadeDetalhe(node.id)}
            titulo="Abre a página desta unidade no portal de transparência do TSE, em nova aba"
          >
            Fonte externa — unidade no portal do TSE
          </BotaoFonteExterna>
          <BotaoFonteExterna
            href={urlTerceirizados()}
            titulo="Abre a página dos PDFs mensais de profissionais terceirizados do TSE, em nova aba"
          >
            Fonte externa — terceirizados (PDF do TSE)
          </BotaoFonteExterna>
        </div>
      </div>
    </Dialog>
  );
}
