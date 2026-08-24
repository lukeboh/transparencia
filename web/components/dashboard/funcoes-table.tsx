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
  History,
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
import { cn, nomeProprio, numero } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

const LINHAS_POR_PAGINA = 25;

type CampoOrdenavel = 'nome' | 'funcoes';
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

/** A função vigente, se houver; senão a mais recente encerrada. */
function funcaoDestaque(servidor: ServidorFuncoes) {
  const ordenados = [...servidor.mandatos].sort((a, b) =>
    (b.nomeacaoData ?? '').localeCompare(a.nomeacaoData ?? ''),
  );
  return ordenados.find((m) => m.vigente) ?? ordenados[0] ?? null;
}

function FuncoesBadges({ servidor }: { servidor: ServidorFuncoes }) {
  const destaque = funcaoDestaque(servidor);
  const restantes = servidor.mandatos.length - (destaque ? 1 : 0);
  if (!destaque) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span
        className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary"
        title={destaque.cargoTitulo}
      >
        {destaque.tipo}-{destaque.nivel}
      </span>
      {destaque.vigente && (
        <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
          vigente
        </span>
      )}
      {restantes > 0 && <span className="text-xs text-muted-foreground">+{restantes}</span>}
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

export function FuncoesTable({
  servidores,
  onVerHistorico,
  onVerContratos,
}: {
  servidores: ServidorFuncoes[];
  onVerHistorico: (servidor: ServidorFuncoes) => void;
  onVerContratos: (servidor: ServidorFuncoes) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [somenteZeroFiscal, setSomenteZeroFiscal] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);

  const linhasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    let filtradas = servidores;
    if (termo) filtradas = filtradas.filter((s) => normalizar(s.nome).includes(termo));
    if (somenteZeroFiscal) filtradas = filtradas.filter((s) => s.zeroFiscal);
    if (!ordenacao) return filtradas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (ordenacao.campo === 'nome') return fator * a.nome.localeCompare(b.nome, 'pt-BR');
      return fator * (a.mandatos.length - b.mandatos.length);
    });
  }, [servidores, busca, somenteZeroFiscal, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

  function ordenarPor(campo: CampoOrdenavel) {
    setPagina(0);
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: campo === 'nome' ? 'asc' : 'desc' };
      if (atual.direcao === (campo === 'nome' ? 'asc' : 'desc')) {
        return { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
      }
      return null;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Servidores com função comissionada</CardTitle>
        <CardDescription>
          Todo servidor do TSE que já ocupou FC-1 a FC-6 ou CJ-1 a CJ-4, fiscalizando contrato ou não.
          Clique em um servidor para ver o histórico completo de nomeações e exonerações.
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
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={somenteZeroFiscal}
              onChange={(e) => {
                setSomenteZeroFiscal(e.target.checked);
                setPagina(0);
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Somente &ldquo;Zero Fiscal&rdquo;
          </label>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <CabecalhoOrdenavel rotulo="Servidor" campo="nome" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
              <TableHead>
                <CabecalhoOrdenavel rotulo="Função" campo="funcoes" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
              <TableHead>Contratos fiscalizados</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhum servidor encontrado{busca ? ` para “${busca}”` : ''}
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((servidor) => (
                <TableRow
                  key={servidor.nome}
                  onClick={() => onVerHistorico(servidor)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{nomeProprio(servidor.nome)}</TableCell>
                  <TableCell>
                    <FuncoesBadges servidor={servidor} />
                  </TableCell>
                  <TableCell>
                    {servidor.zeroFiscal ? (
                      <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                        Zero Fiscal
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerContratos(servidor);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        ver contratos →
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <History className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {linhasVisiveis.length === 0
              ? `0 de ${numero(servidores.length)}`
              : `Exibindo ${numero(inicio + 1)}–${numero(inicio + linhas.length)} de ${numero(linhasVisiveis.length)}`}
            {(busca.trim() || somenteZeroFiscal) && linhasVisiveis.length !== servidores.length && (
              <> (filtrados de {numero(servidores.length)})</>
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
