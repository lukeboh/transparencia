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
  MoveHorizontal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
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
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { UnidadeDetalheDialog } from '@/components/dashboard/unidade-detalhe-dialog';
import { PillToggle } from '@/components/ui/pill-toggle';
import { InfoDica } from '@/components/ui/info-dica';
import { cn, numero } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { LinhaUnidade } from '@/lib/unidades-flat';
import { CATEGORIAS_UNIDADE, IDS_CATEGORIA, type CategoriaUnidade } from '@/lib/unidades-categoria';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { csv, excluidos, inteiro, ordem } from '@/lib/url-filtros';
import {
  GRUPOS_RELACOES,
  RELACOES,
  RELACOES_PADRAO,
  RELACOES_POR_ID,
  formatarPct,
  type Relacao,
} from '@/lib/indicadores-unidades';

const LINHAS_POR_PAGINA = 50;
const LS_COLUNAS = 'indicadores-colunas';

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

/** Célula percentual com barra de dados: cresce da esquerda, número por cima,
 *  trava em 100% (valores maiores acontecem em "fiscais" — pessoa com vários
 *  papéis). "—" quando não há denominador. */
function CelulaPct({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>;
  }
  const largura = Math.max(0, Math.min(100, valor));
  return (
    <TableCell className="relative text-right tabular-nums">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-sm bg-primary/15"
        style={{ width: `calc((100% - 0.5rem) * ${largura / 100})` }}
      />
      <span className="relative">{formatarPct(valor)}%</span>
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
          className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {GRUPOS_RELACOES.map((g) => (
            <div key={g.base} className="py-1">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.descricao}
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
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<string>>(() => new Set(RELACOES_PADRAO));
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
        const ids = (JSON.parse(bruto) as string[]).filter((id) => RELACOES_POR_ID.has(id));
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
    colunasVisiveis.size === RELACOES_PADRAO.length &&
    RELACOES_PADRAO.every((id) => colunasVisiveis.has(id));

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
        const validas = cols.filter((id) => RELACOES_POR_ID.has(id));
        if (validas.length > 0) setColunasVisiveis(new Set(validas));
      }

      const o = ordem.ler(sp.get('ord'));
      if (o && (o.campo === 'unidade' || o.campo === 'nivel' || RELACOES_POR_ID.has(o.campo))) {
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
          normalizar(linha.nome).includes(termo) ||
          normalizar(linha.caminho).includes(termo),
      );
    }
    if (!todasCategoriasAtivas) {
      arr = arr.filter(({ linha }) => {
        const cat = categoriaPorId.get(linha.id) ?? 'ramo';
        return cat === 'tribunal' || categoriasAtivas.has(cat);
      });
    }
    if (!ordEfetiva) return arr;
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

  const colunasExport = useMemo<ColunaExport<LinhaValores>[]>(
    () => [
      { cabecalho: 'Caminho', valor: ({ linha }) => linha.caminho },
      { cabecalho: 'Sigla', valor: ({ linha }) => linha.sigla },
      { cabecalho: 'Unidade', valor: ({ linha }) => linha.nome },
      { cabecalho: 'Nível', valor: ({ linha }) => linha.nivel },
      ...colunas.map(
        (r): ColunaExport<LinhaValores> => ({
          cabecalho: `${r.grupo} — ${r.rotuloVariante} (%)`,
          valor: ({ valores }) => {
            const v = valores.get(r.id);
            return v === null || v === undefined ? '' : Number(v.toFixed(2));
          },
        }),
      ),
    ],
    [colunas],
  );

  const colSpan = 2 + colunas.length;

  const detalheLinha = detalheId ? linhas.find((l) => l.id === detalheId) ?? null : null;
  const detalheCaminho = detalheLinha ? detalheLinha.caminho.split(' / ').slice(0, -1) : [];

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Indicadores por unidade</CardTitle>
        <CardDescription>
          Uma linha por unidade; cada coluna é uma relação percentual escolhida no menu{' '}
          <strong>Colunas</strong>. Clique num cabeçalho para ordenar. A barra na célula
          esboça o valor (trava visualmente em 100%).
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-card">
                <button
                  type="button"
                  onClick={() => ordenarPor('unidade')}
                  className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Unidade
                  <IconeOrd
                    ativo={ordEfetiva?.chave === 'unidade'}
                    dir={ordEfetiva?.chave === 'unidade' ? ordEfetiva.dir : 'asc'}
                  />
                </button>
              </TableHead>
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
                    <span className="flex items-center gap-1.5 font-medium" title={linha.caminho}>
                      {linha.sigla}
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
                    <span className="block max-w-[15rem] truncate text-xs text-muted-foreground">
                      {linha.nome}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {linha.nivel}
                  </TableCell>
                  {colunas.map((r) => (
                    <CelulaPct key={r.id} valor={valores.get(r.id) ?? null} />
                  ))}
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
      open={detalheLinha !== null}
      onClose={() => setDetalheId(null)}
    />
    </>
  );
}
