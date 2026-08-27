'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import {
  ContratosDialog,
  type ContratoAuditavel,
} from '@/components/dashboard/contratos-dialog';
import { FuncoesBadges } from '@/components/dashboard/funcoes-table';
import { brlCompleto, cn, nomeProprio, numero } from '@/lib/utils';
import { categoriasDeContratos, descricaoFaixa } from '@/lib/categorias-valor';
import type { ContratoResumo, LinhaRanking, ServidorFuncoes } from '@/lib/dashboard-data';

const LINHAS_POR_PAGINA = 25;
const MAX_PAPEIS_VISIVEIS = 2;

type CampoOrdenavel = 'nome' | 'contratos' | 'valor' | 'empenhado' | 'pago';
type DirecaoOrdenacao = 'asc' | 'desc';

interface Ordenacao {
  campo: CampoOrdenavel;
  direcao: DirecaoOrdenacao;
}

const DIRECAO_INICIAL: Record<CampoOrdenavel, DirecaoOrdenacao> = {
  nome: 'asc',
  contratos: 'desc',
  valor: 'desc',
  empenhado: 'desc',
  pago: 'desc',
};

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
          className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
        >
          {papel}
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
}: {
  ranking: LinhaRanking[];
  contratos: ContratoResumo[];
  /** Servidor (com função atual + histórico) por nome — mesma string de `linha.nome`, ver fiscais-dashboard.tsx. */
  funcoesPorNome: Map<string, ServidorFuncoes>;
}) {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);
  const [selecionado, setSelecionado] = useState<LinhaRanking | null>(null);

  // A posição (#) é sempre a do ranking original por valor consolidado,
  // para que filtro e reordenação não escondam o rank real de ninguém.
  const linhasVisiveis = useMemo(() => {
    const comPosicao = ranking.map((linha, i) => ({ linha, posicao: i + 1 }));
    const termo = normalizar(busca.trim());
    const filtradas = termo
      ? comPosicao.filter(({ linha }) => normalizar(linha.nome).includes(termo))
      : comPosicao;
    if (!ordenacao) return filtradas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (ordenacao.campo) {
        case 'nome':
          return fator * a.linha.nome.localeCompare(b.linha.nome, 'pt-BR');
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
  }, [ranking, busca, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ranking completo</CardTitle>
        <CardDescription>
          Todos os {numero(ranking.length)} responsáveis, com valores Globais, Empenhados (Emp.) e Pagos (Pg) — o
          valor de um contrato conta uma única vez por pessoa. A coluna Função mostra a função comissionada (FC/CJ)
          que o servidor tem hoje ou já teve (ver detalhe completo em{' '}
          <Link href="/funcoes" className="underline decoration-border underline-offset-4 hover:text-foreground">
            /funcoes
          </Link>
          ). A coluna Faixas mostra os símbolos das faixas de valor (ver filtro acima) presentes entre os
          contratos do servidor. Clique em um servidor para auditar seus contratos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-sm">
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
              aria-label="Limpar filtro"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>
                <CabecalhoOrdenavel
                  rotulo="Servidor"
                  campo="nome"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                />
              </TableHead>
              <TableHead>Papéis</TableHead>
              <TableHead>Função</TableHead>
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
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Nenhum servidor encontrado para &ldquo;{busca}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              linhas.map(({ linha, posicao }) => (
                <TableRow
                  key={posicao}
                  onClick={() => setSelecionado(linha)}
                  className="cursor-pointer"
                >
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {posicao}
                  </TableCell>
                  <TableCell className="font-medium">{nomeProprio(linha.nome)}</TableCell>
                  <TableCell>
                    <Papeis papeis={linha.papeis} />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const servidor = funcoesPorNome.get(linha.nome);
                      return servidor ? (
                        <FuncoesBadges servidor={servidor} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
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
            {busca.trim() && linhasVisiveis.length !== ranking.length && (
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
          <ContratosDialog
            titulo={nomeProprio(selecionado.nome)}
            contratos={contratosDoResponsavel(selecionado, contratos)}
            open
            onClose={() => setSelecionado(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
