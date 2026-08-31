'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  MoveHorizontal,
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
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { ColapsarBotao, VigenteToggle } from '@/components/dashboard/card-controles';
import { cn, mesAnoCurto, numero } from '@/lib/utils';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { inteiro, ordem } from '@/lib/url-filtros';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { TerceirizadoPessoa } from '@/lib/dashboard-data';

const LINHAS_POR_PAGINA = 25;
const LISTA_LOTACOES_ID = 'terceirizados-lotacoes';
const CAMPOS_ORD = new Set(['nome', 'lotacao', 'inicio', 'fim']);

type CampoOrdenavel = 'nome' | 'lotacao' | 'inicio' | 'fim';
type DirecaoOrdenacao = 'asc' | 'desc';
interface Ordenacao {
  campo: CampoOrdenavel;
  direcao: DirecaoOrdenacao;
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function lotacaoTexto(p: TerceirizadoPessoa) {
  return p.lotacaoSiglas.length > 0 ? p.lotacaoSiglas.join(' › ') : '';
}

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
}: {
  rotulo: string;
  campo: CampoOrdenavel;
  ordenacao: Ordenacao | null;
  onOrdenar: (campo: CampoOrdenavel) => void;
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
      )}
    >
      {rotulo}
      <Icone className={cn('h-3.5 w-3.5', !ativo && 'opacity-50')} aria-hidden />
    </button>
  );
}

export function TerceirizadosTabela({
  pessoas,
  vigente,
  onVigenteChange,
  onVerContrato,
}: {
  /** Lista completa — o filtro Vigente (padrão ligado) recorta os ativos. */
  pessoas: TerceirizadoPessoa[];
  /** Controlado pela página (para o KPI "Terceirizados ativos" poder ligá-lo ao rolar até aqui). */
  vigente: boolean;
  onVigenteChange: (v: boolean) => void;
  onVerContrato: (pessoa: TerceirizadoPessoa) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroLotacao, setFiltroLotacao] = useState('');
  // null = ordem natural, que já vem alfabética por nome do agregador.
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [colapsado, setColapsado] = useState(false);

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
      const lot = sp.get('lot');
      if (lot) setFiltroLotacao(lot);
      const o = ordem.ler(sp.get('ord'));
      if (o && CAMPOS_ORD.has(o.campo)) {
        setOrdenacao({ campo: o.campo as CampoOrdenavel, direcao: o.direcao });
      }
      const pg = inteiro.ler(sp.get('pg'), 0, 0);
      if (pg > 0) setPagina(pg);
    },
  );

  // 1º recorte: Vigente (só quem ainda consta na competência mais recente).
  const base = useMemo(
    () => (vigente ? pessoas.filter((p) => p.ativo) : pessoas),
    [pessoas, vigente],
  );

  const opcoesLotacao = useMemo(
    () =>
      Array.from(new Set(base.map(lotacaoTexto).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [base],
  );

  const buscarLotacao = useCallback(
    (p: TerceirizadoPessoa) => `${lotacaoTexto(p)} ${p.lotacaoAlocacao}`,
    [],
  );

  const linhasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const termoLot = normalizar(filtroLotacao.trim());
    let filtradas = base;
    if (termo) filtradas = filtradas.filter((p) => normalizar(p.nome).includes(termo));
    if (termoLot) filtradas = filtradas.filter((p) => normalizar(buscarLotacao(p)).includes(termoLot));
    if (!ordenacao) return filtradas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (ordenacao.campo === 'nome') return fator * a.nome.localeCompare(b.nome, 'pt-BR');
      if (ordenacao.campo === 'lotacao') {
        const la = lotacaoTexto(a);
        const lb = lotacaoTexto(b);
        if (!la || !lb) return la ? -1 : lb ? 1 : 0; // sem lotação sempre ao fim
        return fator * la.localeCompare(lb, 'pt-BR');
      }
      if (ordenacao.campo === 'inicio') {
        return fator * (a.mesInicio ?? '').localeCompare(b.mesInicio ?? '');
      }
      // fim: sem data (ainda contratado) sempre ao fim
      const fa = a.mesFim ?? '';
      const fb = b.mesFim ?? '';
      if (!fa || !fb) return fa ? -1 : fb ? 1 : 0;
      return fator * fa.localeCompare(fb);
    });
  }, [base, busca, filtroLotacao, ordenacao, buscarLotacao]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);
  const temBusca = Boolean(busca.trim() || filtroLotacao.trim());

  const colunasExport = useMemo<ColunaExport<TerceirizadoPessoa>[]>(
    () => [
      { cabecalho: 'Nome', valor: (p) => p.nome },
      { cabecalho: 'Lotação', valor: (p) => lotacaoTexto(p) },
      { cabecalho: 'Lotação (Alocação do PDF)', valor: (p) => p.lotacaoAlocacao },
      { cabecalho: 'Contrato', valor: (p) => p.contrato },
      { cabecalho: 'Contrato vinculado', valor: (p) => p.contratoId != null },
      { cabecalho: 'Empresa', valor: (p) => p.empresa },
      { cabecalho: 'Posto/função', valor: (p) => p.posto },
      { cabecalho: 'Mês de início', valor: (p) => (p.mesInicio ? mesAnoCurto(p.mesInicio) : '') },
      { cabecalho: 'Mês de fim', valor: (p) => (p.mesFim ? mesAnoCurto(p.mesFim) : '') },
      { cabecalho: 'Situação', valor: (p) => (p.ativo ? 'Ativo' : 'Encerrado') },
      { cabecalho: 'Competências', valor: (p) => p.competencias },
    ],
    [],
  );

  function ordenarPor(campo: CampoOrdenavel) {
    setPagina(0);
    const padrao: DirecaoOrdenacao = 'asc';
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: padrao };
      if (atual.direcao === padrao) return { campo, direcao: 'desc' };
      return null;
    });
  }

  return (
    <Card id="tabela-terceirizados" className="scroll-mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Terceirizados</CardTitle>
            <CardDescription>
              Um profissional por linha, com a unidade de lotação (até 3 níveis), o contrato de cessão
              de mão de obra e o intervalo em que consta nos PDFs mensais do TSE.
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <VigenteToggle
              ligado={vigente}
              onChange={(v) => {
                onVigenteChange(v);
                setPagina(0);
              }}
              titulo="Vigente: só quem ainda consta na listagem mais recente. Desligue para incluir quem já saiu."
            />
            <BotaoExportar
              linhas={linhasVisiveis}
              colunas={colunasExport}
              nomeArquivo="terceirizados"
              nomeAba="Terceirizados"
            />
            <ColapsarBotao colapsado={colapsado} onToggle={() => setColapsado((c) => !c)} rotulo="a tabela" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {colapsado ? (
          <p className="text-sm text-muted-foreground">
            {numero(base.length)} {vigente ? 'terceirizados vigentes' : 'terceirizados no total'}
            {vigente && base.length !== pessoas.length && <> · {numero(pessoas.length)} no histórico</>}
            {' — '}
            <button
              type="button"
              onClick={() => setColapsado(false)}
              className="font-medium text-primary hover:underline"
            >
              expandir
            </button>
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <CampoFiltro
                valor={busca}
                aoMudar={(v) => {
                  setBusca(v);
                  setPagina(0);
                }}
                placeholder="Filtrar por nome…"
                rotulo="Filtrar por nome"
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
                icone={MapPin}
                listId={LISTA_LOTACOES_ID}
              />
              <datalist id={LISTA_LOTACOES_ID}>
                {opcoesLotacao.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <CabecalhoOrdenavel rotulo="Nome" campo="nome" ordenacao={ordenacao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead>
                    <CabecalhoOrdenavel rotulo="Lotação" campo="lotacao" ordenacao={ordenacao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>
                    <CabecalhoOrdenavel rotulo="Início" campo="inicio" ordenacao={ordenacao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead>
                    <CabecalhoOrdenavel rotulo="Fim" campo="fim" ordenacao={ordenacao} onOrdenar={ordenarPor} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum terceirizado encontrado{busca ? ` para “${busca}”` : ''}
                    </TableCell>
                  </TableRow>
                ) : (
                  linhas.map((p, i) => (
                    <TableRow key={`${p.nome}-${p.contrato}-${inicio + i}`}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>
                        {lotacaoTexto(p) ? (
                          <span className="text-xs text-muted-foreground" title={p.lotacaoAlocacao || undefined}>
                            {lotacaoTexto(p)}
                          </span>
                        ) : (
                          <span
                            className="text-xs text-amber-600 dark:text-amber-500"
                            title={p.lotacaoAlocacao ? `Alocação no PDF: ${p.lotacaoAlocacao}` : 'Sem alocação no PDF'}
                          >
                            não identificada
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onVerContrato(p)}
                          className="text-xs font-medium text-primary hover:underline"
                          title="Ver detalhes do contrato"
                        >
                          {p.contrato || '—'}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {p.mesInicio ? mesAnoCurto(p.mesInicio) : '—'}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {p.mesFim ? (
                          <span className="text-muted-foreground">{mesAnoCurto(p.mesFim)}</span>
                        ) : (
                          <span className="rounded-sm bg-secondary px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                            contratado
                          </span>
                        )}
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
                  ? `0 de ${numero(base.length)}`
                  : `Exibindo ${numero(inicio + 1)}–${numero(inicio + linhas.length)} de ${numero(linhasVisiveis.length)}`}
                {temBusca && linhasVisiveis.length !== base.length && (
                  <> (filtrados de {numero(base.length)})</>
                )}
                {vigente && base.length !== pessoas.length && (
                  <> · {numero(pessoas.length)} no histórico</>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
