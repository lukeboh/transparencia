'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
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
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { cn, nomeProprio, numero } from '@/lib/utils';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { inteiro, ordem } from '@/lib/url-filtros';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { ServidorFuncoes } from '@/lib/dashboard-data';
import { textoSiglas, type ResolvedorLotacao } from '@/lib/lotacao-hierarquia';

const CAMPOS_ORD_FUNCOES = new Set(['nome', 'funcoes', 'lotacao']);

const LINHAS_POR_PAGINA = 25;
const LISTA_LOTACOES_ID = 'funcoes-lotacoes';

type CampoOrdenavel = 'nome' | 'funcoes' | 'lotacao';
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

/**
 * Função vigente segundo a fonte primária (relação atual de agentes
 * públicos), quando houver; senão a mais recente do histórico de portarias
 * (fonte secundária) — cobre quem só consta no histórico.
 */
export function funcaoDestaque(servidor: ServidorFuncoes) {
  if (servidor.funcaoAtual) {
    return { ...servidor.funcaoAtual, vigente: true, exoneracaoInferida: false };
  }
  const ordenados = [...servidor.mandatos].sort((a, b) =>
    (b.nomeacaoData ?? '').localeCompare(a.nomeacaoData ?? ''),
  );
  return ordenados[0] ?? null;
}

/** Nível FC/CJ vigente hoje ("FC-3"), ou null quando o servidor não tem função
 *  vigente — nem na relação atual, nem "em aberto" nas portarias. */
function chaveFuncaoVigente(servidor: ServidorFuncoes): string | null {
  if (servidor.funcaoAtual) {
    return `${servidor.funcaoAtual.tipo}-${servidor.funcaoAtual.nivel}`;
  }
  const m = servidor.mandatos.find((x) => x.vigente);
  return m ? `${m.tipo}-${m.nivel}` : null;
}

/** Todas as funções FC/CJ que o servidor já ocupou, distintas por nível, da
 *  vigente (se houver) para a mais antiga. */
function funcoesOcupadas(servidor: ServidorFuncoes) {
  const vigente = chaveFuncaoVigente(servidor);
  const porChave = new Map<
    string,
    { tipo: string; nivel: number; cargoTitulo: string; recente: string }
  >();
  if (servidor.funcaoAtual) {
    const k = `${servidor.funcaoAtual.tipo}-${servidor.funcaoAtual.nivel}`;
    porChave.set(k, { ...servidor.funcaoAtual, recente: '￿' });
  }
  for (const m of servidor.mandatos) {
    const k = `${m.tipo}-${m.nivel}`;
    const recente = m.nomeacaoData ?? m.exoneracaoData ?? '';
    const atual = porChave.get(k);
    if (!atual || recente > atual.recente) {
      porChave.set(k, { tipo: m.tipo, nivel: m.nivel, cargoTitulo: m.cargoTitulo, recente });
    }
  }
  return [...porChave.entries()]
    .map(([chave, f]) => ({ chave, ...f, vigente: chave === vigente }))
    .sort((a, b) => {
      if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;
      return b.recente.localeCompare(a.recente);
    });
}

/** "FC-3 (vigente), FC-1, CJ-2" — para exportação. */
export function funcoesTexto(servidor: ServidorFuncoes): string {
  const itens = funcoesOcupadas(servidor);
  if (itens.length === 0) return '';
  return itens.map((f) => (f.vigente ? `${f.chave} (vigente)` : f.chave)).join(', ');
}

export function FuncoesBadges({
  servidor,
  todas = false,
}: {
  servidor: ServidorFuncoes;
  /** Mostra TODAS as funções já ocupadas (a vigente destacada, as anteriores
   *  apagadas) em vez de só a de destaque + "+N". */
  todas?: boolean;
}) {
  if (todas) {
    const itens = funcoesOcupadas(servidor);
    if (itens.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {itens.map((f) => (
          <span
            key={f.chave}
            title={
              f.vigente
                ? `${f.cargoTitulo} — função vigente hoje`
                : `${f.cargoTitulo} — função que o servidor já ocupou`
            }
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
              f.vigente
                ? 'border border-primary/40 bg-primary/15 text-primary'
                : 'bg-muted/40 text-muted-foreground/50',
            )}
          >
            {f.tipo}-{f.nivel}
          </span>
        ))}
      </span>
    );
  }

  const destaque = funcaoDestaque(servidor);
  const restantes = servidor.mandatos.length - (destaque?.vigente ? 0 : destaque ? 1 : 0);
  if (!destaque) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span
        className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary"
        title={
          destaque.exoneracaoInferida
            ? `${destaque.cargoTitulo} — encerrada: a relação atual mostra o servidor sem função (exoneração não localizada)`
            : destaque.cargoTitulo
        }
      >
        {destaque.tipo}-{destaque.nivel}
      </span>
      {destaque.vigente && (
        <span className="rounded-sm bg-secondary px-1 py-px text-[10px] uppercase tracking-wide text-secondary-foreground font-semibold">
          vigente
        </span>
      )}
      {destaque.exoneracaoInferida && (
        <span
          className="rounded-sm bg-muted px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground font-semibold"
          title="Sem função na relação atual — mandato encerrado sem portaria de exoneração localizada"
        >
          encerrada
        </span>
      )}
      {restantes > 0 && <span className="text-xs text-muted-foreground">+{restantes}</span>}
    </span>
  );
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

export function FuncoesTable({
  servidores,
  resolverLotacao,
  onVerHistorico,
  onVerContratos,
}: {
  servidores: ServidorFuncoes[];
  resolverLotacao: ResolvedorLotacao;
  onVerHistorico: (servidor: ServidorFuncoes) => void;
  onVerContratos: (servidor: ServidorFuncoes) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroLotacao, setFiltroLotacao] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null);

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
      if (o && CAMPOS_ORD_FUNCOES.has(o.campo)) {
        setOrdenacao({ campo: o.campo as CampoOrdenavel, direcao: o.direcao });
      }
      const pg = inteiro.ler(sp.get('pg'), 0, 0);
      if (pg > 0) setPagina(pg);
    },
  );

  // Caminho hierárquico ("menor / … / maior") por nome de lotação, resolvido
  // uma vez contra a árvore de unidades. Vazio quando o nome não resolve —
  // nesse caso caímos no nome plano da própria fonte.
  const lotacaoPorServidor = useMemo(() => {
    const cache = new Map<string, string>();
    for (const s of servidores) {
      const chave = s.lotacao ?? '';
      if (cache.has(chave)) continue;
      const unidades = resolverLotacao(s.lotacao);
      cache.set(chave, unidades.length > 0 ? textoSiglas(unidades) : (s.lotacao ?? ''));
    }
    return cache;
  }, [servidores, resolverLotacao]);

  const textoLotacao = useCallback(
    (servidor: ServidorFuncoes) => lotacaoPorServidor.get(servidor.lotacao ?? '') ?? '',
    [lotacaoPorServidor],
  );

  const opcoesLotacao = useMemo(
    () => Array.from(new Set([...lotacaoPorServidor.values()].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lotacaoPorServidor],
  );

  const linhasVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const termoLotacao = normalizar(filtroLotacao.trim());
    let filtradas = servidores;
    if (termo) filtradas = filtradas.filter((s) => normalizar(s.nome).includes(termo));
    if (termoLotacao)
      filtradas = filtradas.filter((s) => normalizar(textoLotacao(s)).includes(termoLotacao));
    if (!ordenacao) return filtradas;
    const fator = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (ordenacao.campo === 'nome') return fator * a.nome.localeCompare(b.nome, 'pt-BR');
      if (ordenacao.campo === 'lotacao') {
        // Sem lotação resolvida sempre ao fim, independente da direção.
        const la = textoLotacao(a);
        const lb = textoLotacao(b);
        if (!la || !lb) return la ? -1 : lb ? 1 : 0;
        return fator * la.localeCompare(lb, 'pt-BR');
      }
      return fator * (a.mandatos.length - b.mandatos.length);
    });
  }, [servidores, busca, filtroLotacao, ordenacao, textoLotacao]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

  // Exporta todos os servidores do filtro/ordenação atuais (não só a página).
  const colunasExport = useMemo<ColunaExport<ServidorFuncoes>[]>(
    () => [
      { cabecalho: 'Servidor', valor: (s) => nomeProprio(s.nome) },
      { cabecalho: 'Matrícula', valor: (s) => s.matricula ?? '' },
      { cabecalho: 'Cargo', valor: (s) => s.cargo ?? '' },
      {
        cabecalho: 'Função',
        valor: (s) => {
          const d = funcaoDestaque(s);
          return d ? `${d.tipo}-${d.nivel}` : '';
        },
      },
      {
        cabecalho: 'Função vigente',
        valor: (s) => {
          const d = funcaoDestaque(s);
          return d ? d.vigente : '';
        },
      },
      { cabecalho: 'Mandatos no histórico', valor: (s) => s.mandatos.length },
      { cabecalho: 'Lotação', valor: (s) => textoLotacao(s) },
      { cabecalho: 'Lotação (nome completo)', valor: (s) => s.lotacao ?? '' },
      {
        cabecalho: 'Atuação em contratos',
        valor: (s) => (s.zeroFiscal ? 'Não-Fiscal' : 'Fiscal/gestor'),
      },
      { cabecalho: 'Observações', valor: (s) => s.observacoes.join('; ') },
    ],
    [textoLotacao],
  );

  function ordenarPor(campo: CampoOrdenavel) {
    setPagina(0);
    // Campos de texto começam em "asc" (A→Z); "funcoes" (numérico) em "desc".
    const padrao: DirecaoOrdenacao = campo === 'funcoes' ? 'desc' : 'asc';
    setOrdenacao((atual) => {
      if (atual?.campo !== campo) return { campo, direcao: padrao };
      if (atual.direcao === padrao) {
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
            nomeArquivo="funcoes"
            nomeAba="Funções"
            className="sm:ml-auto"
          />
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
              <TableHead>
                <CabecalhoOrdenavel rotulo="Lotação" campo="lotacao" ordenacao={ordenacao} onOrdenar={ordenarPor} />
              </TableHead>
              <TableHead>Contratos fiscalizados</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      <span>{nomeProprio(servidor.nome)}</span>
                      {servidor.observacoes.length > 0 && (
                        <span title={servidor.observacoes.join(' ')}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <FuncoesBadges servidor={servidor} />
                  </TableCell>
                  <TableCell>
                    {textoLotacao(servidor) ? (
                      <span
                        className="text-xs text-muted-foreground"
                        title={servidor.lotacao ?? undefined}
                      >
                        {textoLotacao(servidor)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {servidor.zeroFiscal ? (
                      <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                        Não-Fiscal
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
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
          <MoveHorizontal className="h-3 w-3 shrink-0" aria-hidden />
          Deslize a tabela para o lado para ver mais colunas
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {linhasVisiveis.length === 0
              ? `0 de ${numero(servidores.length)}`
              : `Exibindo ${numero(inicio + 1)}–${numero(inicio + linhas.length)} de ${numero(linhasVisiveis.length)}`}
            {(busca.trim() || filtroLotacao.trim()) && linhasVisiveis.length !== servidores.length && (
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
