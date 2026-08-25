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
  MoveHorizontal,
  Search,
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
import { Papeis } from '@/components/dashboard/ranking-table';
import { FuncoesBadges } from '@/components/dashboard/funcoes-table';
import { cn, nomeProprio, numero } from '@/lib/utils';
import type { LinhaRanking, LinhaTeletrabalho, ServidorFuncoes } from '@/lib/dashboard-data';

const LINHAS_POR_PAGINA = 25;

type CampoOrdenavel = 'nome' | 'dias' | 'lotacao' | 'situacao';
type DirecaoOrdenacao = 'asc' | 'desc';

interface Ordenacao {
  campo: CampoOrdenavel;
  direcao: DirecaoOrdenacao;
}

const DIRECAO_INICIAL: Record<CampoOrdenavel, DirecaoOrdenacao> = {
  nome: 'asc',
  dias: 'desc',
  lotacao: 'asc',
  situacao: 'desc',
};

/** Caminho da lotação do maior nível para o menor (secretaria → coordenadoria → seção) — inverso de `unidadeNiveis` (que vem da fonte do menor para o maior) — para ordenar/agrupar por secretaria primeiro. */
function caminhoLotacao(niveis: string[] | null): string {
  if (!niveis || niveis.length === 0) return '';
  return [...niveis].reverse().join(' › ');
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

export function TeletrabalhoTable({
  ranking,
  funcaoDe,
  lotacaoDe,
  vigenteDe,
  responsaveisRanking,
  onVerDetalhe,
  onVerContratos,
}: {
  ranking: LinhaTeletrabalho[];
  funcaoDe: (linha: LinhaTeletrabalho) => ServidorFuncoes | undefined;
  /** Níveis da lotação do período mais recente, do menor (seção) para o maior (secretaria/gabinete/assessoria). */
  lotacaoDe: (linha: LinhaTeletrabalho) => string[] | null;
  /** true = tem período em aberto hoje (vigente). */
  vigenteDe: (linha: LinhaTeletrabalho) => boolean;
  responsaveisRanking: LinhaRanking[];
  onVerDetalhe: (linha: LinhaTeletrabalho) => void;
  onVerContratos: (linha: LinhaRanking) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [buscaLotacao, setBuscaLotacao] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);

  // A posição (#) é sempre a do ranking original por dias consolidados,
  // para que filtro e reordenação não escondam o rank real de ninguém
  // (mesmo padrão de ranking-table.tsx).
  const linhasVisiveis = useMemo(() => {
    const comPosicao = ranking.map((linha, i) => ({ linha, posicao: i + 1 }));
    const termoNome = normalizar(busca.trim());
    const termoLotacao = normalizar(buscaLotacao.trim());
    const filtradas = comPosicao.filter(({ linha }) => {
      if (termoNome && !normalizar(linha.nome).includes(termoNome)) return false;
      if (termoLotacao && !normalizar(caminhoLotacao(lotacaoDe(linha))).includes(termoLotacao)) return false;
      return true;
    });
    if (!ordenacao) return filtradas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'nome':
          return fator * a.linha.nome.localeCompare(b.linha.nome, 'pt-BR');
        case 'dias':
          return fator * (a.linha.diasConsolidados - b.linha.diasConsolidados);
        case 'lotacao':
          return (
            fator *
            caminhoLotacao(lotacaoDe(a.linha)).localeCompare(caminhoLotacao(lotacaoDe(b.linha)), 'pt-BR')
          );
        case 'situacao':
          return fator * (Number(vigenteDe(a.linha)) - Number(vigenteDe(b.linha)));
      }
    });
  }, [ranking, busca, buscaLotacao, ordenacao, lotacaoDe, vigenteDe]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

  function ordenarPor(campo: CampoOrdenavel) {
    setPagina(0);
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: DIRECAO_INICIAL[campo] };
      if (atual.direcao === DIRECAO_INICIAL[campo]) {
        return { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
      }
      return null;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ranking completo</CardTitle>
        <CardDescription>
          Todos os {numero(ranking.length)} servidores com ao menos um período de teletrabalho registrado.
          Clique em um servidor para ver os períodos e a lotação de cada um.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3">
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
              placeholder="Filtrar por servidor…"
              aria-label="Filtrar por servidor"
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
                aria-label="Limpar filtro de servidor"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={buscaLotacao}
              onChange={(e) => {
                setBuscaLotacao(e.target.value);
                setPagina(0);
              }}
              placeholder="Filtrar por lotação…"
              aria-label="Filtrar por lotação"
              className={cn(
                'h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm text-foreground',
                'placeholder:text-muted-foreground outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring',
                '[&::-webkit-search-cancel-button]:hidden',
              )}
            />
            {buscaLotacao && (
              <button
                type="button"
                onClick={() => {
                  setBuscaLotacao('');
                  setPagina(0);
                }}
                aria-label="Limpar filtro de lotação"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>
                <CabecalhoOrdenavel rotulo="Servidor" campo="nome" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
              <TableHead>
                <CabecalhoOrdenavel rotulo="Situação" campo="situacao" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Fiscal</TableHead>
              <TableHead>
                <CabecalhoOrdenavel rotulo="Lotação" campo="lotacao" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
              <TableHead className="text-right">
                <CabecalhoOrdenavel rotulo="Dias em teletrabalho" campo="dias" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum servidor encontrado{busca ? ` para "${busca}"` : ''}
                  {buscaLotacao ? ` na lotação "${buscaLotacao}"` : ''}
                </TableCell>
              </TableRow>
            ) : (
              linhas.map(({ linha, posicao }) => {
                const linhaResponsavel =
                  linha.responsavelRankingIndex !== null
                    ? responsaveisRanking[linha.responsavelRankingIndex]
                    : null;
                const servidor = funcaoDe(linha);
                const caminho = caminhoLotacao(lotacaoDe(linha));
                const vigente = vigenteDe(linha);
                return (
                  <TableRow key={linha.nome} onClick={() => onVerDetalhe(linha)} className="cursor-pointer">
                    <TableCell className="text-right text-muted-foreground tabular-nums">{posicao}</TableCell>
                    <TableCell className="font-medium">{nomeProprio(linha.nome)}</TableCell>
                    <TableCell>
                      {vigente ? (
                        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
                          Vigente
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Finalizado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {servidor ? (
                        <FuncoesBadges servidor={servidor} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {linhaResponsavel ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Papeis papeis={linhaResponsavel.papeis} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onVerContratos(linhaResponsavel);
                            }}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            ver contratos →
                          </button>
                        </span>
                      ) : (
                        <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                          Não-Fiscal
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {caminho ? (
                        <span className="block truncate text-xs text-muted-foreground" title={caminho}>
                          {caminho}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {numero(linha.diasConsolidados)}
                    </TableCell>
                  </TableRow>
                );
              })
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
            {(busca.trim() || buscaLotacao.trim()) && linhasVisiveis.length !== ranking.length && (
              <> (filtrados de {numero(ranking.length)})</>
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
  );
}
