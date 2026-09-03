'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListTree,
  MoveHorizontal,
  Network,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type ContratoAuditavel } from '@/components/dashboard/contratos-dialog';
import { ServidorDetalheDialog } from '@/components/dashboard/servidor-detalhe-dialog';
import { FuncoesBadges, funcoesTexto } from '@/components/dashboard/funcoes-badges';
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { InfoDica } from '@/components/ui/info-dica';
import { brlCompleto, cn, nomeProprio, numero } from '@/lib/utils';
import { categoriasDeContratos, descricaoFaixa } from '@/lib/categorias-valor';
import { rotuloPerfil } from '@/lib/perfis-fiscalizacao';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { inteiro, ordem } from '@/lib/url-filtros';
import type { ColunaExport } from '@/lib/exportar-dados';
import type {
  ContratoResumo,
  LinhaHorasExtras,
  LinhaRanking,
  LinhaTeletrabalho,
  ServidorFuncoes,
} from '@/lib/dashboard-data';

const CAMPOS_ORD_RANKING = new Set([
  'nome',
  'funcoes',
  'lotacao',
  'lotacao_hier',
  'teletrabalho',
  'horas_extras',
  'contratos',
  'valor',
  'empenhado',
  'pago',
]);

const LINHAS_POR_PAGINA = 25;
const MAX_PAPEIS_VISIVEIS = 2;
const LISTA_LOTACOES_ID = 'ranking-lotacoes';

/** Campo de busca com botão de limpar e `datalist` opcional (padrão da tabela). */
function CampoFiltro({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  icone: Icone,
  listId,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
  rotulo: string;
  icone: LucideIcon;
  listId?: string;
}) {
  return (
    <div className="relative max-w-sm flex-1 min-w-[220px]">
      <Icone
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={valor}
        list={listId}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm text-foreground',
          'placeholder:text-muted-foreground outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {valor && (
        <button
          type="button"
          onClick={() => aoMudar('')}
          aria-label={`Limpar ${rotulo.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

type CampoOrdenavel =
  | 'nome'
  | 'funcoes'
  | 'lotacao'
  | 'lotacao_hier'
  | 'teletrabalho'
  | 'horas_extras'
  | 'contratos'
  | 'valor'
  | 'empenhado'
  | 'pago';
type DirecaoOrdenacao = 'asc' | 'desc';

/** Caminho de lotação como chave hierárquica (do topo para a folha), para
 *  ordenar agrupando por unidade-mãe: "SETOT / CSELE / STI" → ["STI","CSELE","SETOT"]. */
function chaveHierarquicaLotacao(siglas: string): string[] {
  return siglas ? siglas.split(' / ').reverse() : [];
}
/** Compara duas chaves hierárquicas nível a nível; a mais curta (unidade-mãe)
 *  vem primeiro. */
function compararHierarquico(a: string[], b: string[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const c = a[i].localeCompare(b[i], 'pt-BR');
    if (c) return c;
  }
  return 0;
}

interface Ordenacao {
  campo: CampoOrdenavel;
  direcao: DirecaoOrdenacao;
}

const DIRECAO_INICIAL: Record<CampoOrdenavel, DirecaoOrdenacao> = {
  nome: 'asc',
  funcoes: 'asc',
  lotacao: 'asc',
  lotacao_hier: 'asc',
  teletrabalho: 'desc',
  horas_extras: 'desc',
  contratos: 'desc',
  valor: 'desc',
  empenhado: 'desc',
  pago: 'desc',
};

/** Chave de ordenação por função vigente: "CJ04" / "FC03"; vazio = sem função
 *  vigente na relação atual (vai para o fim, independente da direção). */
function chaveFuncaoVigenteOrd(s: ServidorFuncoes | undefined): string {
  if (!s?.funcaoAtual) return '';
  return `${s.funcaoAtual.tipo}${String(s.funcaoAtual.nivel).padStart(2, '0')}`;
}

/** Busca sem acento e sem caixa: "jose" encontra "José". */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function Papeis({ papeis }: { papeis: string[] }) {
  const visiveis = papeis.slice(0, MAX_PAPEIS_VISIVEIS);
  const ocultos = papeis.length - visiveis.length;
  return (
    <span className="flex flex-wrap items-center gap-1" title={papeis.join(', ')}>
      {visiveis.map((papel) => (
        <span
          key={papel}
          title={papel}
          className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
        >
          {rotuloPerfil(papel)}
        </span>
      ))}
      {ocultos > 0 && (
        <span className="text-xs text-muted-foreground">+{ocultos}</span>
      )}
    </span>
  );
}

/** Símbolos das faixas de valor dos contratos que o responsável fiscaliza/gerencia — ver lib/categorias-valor.ts. */
function FaixasValor({ linha, contratos }: { linha: LinhaRanking; contratos: ContratoResumo[] }) {
  const categorias = categoriasDeContratos(linha.contratos, contratos);
  if (categorias.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {categorias.map((categoria) => (
        <span
          key={categoria.id}
          title={`${categoria.nome} — ${descricaoFaixa(categoria)}`}
          className="inline-flex h-5 items-center rounded-sm px-1.5 text-xs font-semibold"
          style={{
            backgroundColor: `color-mix(in oklch, ${categoria.cor} 20%, var(--card))`,
            color: categoria.cor,
          }}
        >
          {categoria.simbolo}
        </span>
      ))}
    </span>
  );
}

function BotaoPagina({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors',
        'hover:bg-accent disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

function CabecalhoOrdenavel({
  rotulo,
  campo,
  ordenacao,
  onOrdenar,
  className,
}: {
  rotulo: string;
  campo: CampoOrdenavel;
  ordenacao: Ordenacao | null;
  onOrdenar: (campo: CampoOrdenavel) => void;
  className?: string;
}) {
  const ativo = ordenacao?.campo === campo;
  const Icone = !ativo ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(campo)}
      aria-label={`Ordenar por ${rotulo}`}
      aria-pressed={ativo}
      className={cn(
        '-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground',
        ativo && 'text-foreground',
        className,
      )}
    >
      {rotulo}
      <Icone className={cn('h-3.5 w-3.5', !ativo && 'opacity-50')} aria-hidden />
    </button>
  );
}

export function contratosDoResponsavel(
  linha: LinhaRanking,
  contratos: ContratoResumo[],
): ContratoAuditavel[] {
  return linha.contratos
    .map(({ i, papeis, funcaoNoContrato }) => ({
      ...contratos[i],
      papeisNoContrato: papeis,
      funcaoNoContrato,
    }))
    .sort((a, b) => b.valorGlobal - a.valorGlobal);
}

export function RankingTable({
  ranking,
  contratos,
  funcoesPorNome,
  teletrabalhoPorNome,
  horasExtrasPorNome,
  lotacaoPorNome,
}: {
  ranking: LinhaRanking[];
  contratos: ContratoResumo[];
  /** Servidor (com função atual + histórico) por nome — mesma string de `linha.nome`, ver servidores-dashboard.tsx. */
  funcoesPorNome: Map<string, ServidorFuncoes>;
  /** Consolidado de teletrabalho por nome — mesma string de `linha.nome`. */
  teletrabalhoPorNome: Map<string, LinhaTeletrabalho>;
  /** Horas extras estimadas por nome — mesma string de `linha.nome`. */
  horasExtrasPorNome: Map<string, LinhaHorasExtras>;
  /** Lotação atual por nome — `siglas` = texto exibido ("SETOT / CSELE / STI",
   *  ou o nome plano quando não resolve); `unidades` = cada nível com sigla +
   *  nome por extenso (tooltip), vazio quando não resolveu na árvore. */
  lotacaoPorNome: Map<string, { siglas: string; unidades: { sigla: string; nome: string }[] }>;
}) {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroLotacao, setFiltroLotacao] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [selecionado, setSelecionado] = useState<LinhaRanking | null>(null);

  useSincronizarUrl(
    {
      q: busca || undefined,
      lot: filtroLotacao || undefined,
      ord: ordem.escrever(ordenacao?.campo, ordenacao?.direcao),
      pg: inteiro.escrever(pagina, 0),
    },
    (sp) => {
      const q = sp.get('q');
      if (q) setBusca(q);
      const l = sp.get('lot');
      if (l) setFiltroLotacao(l);
      const o = ordem.ler(sp.get('ord'));
      if (o && CAMPOS_ORD_RANKING.has(o.campo)) {
        setOrdenacao({ campo: o.campo as CampoOrdenavel, direcao: o.direcao });
      }
      const pg = inteiro.ler(sp.get('pg'), 0, 0);
      if (pg > 0) setPagina(pg);
    },
  );

  const lotacaoDe = (nome: string) =>
    lotacaoPorNome.get(nome) ?? { siglas: '', unidades: [] };
  const opcoesLotacao = useMemo(
    () =>
      Array.from(new Set([...lotacaoPorNome.values()].map((v) => v.siglas).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [lotacaoPorNome],
  );

  // Cada linha carrega DUAS numerações: `posicao` = rank no ranking base (por
  // valor consolidado), fixo; `ordem` = rank na ordenação ATUAL sobre o ranking
  // INTEIRO — numerado ANTES do filtro por nome/lotação, então ao filtrar cada
  // servidor continua mostrando sua posição no ranking completo. Clicar no "#"
  // limpa a ordenação de coluna e volta `ordem` a ser `posicao`.
  const linhasVisiveis = useMemo(() => {
    const comPosicao = ranking.map((linha, i) => ({ linha, posicao: i + 1 }));

    let ordenadas = comPosicao;
    if (ordenacao) {
      const fator = ordenacao.direcao === 'asc' ? 1 : -1;
      ordenadas = [...comPosicao].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'nome':
          return fator * a.linha.nome.localeCompare(b.linha.nome, 'pt-BR');
        case 'funcoes': {
          const ka = chaveFuncaoVigenteOrd(funcoesPorNome.get(a.linha.nome));
          const kb = chaveFuncaoVigenteOrd(funcoesPorNome.get(b.linha.nome));
          if (!ka || !kb) return ka ? -1 : kb ? 1 : 0; // sem função vigente sempre ao fim
          return fator * ka.localeCompare(kb, 'pt-BR');
        }
        case 'lotacao': {
          const la = lotacaoDe(a.linha.nome).siglas;
          const lb = lotacaoDe(b.linha.nome).siglas;
          if (!la || !lb) return la ? -1 : lb ? 1 : 0; // sem lotação resolvida sempre ao fim
          return fator * la.localeCompare(lb, 'pt-BR');
        }
        case 'lotacao_hier': {
          // Hierárquica: agrupa por unidade-mãe (topo), depois subdivide.
          // Sempre crescente; sem lotação resolvida vai ao fim.
          const la = lotacaoDe(a.linha.nome).siglas;
          const lb = lotacaoDe(b.linha.nome).siglas;
          if (!la || !lb) return la ? -1 : lb ? 1 : 0;
          return compararHierarquico(chaveHierarquicaLotacao(la), chaveHierarquicaLotacao(lb));
        }
        case 'teletrabalho':
          return (
            fator *
            ((teletrabalhoPorNome.get(a.linha.nome)?.diasConsolidados ?? 0) -
              (teletrabalhoPorNome.get(b.linha.nome)?.diasConsolidados ?? 0))
          );
        case 'horas_extras':
          return (
            fator *
            ((horasExtrasPorNome.get(a.linha.nome)?.horasConsolidadas ?? 0) -
              (horasExtrasPorNome.get(b.linha.nome)?.horasConsolidadas ?? 0))
          );
        case 'contratos':
          return fator * (a.linha.quantidadeContratos - b.linha.quantidadeContratos);
        case 'valor':
          return fator * (a.linha.valorConsolidado - b.linha.valorConsolidado);
        case 'empenhado':
          return fator * ((a.linha.valorEmpenhadoConsolidado || 0) - (b.linha.valorEmpenhadoConsolidado || 0));
        case 'pago':
          return fator * ((a.linha.valorPagoConsolidado || 0) - (b.linha.valorPagoConsolidado || 0));
      }
      });
    }

    const comOrdem = ordenadas.map((item, i) => ({ ...item, ordem: i + 1 }));

    // Filtro textual por servidor / lotação — depois de numerar, para não
    // renumerar o ranking ao filtrar.
    const termo = normalizar(busca.trim());
    const termoLot = normalizar(filtroLotacao.trim());
    return comOrdem.filter(({ linha }) => {
      if (termo && !normalizar(linha.nome).includes(termo)) return false;
      // Casa só o texto EXIBIDO da lotação (siglas resolvidas, ou o nome plano
      // quando não resolve) — não o nome completo, senão "STI" pegaria
      // "logíSTIca", "inveSTImento" etc. no nome por extenso.
      if (termoLot && !normalizar(lotacaoDe(linha.nome).siglas).includes(termoLot)) return false;
      return true;
    });
  }, [ranking, busca, filtroLotacao, lotacaoPorNome, funcoesPorNome, teletrabalhoPorNome, horasExtrasPorNome, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

  // Exporta o ranking inteiro no filtro/ordenação atuais (não só a página).
  const colunasExport = useMemo<ColunaExport<{ linha: LinhaRanking; posicao: number; ordem: number }>[]>(
    () => [
      { cabecalho: '#', valor: ({ ordem }) => ordem },
      { cabecalho: '# (ranking base)', valor: ({ posicao }) => posicao },
      { cabecalho: 'Servidor', valor: ({ linha }) => nomeProprio(linha.nome) },
      { cabecalho: 'Papéis', valor: ({ linha }) => linha.papeis.join(', ') },
      {
        cabecalho: 'Funções',
        valor: ({ linha }) => {
          const s = funcoesPorNome.get(linha.nome);
          return s ? funcoesTexto(s) : '';
        },
      },
      { cabecalho: 'Lotação', valor: ({ linha }) => lotacaoDe(linha.nome).siglas },
      {
        cabecalho: 'Lotação (nomes completos)',
        valor: ({ linha }) => {
          const { unidades, siglas } = lotacaoDe(linha.nome);
          return unidades.length ? unidades.map((u) => u.nome).join(' | ') : siglas;
        },
      },
      {
        cabecalho: 'Dias em teletrabalho',
        valor: ({ linha }) => teletrabalhoPorNome.get(linha.nome)?.diasConsolidados ?? 0,
      },
      {
        cabecalho: 'Horas extras estimadas',
        valor: ({ linha }) =>
          Math.round(horasExtrasPorNome.get(linha.nome)?.horasConsolidadas ?? 0),
      },
      {
        cabecalho: 'Faixas de valor',
        valor: ({ linha }) =>
          categoriasDeContratos(linha.contratos, contratos)
            .map((c) => c.nome)
            .join(', '),
      },
      { cabecalho: 'Contratos', valor: ({ linha }) => linha.quantidadeContratos },
      { cabecalho: 'Valor Global (R$)', valor: ({ linha }) => linha.valorConsolidado },
      { cabecalho: 'Empenhado (R$)', valor: ({ linha }) => linha.valorEmpenhadoConsolidado || 0 },
      { cabecalho: 'Pago (R$)', valor: ({ linha }) => linha.valorPagoConsolidado || 0 },
    ],
    [contratos, funcoesPorNome, lotacaoPorNome, teletrabalhoPorNome, horasExtrasPorNome],
  );

  function ordenarPor(campo: CampoOrdenavel) {
    setPagina(0);
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: DIRECAO_INICIAL[campo] };
      // Segundo clique inverte; terceiro volta à ordem do ranking.
      if (atual.direcao === DIRECAO_INICIAL[campo]) {
        return { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
      }
      return null;
    });
  }

  // Lotação tem 4 estados: alfabética ↑ → alfabética ↓ → hierárquica → nada.
  function ordenarLotacao() {
    setPagina(0);
    setOrdenacao((atual) => {
      const estado =
        atual?.campo === 'lotacao' ? atual.direcao : atual?.campo === 'lotacao_hier' ? 'hier' : null;
      if (estado === null) return { campo: 'lotacao', direcao: 'asc' };
      if (estado === 'asc') return { campo: 'lotacao', direcao: 'desc' };
      if (estado === 'desc') return { campo: 'lotacao_hier', direcao: 'asc' };
      return null; // era hierárquica → limpa
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Servidores (Agentes Públicos)</CardTitle>
        <CardDescription>
          Todos os {numero(ranking.length)} servidores no filtro, com valores Globais, Empenhados (Emp.) e Pagos
          (Pg) — o valor de um contrato conta uma única vez por pessoa; quem não é fiscal/gestor de nenhum
          contrato aparece zerado. A coluna <strong>Funções</strong> lista os níveis FC/CJ que o servidor já
          ocupou (a vigente destacada; histórico completo no modal <strong>Detalhes do Servidor</strong>);
          a <strong>Lotação</strong> traz as 3 unidades mais específicas da hierarquia oficial. A coluna{' '}
          <strong>Horas extras</strong> é o total <strong>estimado</strong> de serviço extraordinário desde
          2009 (a folha do TSE publica só o valor pago — a hora é inferida pela Resolução TSE 22.901/2008;
          limite superior). A coluna
          Faixas mostra os símbolos das faixas de valor presentes entre os contratos do servidor. Clique numa
          linha para abrir <strong>Detalhes do Servidor</strong> — histórico de funções, consolidado de
          teletrabalho, horas extras estimadas e histórico de contratos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <CampoFiltro
            valor={busca}
            aoMudar={(v) => {
              setBusca(v);
              setPagina(0);
            }}
            placeholder="Filtrar por servidor…"
            rotulo="Filtrar por servidor"
            icone={Search}
          />
          <CampoFiltro
            valor={filtroLotacao}
            aoMudar={(v) => {
              setFiltroLotacao(v);
              setPagina(0);
            }}
            placeholder="Filtrar por lotação…"
            rotulo="Filtrar por lotação"
            icone={Network}
            listId={LISTA_LOTACOES_ID}
          />
          <datalist id={LISTA_LOTACOES_ID}>
            {opcoesLotacao.map((opcao) => (
              <option key={opcao} value={opcao} />
            ))}
          </datalist>
          <BotaoExportar
            linhas={linhasVisiveis}
            colunas={colunasExport}
            nomeArquivo="servidores"
            nomeAba="Servidores"
            className="sm:ml-auto"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setPagina(0);
                    setOrdenacao(null);
                  }}
                  aria-pressed={ordenacao === null}
                  aria-label="Renumerar: voltar à ordenação padrão do ranking"
                  title="Clique para limpar a ordenação de coluna e renumerar o # pela ordem atual"
                  className={cn(
                    '-mx-1.5 inline-flex items-center rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground',
                    ordenacao === null && 'text-foreground',
                  )}
                >
                  #
                </button>
              </TableHead>
              <TableHead>
                <CabecalhoOrdenavel
                  rotulo="Servidor"
                  campo="nome"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                />
              </TableHead>
              <TableHead>Papéis</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  <CabecalhoOrdenavel
                    rotulo="Funções"
                    campo="funcoes"
                    ordenacao={ordenacao}
                    onOrdenar={ordenarPor}
                  />
                  <InfoDica titulo="O que a coluna Funções mostra?" alinhamento="esquerda">
                    Todas as funções comissionadas (FC/CJ) que o servidor já ocupou. A
                    vigente hoje aparece <strong>destacada</strong>; as anteriores ficam em
                    tom apagado. A ordenação é pela função <strong>vigente</strong> (quem não
                    tem vai para o fim).
                  </InfoDica>
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={ordenarLotacao}
                    aria-pressed={ordenacao?.campo === 'lotacao' || ordenacao?.campo === 'lotacao_hier'}
                    aria-label="Ordenar por lotação — alfabética crescente, decrescente ou hierárquica"
                    title="Ordenar: alfabética ↑ → alfabética ↓ → hierárquica (agrupa por unidade-mãe) → sem ordenação"
                    className={cn(
                      '-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground',
                      (ordenacao?.campo === 'lotacao' || ordenacao?.campo === 'lotacao_hier') &&
                        'text-foreground',
                    )}
                  >
                    Lotação
                    {ordenacao?.campo === 'lotacao_hier' ? (
                      <ListTree className="h-3.5 w-3.5" aria-hidden />
                    ) : ordenacao?.campo === 'lotacao' ? (
                      ordenacao.direcao === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
                    )}
                  </button>
                  <InfoDica titulo="O que a coluna Lotação mostra?" alinhamento="esquerda">
                    A lotação atual do servidor (relação de agentes públicos), como as 3
                    unidades mais específicas da hierarquia oficial de{' '}
                    <strong>/unidades</strong> — ex.: <em>SETOT / CSELE / STI</em> (cada
                    sigla tem o nome por extenso no tooltip). Sem resolução confiável,
                    mostra o nome plano da fonte. Clicando no cabeçalho: ordenação
                    alfabética (↑/↓) e uma terceira, <strong>hierárquica</strong>, que
                    agrupa por unidade-mãe (STI, depois CSELE dentro de STI, etc.).
                  </InfoDica>
                </span>
              </TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1">
                  <CabecalhoOrdenavel
                    rotulo="Teletrabalho"
                    campo="teletrabalho"
                    ordenacao={ordenacao}
                    onOrdenar={ordenarPor}
                  />
                  <InfoDica titulo="O que a coluna Teletrabalho mostra?" alinhamento="direita">
                    Total de dias em regime de teletrabalho, somando todos os períodos
                    registrados (sem merge de sobreposição). Detalhe dos períodos em{' '}
                    <strong>Detalhes do Servidor</strong>. &ldquo;—&rdquo; quando não há
                    registro.
                  </InfoDica>
                </span>
              </TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1">
                  <CabecalhoOrdenavel
                    rotulo="Horas extras"
                    campo="horas_extras"
                    ordenacao={ordenacao}
                    onOrdenar={ordenarPor}
                  />
                  <InfoDica titulo="O que a coluna Horas extras mostra?" alinhamento="direita">
                    Total de horas extras <strong>estimadas</strong> (serviço extraordinário)
                    desde 2009. A folha de pagamento do TSE publica só o <strong>valor em
                    R$</strong> pago — a quantidade de horas é inferida pela fórmula da{' '}
                    <strong>Resolução TSE nº 22.901/2008</strong> (valor ÷ hora normal ÷ 1,5).
                    É um <strong>limite superior</strong>. Método e quebra por ciclo em{' '}
                    <strong>Detalhes do Servidor</strong>. &ldquo;—&rdquo; quando não há
                    registro.
                  </InfoDica>
                </span>
              </TableHead>
              <TableHead>Faixas</TableHead>
              <TableHead className="text-right">
                <CabecalhoOrdenavel
                  rotulo="Contratos"
                  campo="contratos"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                />
              </TableHead>
              <TableHead className="text-right">
                <CabecalhoOrdenavel
                  rotulo="Valor Global"
                  campo="valor"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                />
              </TableHead>
              <TableHead className="text-right">
                <CabecalhoOrdenavel
                  rotulo="Empenhado"
                  campo="empenhado"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                />
              </TableHead>
              <TableHead className="text-right">
                <CabecalhoOrdenavel
                  rotulo="Pago"
                  campo="pago"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                  Nenhum servidor encontrado para{' '}
                  &ldquo;{[busca.trim(), filtroLotacao.trim()].filter(Boolean).join('” · “')}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              linhas.map(({ linha, posicao, ordem }) => (
                <TableRow
                  key={posicao}
                  onClick={() => setSelecionado(linha)}
                  className="cursor-pointer"
                >
                  <TableCell
                    className="text-right text-muted-foreground tabular-nums"
                    title={ordem !== posicao ? `Posição no ranking base (por valor): ${posicao}` : undefined}
                  >
                    {ordem}
                  </TableCell>
                  <TableCell className="font-medium">{nomeProprio(linha.nome)}</TableCell>
                  <TableCell>
                    <Papeis papeis={linha.papeis} />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const servidor = funcoesPorNome.get(linha.nome);
                      return servidor ? (
                        <FuncoesBadges servidor={servidor} todas />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const { siglas, unidades } = lotacaoDe(linha.nome);
                      if (!siglas) return <span className="text-muted-foreground">—</span>;
                      if (unidades.length === 0) {
                        // Não resolveu na árvore — nome plano da fonte, sem tooltip por nível.
                        return <span className="text-xs text-muted-foreground">{siglas}</span>;
                      }
                      return (
                        <span className="text-xs text-muted-foreground">
                          {unidades.map((u, i) => (
                            <span key={u.sigla + i}>
                              {i > 0 && <span aria-hidden> / </span>}
                              <span
                                title={u.nome}
                                className="underline decoration-dotted decoration-border underline-offset-2"
                              >
                                {u.sigla}
                              </span>
                            </span>
                          ))}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(() => {
                      const dias = teletrabalhoPorNome.get(linha.nome)?.diasConsolidados ?? 0;
                      return dias > 0 ? numero(dias) : <span className="text-muted-foreground">—</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(() => {
                      const he = horasExtrasPorNome.get(linha.nome);
                      if (!he || he.horasConsolidadas <= 0) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      return (
                        <span
                          title={`Estimativa (limite superior). Faixa provável: ${numero(
                            Math.round(he.horasConsolidadasMin),
                          )}–${numero(Math.round(he.horasConsolidadas))} h. ${
                            he.mesesComHE
                          } mês(es) com pagamento.`}
                        >
                          {numero(Math.round(he.horasConsolidadas))}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <FaixasValor linha={linha} contratos={contratos} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numero(linha.quantidadeContratos)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {brlCompleto(linha.valorConsolidado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {brlCompleto(linha.valorEmpenhadoConsolidado || 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {brlCompleto(linha.valorPagoConsolidado || 0)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
          <MoveHorizontal className="h-3 w-3 shrink-0" aria-hidden />
          Deslize a tabela para o lado para ver mais colunas
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {linhasVisiveis.length === 0
              ? `0 de ${numero(ranking.length)}`
              : `Exibindo ${numero(inicio + 1)}–${numero(inicio + linhas.length)} de ${numero(linhasVisiveis.length)}`}
            {(busca.trim() || filtroLotacao.trim()) && linhasVisiveis.length !== ranking.length && (
              <> (filtrados de {numero(ranking.length)})</>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <BotaoPagina
              onClick={() => setPagina(0)}
              disabled={paginaAtual === 0}
              aria-label="Primeira página"
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden />
            </BotaoPagina>
            <BotaoPagina
              onClick={() => setPagina(paginaAtual - 1)}
              disabled={paginaAtual === 0}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </BotaoPagina>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">
              {numero(paginaAtual + 1)} / {numero(totalPaginas)}
            </span>
            <BotaoPagina
              onClick={() => setPagina(paginaAtual + 1)}
              disabled={paginaAtual >= totalPaginas - 1}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </BotaoPagina>
            <BotaoPagina
              onClick={() => setPagina(totalPaginas - 1)}
              disabled={paginaAtual >= totalPaginas - 1}
              aria-label="Última página"
            >
              <ChevronsRight className="h-4 w-4" aria-hidden />
            </BotaoPagina>
          </div>
        </div>

        {selecionado && (
          <ServidorDetalheDialog
            linha={selecionado}
            servidorFuncoes={funcoesPorNome.get(selecionado.nome) ?? null}
            teletrabalho={teletrabalhoPorNome.get(selecionado.nome) ?? null}
            horasExtras={horasExtrasPorNome.get(selecionado.nome) ?? null}
            lotacao={lotacaoDe(selecionado.nome)}
            contratos={contratos}
            open
            onClose={() => setSelecionado(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
