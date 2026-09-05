'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Info,
  ListTree,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CampoCard,
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
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { OrdenacaoMobile } from '@/components/dashboard/ordenacao-mobile';
import { UnidadeDetalheDialog } from '@/components/dashboard/unidade-detalhe-dialog';
import { PillToggle } from '@/components/ui/pill-toggle';
import { InfoDica } from '@/components/ui/info-dica';
import { cn, numero } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { LinhaUnidade } from '@/lib/unidades-flat';
import { CATEGORIAS_UNIDADE, IDS_CATEGORIA, type CategoriaUnidade } from '@/lib/unidades-categoria';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { csv, excluidos, inteiro, ordem } from '@/lib/url-filtros';
import { chaveHierarquicaLotacao, compararHierarquico } from '@/lib/lotacao-hierarquia';
import {
  GRUPOS_RELACOES,
  RELACOES,
  RELACOES_PADRAO,
  RELACOES_POR_ID,
  formatarValorRelacao,
  type Relacao,
} from '@/lib/indicadores-unidades';

const LINHAS_POR_PAGINA = 50;
const LS_COLUNAS = 'indicadores-colunas';
/** "Nível" é opcional como as relações, mas não faz parte do catálogo de
 *  RELACOES — id sintético tratado à parte no menu de Colunas. */
const COLUNA_NIVEL_ID = 'nivel';
const COLUNAS_PADRAO = [COLUNA_NIVEL_ID, ...RELACOES_PADRAO];
const colunaValida = (id: string) => id === COLUNA_NIVEL_ID || RELACOES_POR_ID.has(id);

type ChaveOrd = 'unidade' | 'nivel' | (string & {});
interface Ordenacao {
  chave: ChaveOrd;
  dir: 'asc' | 'desc';
}
interface LinhaValores {
  linha: LinhaUnidade;
  valores: Map<string, number | null>;
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** true se `termo` é prefixo de alguma palavra de `texto` — evita falso
 *  positivo de substring no meio da palavra (ex.: buscar "STI" batendo em
 *  "JUSTIÇA" ou "LOGÍSTICA", que contêm "sti" soltos no meio). */
function contemPalavraComecandoCom(texto: string, termo: string): boolean {
  if (!termo) return true;
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .some((palavra) => palavra.startsWith(termo));
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

function IconeOrd({ ativo, dir }: { ativo: boolean; dir: 'asc' | 'desc' }) {
  const Icone = !ativo ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return <Icone className={cn('h-3.5 w-3.5 shrink-0', !ativo && 'opacity-50')} aria-hidden />;
}

/** Texto (+ barra de progresso para relações percentuais) de uma relação —
 *  compartilhado entre a célula da tabela (desktop) e a linha de card
 *  (mobile). Para relações 'contagem' (Qtd.), só o número com sufixo, sem
 *  barra (a escala não é 0–100). "—" quando não há denominador. */
function conteudoValorRelacao(valor: number | null, relacao: Relacao): React.ReactNode {
  if (valor === null) return <span className="text-muted-foreground">—</span>;
  if (relacao.formato === 'contagem') return formatarValorRelacao(valor, relacao);
  const largura = Math.max(0, Math.min(100, valor));
  return (
    <span className="relative inline-block min-w-[4.5rem]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0 rounded-sm bg-primary/15"
        style={{ width: `calc(100% * ${largura / 100})` }}
      />
      <span className="relative">{formatarValorRelacao(valor, relacao)}</span>
    </span>
  );
}

/** Célula de valor. Para relações percentuais, uma barra de dados cresce da
 *  esquerda e trava em 100% (valores maiores acontecem em "fiscais" — pessoa
 *  com vários papéis). */
function CelulaPct({ valor, relacao }: { valor: number | null; relacao: Relacao }) {
  if (valor === null) {
    return <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>;
  }
  if (relacao.formato === 'contagem') {
    return (
      <TableCell className="text-right tabular-nums">
        {formatarValorRelacao(valor, relacao)}
      </TableCell>
    );
  }
  const largura = Math.max(0, Math.min(100, valor));
  return (
    <TableCell className="relative text-right tabular-nums">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-sm bg-primary/15"
        style={{ width: `calc((100% - 0.5rem) * ${largura / 100})` }}
      />
      <span className="relative">{formatarValorRelacao(valor, relacao)}</span>
    </TableCell>
  );
}

function MenuColunas({
  visiveis,
  onToggle,
}: {
  visiveis: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('pointerdown', fechar);
    return () => document.removeEventListener('pointerdown', fechar);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Columns3 className="h-4 w-4" aria-hidden />
        Colunas ({visiveis.size})
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          <div className="py-1">
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Estrutura
            </p>
            <label
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              title="Profundidade do nó na árvore de unidades — 0 é a raiz (TSE)"
            >
              <input
                type="checkbox"
                checked={visiveis.has(COLUNA_NIVEL_ID)}
                onChange={() => onToggle(COLUNA_NIVEL_ID)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span>Nível</span>
            </label>
          </div>
          {GRUPOS_RELACOES.map((g) => (
            <div key={g.base} className="py-1">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.grupo}
              </p>
              {g.relacoes.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  title={r.descricao}
                >
                  <input
                    type="checkbox"
                    checked={visiveis.has(r.id)}
                    onChange={() => onToggle(r.id)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span>{r.rotuloVariante}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function IndicadoresTable({
  linhas,
  tseServidores,
  categoriaPorId,
}: {
  linhas: LinhaUnidade[];
  tseServidores: number;
  /** id da unidade → categoria (mesma heurística de /unidades, ver lib/unidades-categoria.ts). */
  categoriaPorId: Map<string, CategoriaUnidade>;
}) {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() => new Set(COLUNAS_PADRAO));
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [carregou, setCarregou] = useState(false);
  // Primeiro nível de detalhamento da unidade — modal interno (id da linha).
  const [detalheId, setDetalheId] = useState<string | null>(null);
  // Filtro de tipo de unidade — mesmas categorias de /unidades, todas ligadas
  // por padrão. Aqui a tabela é plana, então é só esconder/mostrar linhas.
  const [categoriasAtivas, setCategoriasAtivas] = useState<Set<CategoriaUnidade>>(
    () => new Set(CATEGORIAS_UNIDADE.map((c) => c.id)),
  );

  function toggleCategoria(id: CategoriaUnidade) {
    setPagina(0);
    setCategoriasAtivas((atual) => {
      const prox = new Set(atual);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  }

  const todasCategoriasAtivas = categoriasAtivas.size === CATEGORIAS_UNIDADE.length;

  function mostrarTodasCategorias() {
    setPagina(0);
    setCategoriasAtivas(new Set(CATEGORIAS_UNIDADE.map((c) => c.id)));
  }

  // Seleção de colunas persistida por navegador (mesmo padrão do theme-picker).
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(LS_COLUNAS);
      if (bruto) {
        const ids = (JSON.parse(bruto) as string[]).filter(colunaValida);
        if (ids.length > 0) setColunasVisiveis(new Set(ids));
      }
    } catch {
      // sem localStorage a seleção só não persiste entre visitas
    }
    setCarregou(true);
  }, []);
  useEffect(() => {
    if (!carregou) return;
    try {
      localStorage.setItem(LS_COLUNAS, JSON.stringify([...colunasVisiveis]));
    } catch {
      // idem
    }
  }, [colunasVisiveis, carregou]);

  const toggleColuna = (id: string) =>
    setColunasVisiveis((atual) => {
      const prox = new Set(atual);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });

  const colunasNoPadrao =
    colunasVisiveis.size === COLUNAS_PADRAO.length &&
    COLUNAS_PADRAO.every((id) => colunasVisiveis.has(id));

  // Filtros compartilháveis pela URL (busca, tipos, colunas, ordenação, página).
  useSincronizarUrl(
    {
      q: busca || undefined,
      tipos_off: excluidos.escrever(IDS_CATEGORIA, [...categoriasAtivas]),
      cols: colunasNoPadrao ? undefined : csv.escrever([...colunasVisiveis]),
      ord: ordem.escrever(ordenacao?.chave, ordenacao?.dir),
      pg: inteiro.escrever(pagina, 0),
    },
    (sp) => {
      const q = sp.get('q');
      if (q) setBusca(q);

      const off = sp.get('tipos_off');
      if (off !== null) {
        setCategoriasAtivas(new Set(excluidos.ler(IDS_CATEGORIA, off) as CategoriaUnidade[]));
      }

      const cols = csv.ler(sp.get('cols'));
      if (cols) {
        const validas = cols.filter(colunaValida);
        if (validas.length > 0) setColunasVisiveis(new Set(validas));
      }

      const o = ordem.ler(sp.get('ord'));
      if (
        o &&
        (o.campo === 'unidade' ||
          o.campo === 'unidade_hier' ||
          o.campo === 'nivel' ||
          RELACOES_POR_ID.has(o.campo))
      ) {
        setOrdenacao({ chave: o.campo, dir: o.direcao });
      }

      const pg = inteiro.ler(sp.get('pg'), 0, 0);
      if (pg > 0) setPagina(pg);
    },
  );

  // Colunas na ordem do catálogo, não na ordem em que o usuário marcou.
  const colunas = useMemo<Relacao[]>(
    () => RELACOES.filter((r) => colunasVisiveis.has(r.id)),
    [colunasVisiveis],
  );

  // Todas as relações são calculadas uma vez por unidade (barato: ~18 × 265).
  const linhasComValores = useMemo<LinhaValores[]>(
    () =>
      linhas.map((linha) => ({
        linha,
        valores: new Map(RELACOES.map((r) => [r.id, r.calc(linha.node, tseServidores)])),
      })),
    [linhas, tseServidores],
  );

  const ordEfetiva: Ordenacao | null =
    ordenacao ?? (colunas[0] ? { chave: colunas[0].id, dir: 'desc' } : null);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    let arr = linhasComValores;
    if (termo) {
      arr = arr.filter(
        ({ linha }) =>
          normalizar(linha.sigla).includes(termo) ||
          contemPalavraComecandoCom(linha.nome, termo) ||
          contemPalavraComecandoCom(linha.caminho, termo),
      );
    }
    if (!todasCategoriasAtivas) {
      arr = arr.filter(({ linha }) => {
        const cat = categoriaPorId.get(linha.id) ?? 'ramo';
        return cat === 'tribunal' || categoriasAtivas.has(cat);
      });
    }
    if (!ordEfetiva) return arr;
    if (ordEfetiva.chave === 'unidade_hier') {
      // Hierárquica: agrupa por unidade-mãe (topo), depois subdivide — mesma
      // lógica de /servidores (ord=lotacao_hier). Sempre crescente.
      return [...arr].sort((a, b) =>
        compararHierarquico(
          chaveHierarquicaLotacao(a.linha.caminhoCurto),
          chaveHierarquicaLotacao(b.linha.caminhoCurto),
        ),
      );
    }
    const fator = ordEfetiva.dir === 'asc' ? 1 : -1;
    const valor = (x: LinhaValores): string | number | null => {
      if (ordEfetiva.chave === 'unidade') return x.linha.caminho;
      if (ordEfetiva.chave === 'nivel') return x.linha.nivel;
      return x.valores.get(ordEfetiva.chave) ?? null;
    };
    return [...arr].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        return fator * String(va).localeCompare(String(vb), 'pt-BR');
      }
      // Numérico — "—" (null) sempre por último, independente da direção.
      if (va === null || vb === null) return va === null ? 1 : vb === null ? -1 : 0;
      return fator * (va - vb);
    });
  }, [linhasComValores, busca, ordEfetiva, categoriaPorId, categoriasAtivas, todasCategoriasAtivas]);

  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const pageRows = visiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

  function ordenarPor(chave: ChaveOrd) {
    setPagina(0);
    const padrao: 'asc' | 'desc' = chave === 'unidade' ? 'asc' : 'desc';
    setOrdenacao((atual) => {
      if (atual?.chave !== chave) return { chave, dir: padrao };
      if (atual.dir === padrao) return { chave, dir: padrao === 'asc' ? 'desc' : 'asc' };
      return null;
    });
  }

  // Unidade tem 4 estados: alfabética ↑ → alfabética ↓ → hierárquica → nada
  // (mesmo padrão da coluna Lotação em /servidores).
  function ordenarUnidade() {
    setPagina(0);
    setOrdenacao((atual) => {
      const estado =
        atual?.chave === 'unidade' ? atual.dir : atual?.chave === 'unidade_hier' ? 'hier' : null;
      if (estado === null) return { chave: 'unidade', dir: 'asc' };
      if (estado === 'asc') return { chave: 'unidade', dir: 'desc' };
      if (estado === 'desc') return { chave: 'unidade_hier', dir: 'asc' };
      return null; // era hierárquica → limpa
    });
  }

  const nivelVisivel = colunasVisiveis.has(COLUNA_NIVEL_ID);

  // Opções do seletor de ordenação mobile — mesmas colunas do cabeçalho da
  // tabela desktop (fixas + as relações escolhidas no menu Colunas), como
  // pares chave:direção.
  const opcoesOrdenacaoMobile = useMemo<{ valor: string; rotulo: string }[]>(() => {
    const opcoes: { valor: string; rotulo: string }[] = [
      { valor: 'unidade:asc', rotulo: 'Unidade (A→Z)' },
      { valor: 'unidade:desc', rotulo: 'Unidade (Z→A)' },
      { valor: 'unidade_hier:asc', rotulo: 'Unidade (hierárquica)' },
    ];
    if (nivelVisivel) {
      opcoes.push(
        { valor: 'nivel:desc', rotulo: 'Nível (maior→menor)' },
        { valor: 'nivel:asc', rotulo: 'Nível (menor→maior)' },
      );
    }
    for (const r of colunas) {
      const rotulo = `${r.grupo} — ${r.rotuloVariante}`;
      opcoes.push(
        { valor: `${r.id}:desc`, rotulo: `${rotulo} (maior→menor)` },
        { valor: `${r.id}:asc`, rotulo: `${rotulo} (menor→maior)` },
      );
    }
    return opcoes;
  }, [colunas, nivelVisivel]);

  const valorOrdenacaoMobile = `${ordEfetiva?.chave ?? 'unidade'}:${ordEfetiva?.dir ?? 'asc'}`;
  function ordenarPorMobile(valor: string) {
    setPagina(0);
    const i = valor.lastIndexOf(':');
    const chave = valor.slice(0, i);
    const dir = valor.slice(i + 1) as 'asc' | 'desc';
    setOrdenacao({ chave, dir });
  }

  const colunasExport = useMemo<ColunaExport<LinhaValores>[]>(
    () => [
      { cabecalho: 'Caminho', valor: ({ linha }) => linha.caminho },
      { cabecalho: 'Sigla', valor: ({ linha }) => linha.sigla },
      { cabecalho: 'Unidade', valor: ({ linha }) => linha.nome },
      ...(nivelVisivel
        ? [{ cabecalho: 'Nível', valor: ({ linha }: LinhaValores) => linha.nivel }]
        : []),
      ...colunas.map(
        (r): ColunaExport<LinhaValores> => ({
          cabecalho: `${r.grupo} — ${r.rotuloVariante} (${r.formato === 'contagem' ? r.sufixo.trim() || 'nº' : '%'})`,
          valor: ({ valores }) => {
            const v = valores.get(r.id);
            return v === null || v === undefined ? '' : Number(v.toFixed(2));
          },
        }),
      ),
    ],
    [colunas, nivelVisivel],
  );

  const colSpan = 1 + (nivelVisivel ? 1 : 0) + colunas.length;

  const detalheLinha = detalheId ? linhas.find((l) => l.id === detalheId) ?? null : null;
  const detalheCaminho = detalheLinha ? detalheLinha.caminho.split(' / ').slice(0, -1) : [];
  const tseTerceirizados = linhas.find((l) => l.nivel === 0)?.node.consolidado.terceirizados ?? 0;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Indicadores por unidade</CardTitle>
        <CardDescription>
          Uma linha por unidade; cada coluna é uma relação escolhida no menu{' '}
          <strong>Colunas</strong> — <strong>Qtd.</strong> é o valor bruto (nesta unidade ou nesta unidade
          + subárvore) e <strong>%</strong> é esse mesmo valor sobre o total de servidores do TSE, com
          barra que trava em 100%. <strong>Horas extras</strong> soma horas <strong>estimadas</strong>{' '}
          (serviço extraordinário desde 2009; valor pago ÷ hora normal ÷ 1,5, Res. TSE 22.901/2008 —
          limite superior). Clique num cabeçalho para ordenar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
              placeholder="Filtrar por unidade…"
              aria-label="Filtrar por unidade"
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
                onClick={() => {
                  setBusca('');
                  setPagina(0);
                }}
                aria-label="Limpar filtro"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <MenuColunas visiveis={colunasVisiveis} onToggle={toggleColuna} />
          <BotaoExportar
            linhas={visiveis}
            colunas={colunasExport}
            nomeArquivo="indicadores"
            nomeAba="Indicadores"
            className="sm:ml-auto"
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Mostrar
            <InfoDica titulo="Como funcionam os filtros de tipo" alinhamento="esquerda">
              Ligam e desligam as linhas de cada tipo de unidade — a mesma classificação da
              tela /unidades. Aqui a tabela é plana, então cada tipo apenas some ou volta da
              lista; a contagem das colunas de cada unidade que continua visível não muda.
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

        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-card">
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={ordenarUnidade}
                    aria-pressed={ordEfetiva?.chave === 'unidade' || ordEfetiva?.chave === 'unidade_hier'}
                    aria-label="Ordenar por unidade — alfabética crescente, decrescente ou hierárquica"
                    title="Ordenar: alfabética ↑ → alfabética ↓ → hierárquica (agrupa por unidade-mãe) → sem ordenação"
                    className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Unidade
                    {ordEfetiva?.chave === 'unidade_hier' ? (
                      <ListTree className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <IconeOrd
                        ativo={ordEfetiva?.chave === 'unidade'}
                        dir={ordEfetiva?.chave === 'unidade' ? ordEfetiva.dir : 'asc'}
                      />
                    )}
                  </button>
                  <InfoDica titulo="O que a coluna Unidade mostra?" alinhamento="esquerda">
                    As até 3 unidades mais específicas da hierarquia oficial, da própria
                    unidade para a unidade-mãe — ex.: <em>SETOT / CSELE / STI</em> — parando
                    no nível de secretaria. Clicando no cabeçalho: ordenação alfabética (↑/↓)
                    e uma terceira, <strong>hierárquica</strong>, que agrupa por unidade-mãe
                    (STI, depois CSELE dentro de STI, etc.).
                  </InfoDica>
                </span>
              </TableHead>
              {nivelVisivel && (
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => ordenarPor('nivel')}
                    className="-mx-1.5 ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Nível
                    <IconeOrd
                      ativo={ordEfetiva?.chave === 'nivel'}
                      dir={ordEfetiva?.chave === 'nivel' ? ordEfetiva.dir : 'desc'}
                    />
                  </button>
                </TableHead>
              )}
              {colunas.map((r) => {
                const ativo = ordEfetiva?.chave === r.id;
                return (
                  <TableHead key={r.id} className="min-w-[7.5rem] text-right">
                    <button
                      type="button"
                      onClick={() => ordenarPor(r.id)}
                      title={r.descricao}
                      className="-mx-1.5 ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-right transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="flex flex-col items-end leading-tight">
                        <span className="text-foreground">{r.grupo}</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {r.rotuloVariante}
                        </span>
                      </span>
                      <IconeOrd ativo={ativo} dir={ativo ? ordEfetiva.dir : 'desc'} />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                  Nenhuma unidade encontrada{busca ? ` para "${busca}"` : ''}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map(({ linha, valores }) => (
                <TableRow key={linha.id}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <span className="flex flex-wrap items-center gap-1 font-medium">
                      {linha.unidadesCurto.length > 0 ? (
                        linha.unidadesCurto.map((u, i) => (
                          <span key={u.sigla + i} className="flex items-center gap-1">
                            {i > 0 && <span aria-hidden className="text-muted-foreground">/</span>}
                            <span
                              title={u.nome}
                              className="underline decoration-dotted decoration-border underline-offset-2"
                            >
                              {u.sigla}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span title={linha.nome}>{linha.sigla}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetalheId(linha.id)}
                        aria-label={`Ver detalhes de ${linha.sigla}`}
                        title={`Ver detalhes de ${linha.sigla}`}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  </TableCell>
                  {nivelVisivel && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {linha.nivel}
                    </TableCell>
                  )}
                  {colunas.map((r) => (
                    <CelulaPct key={r.id} valor={valores.get(r.id) ?? null} relacao={r} />
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        <div className="space-y-3 md:hidden">
          <OrdenacaoMobile
            opcoes={opcoesOrdenacaoMobile}
            valorAtual={valorOrdenacaoMobile}
            onMudar={ordenarPorMobile}
            className="mb-1"
          />
          {pageRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma unidade encontrada{busca ? ` para "${busca}"` : ''}
            </p>
          ) : (
            pageRows.map(({ linha, valores }) => (
              <Card key={linha.id} className="p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1 font-medium">
                    {linha.unidadesCurto.length > 0 ? (
                      linha.unidadesCurto.map((u, i) => (
                        <span key={u.sigla + i} className="flex items-center gap-1">
                          {i > 0 && <span aria-hidden className="text-muted-foreground">/</span>}
                          <span title={u.nome}>{u.sigla}</span>
                        </span>
                      ))
                    ) : (
                      <span title={linha.nome}>{linha.sigla}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetalheId(linha.id)}
                    aria-label={`Ver detalhes de ${linha.sigla}`}
                    title={`Ver detalhes de ${linha.sigla}`}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <dl className="divide-y divide-border/50">
                  {nivelVisivel && (
                    <CampoCard rotulo="Nível">
                      <span className="text-muted-foreground">{linha.nivel}</span>
                    </CampoCard>
                  )}
                  {colunas.map((r) => (
                    <CampoCard key={r.id} rotulo={`${r.grupo} — ${r.rotuloVariante}`}>
                      {conteudoValorRelacao(valores.get(r.id) ?? null, r)}
                    </CampoCard>
                  ))}
                </dl>
              </Card>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {visiveis.length === 0
              ? `0 de ${numero(linhas.length)}`
              : `Exibindo ${numero(inicio + 1)}–${numero(inicio + pageRows.length)} de ${numero(visiveis.length)}`}
            {busca.trim() && visiveis.length !== linhas.length && (
              <> (filtradas de {numero(linhas.length)})</>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <BotaoPagina onClick={() => setPagina(0)} disabled={paginaAtual === 0} aria-label="Primeira página">
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
      </CardContent>
    </Card>

    <UnidadeDetalheDialog
      node={detalheLinha?.node ?? null}
      caminho={detalheCaminho}
      totalServidoresTSE={tseServidores}
      totalTerceirizadosTSE={tseTerceirizados}
      open={detalheLinha !== null}
      onClose={() => setDetalheId(null)}
    />
    </>
  );
}
