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
import { FuncoesBadges, funcoesTexto } from '@/components/dashboard/funcoes-table';
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
  LinhaRanking,
  LinhaTeletrabalho,
  ServidorFuncoes,
} from '@/lib/dashboard-data';

const CAMPOS_ORD_RANKING = new Set(['nome', 'contratos', 'valor', 'empenhado', 'pago']);

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
  lotacaoPorNome,
}: {
  ranking: LinhaRanking[];
  contratos: ContratoResumo[];
  /** Servidor (com função atual + histórico) por nome — mesma string de `linha.nome`, ver servidores-dashboard.tsx. */
  funcoesPorNome: Map<string, ServidorFuncoes>;
  /** Consolidado de teletrabalho por nome — mesma string de `linha.nome`. */
  teletrabalhoPorNome: Map<string, LinhaTeletrabalho>;
  /** Lotação atual por nome — `curto` = até 3 siglas da hierarquia, `completo` = nome plano. */
  lotacaoPorNome: Map<string, { curto: string; completo: string }>;
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

  const lotacaoDe = (nome: string) => lotacaoPorNome.get(nome) ?? { curto: '', completo: '' };
  const opcoesLotacao = useMemo(
    () =>
      Array.from(new Set([...lotacaoPorNome.values()].map((v) => v.curto).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [lotacaoPorNome],
  );

  // A posição (#) é sempre a do ranking original por valor consolidado,
  // para que filtro e reordenação não escondam o rank real de ninguém.
  const linhasVisiveis = useMemo(() => {
    const comPosicao = ranking.map((linha, i) => ({ linha, posicao: i + 1 }));
    const termo = normalizar(busca.trim());
    const termoLot = normalizar(filtroLotacao.trim());
    const filtradas = comPosicao.filter(({ linha }) => {
      if (termo && !normalizar(linha.nome).includes(termo)) return false;
      if (termoLot) {
        const { curto, completo } = lotacaoDe(linha.nome);
        if (!normalizar(`${curto} ${completo}`).includes(termoLot)) return false;
      }
      return true;
    });
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
  }, [ranking, busca, filtroLotacao, lotacaoPorNome, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(linhasVisiveis.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * LINHAS_POR_PAGINA;
  const linhas = linhasVisiveis.slice(inicio, inicio + LINHAS_POR_PAGINA);

  // Exporta o ranking inteiro no filtro/ordenação atuais (não só a página).
  const colunasExport = useMemo<ColunaExport<{ linha: LinhaRanking; posicao: number }>[]>(
    () => [
      { cabecalho: '#', valor: ({ posicao }) => posicao },
      { cabecalho: 'Servidor', valor: ({ linha }) => nomeProprio(linha.nome) },
      { cabecalho: 'Papéis', valor: ({ linha }) => linha.papeis.join(', ') },
      {
        cabecalho: 'Funções',
        valor: ({ linha }) => {
          const s = funcoesPorNome.get(linha.nome);
          return s ? funcoesTexto(s) : '';
        },
      },
      { cabecalho: 'Lotação', valor: ({ linha }) => lotacaoDe(linha.nome).curto },
      { cabecalho: 'Lotação (nome completo)', valor: ({ linha }) => lotacaoDe(linha.nome).completo },
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
    [contratos, funcoesPorNome, lotacaoPorNome],
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Servidores (Agentes Públicos)</CardTitle>
        <CardDescription>
          Todos os {numero(ranking.length)} servidores no filtro, com valores Globais, Empenhados (Emp.) e Pagos
          (Pg) — o valor de um contrato conta uma única vez por pessoa; quem não é fiscal/gestor de nenhum
          contrato aparece zerado. A coluna <strong>Funções</strong> lista os níveis FC/CJ que o servidor já
          ocupou (a vigente destacada; ver detalhe em{' '}
          <Link href="/funcoes" className="underline decoration-border underline-offset-4 hover:text-foreground">
            /funcoes
          </Link>
          ); a <strong>Lotação</strong> traz as 3 unidades mais específicas da hierarquia oficial. A coluna
          Faixas mostra os símbolos das faixas de valor presentes entre os contratos do servidor. Clique numa
          linha para abrir <strong>Detalhes do Servidor</strong> — histórico de funções, consolidado de
          teletrabalho e histórico de contratos.
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
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  Funções
                  <InfoDica titulo="O que a coluna Funções mostra?" alinhamento="esquerda">
                    Todas as funções comissionadas (FC/CJ) que o servidor já ocupou. A
                    vigente hoje aparece <strong>destacada</strong>; as anteriores ficam em
                    tom apagado.
                  </InfoDica>
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  Lotação
                  <InfoDica titulo="O que a coluna Lotação mostra?" alinhamento="esquerda">
                    A lotação atual do servidor (relação de agentes públicos), como as 3
                    unidades mais específicas da hierarquia oficial de{' '}
                    <strong>/unidades</strong> — ex.: <em>SETOT / CSELE / STI</em>. Sem
                    resolução confiável, mostra o nome plano da fonte.
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
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Nenhum servidor encontrado para{' '}
                  &ldquo;{[busca.trim(), filtroLotacao.trim()].filter(Boolean).join('” · “')}&rdquo;
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
                        <FuncoesBadges servidor={servidor} todas />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const { curto, completo } = lotacaoDe(linha.nome);
                      return curto ? (
                        <span className="text-xs text-muted-foreground" title={completo || undefined}>
                          {curto}
                        </span>
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
            contratos={contratos}
            open
            onClose={() => setSelecionado(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
