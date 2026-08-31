'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, MoveHorizontal } from 'lucide-react';
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
import { CampoBusca, ColapsarBotao, VigenteToggle } from '@/components/dashboard/card-controles';
import { useSincronizarUrl } from '@/lib/use-sincronizar-url';
import { bool } from '@/lib/url-filtros';
import { brlCompacto, cn, numero } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { ContratoTerceirizados } from '@/lib/dashboard-data';

type Campo = 'contrato' | 'empresa' | 'ativos' | 'total' | 'valor';
type Direcao = 'asc' | 'desc';
/** Como quebrar "NN/AAAA": por ano e depois número, ou por número e depois ano. */
type ContratoOrdem = 'ano-num' | 'num-ano';
const LISTA_EMPRESAS_ID = 'terceirizados-contratos-empresas';

/** "Vigente" nesta tela = o contrato ainda tem terceirizado alocado na competência mais recente. */
const estaVigente = (c: ContratoTerceirizados) => c.ativos > 0;

/** "31/2023" → { num: 31, ano: 2023 }; sem barra reconhecível → zeros. */
function partesContrato(numero: string): { num: number; ano: number } {
  const m = /^(\d+)\s*\/\s*(\d{2,4})$/.exec((numero ?? '').trim());
  if (!m) return { num: 0, ano: 0 };
  return { num: Number(m[1]), ano: Number(m[2].length === 2 ? `20${m[2]}` : m[2]) };
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const COLUNAS_EXPORT: ColunaExport<ContratoTerceirizados>[] = [
  { cabecalho: 'Contrato', valor: (c) => c.contrato },
  { cabecalho: 'Empresa', valor: (c) => c.empresa || c.fornecedor || '' },
  { cabecalho: 'Terceirizados ativos', valor: (c) => c.ativos },
  { cabecalho: 'Terceirizados no histórico', valor: (c) => c.total },
  { cabecalho: 'Vinculado ao Compras.gov.br', valor: (c) => c.contratoId != null },
  { cabecalho: 'Valor global', valor: (c) => c.valorGlobal ?? '' },
  { cabecalho: 'Vigente no Compras.gov.br', valor: (c) => (c.vigente == null ? '' : c.vigente) },
  { cabecalho: 'Classificação', valor: (c) => c.categoria ?? '' },
];

function CabecalhoOrdenavel({
  rotulo,
  campo,
  atual,
  direcao,
  onOrdenar,
  className,
}: {
  rotulo: string;
  campo: Campo;
  atual: Campo;
  direcao: Direcao;
  onOrdenar: (c: Campo) => void;
  className?: string;
}) {
  const ativo = atual === campo;
  const Icone = !ativo ? ArrowUpDown : direcao === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(campo)}
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

export function TerceirizadosContratosCard({
  contratos,
  onVerContrato,
}: {
  /** Lista completa — o filtro Vigente (padrão ligado) mostra só os com terceirizado ativo. */
  contratos: ContratoTerceirizados[];
  onVerContrato: (c: ContratoTerceirizados) => void;
}) {
  const [campo, setCampo] = useState<Campo>('ativos');
  const [direcao, setDirecao] = useState<Direcao>('desc');
  // Quebra de "NN/AAAA" para ordenar a coluna Contrato (4 combinações: esta
  // chave × asc/desc no cabeçalho).
  const [contratoOrdem, setContratoOrdem] = useState<ContratoOrdem>('ano-num');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  // Regra do projeto: filtro Vigente começa ligado (ver card-controles.tsx).
  const [vigente, setVigente] = useState(true);
  const [colapsado, setColapsado] = useState(false);

  useSincronizarUrl(
    {
      cvig: bool.escrever(vigente, true),
      cemp: filtroEmpresa || undefined,
      cord: contratoOrdem === 'ano-num' ? undefined : contratoOrdem,
    },
    (sp) => {
      setVigente(bool.ler(sp.get('cvig'), true));
      const emp = sp.get('cemp');
      if (emp) setFiltroEmpresa(emp);
      if (sp.get('cord') === 'num-ano') setContratoOrdem('num-ano');
    },
  );

  function ordenarPor(c: Campo) {
    if (c === campo) {
      setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCampo(c);
      setDirecao(c === 'contrato' || c === 'empresa' ? 'asc' : 'desc');
    }
  }

  const base = useMemo(() => {
    let l = vigente ? contratos.filter(estaVigente) : contratos;
    const termo = normalizar(filtroEmpresa.trim());
    if (termo) {
      l = l.filter((c) => normalizar(`${c.empresa} ${c.fornecedor ?? ''}`).includes(termo));
    }
    return l;
  }, [contratos, vigente, filtroEmpresa]);

  const ordenados = useMemo(() => {
    const f = direcao === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      if (campo === 'contrato') {
        const ka = partesContrato(a.contrato);
        const kb = partesContrato(b.contrato);
        const primario =
          contratoOrdem === 'ano-num'
            ? ka.ano - kb.ano || ka.num - kb.num
            : ka.num - kb.num || ka.ano - kb.ano;
        return f * primario;
      }
      if (campo === 'empresa') return f * (a.empresa || a.fornecedor || '').localeCompare(b.empresa || b.fornecedor || '', 'pt-BR');
      if (campo === 'ativos') return f * (a.ativos - b.ativos) || b.total - a.total;
      if (campo === 'total') return f * (a.total - b.total);
      return f * ((a.valorGlobal ?? -1) - (b.valorGlobal ?? -1));
    });
  }, [base, campo, direcao, contratoOrdem]);

  const comAtivos = useMemo(() => contratos.filter(estaVigente).length, [contratos]);
  const opcoesEmpresa = useMemo(
    () =>
      Array.from(new Set(contratos.map((c) => c.empresa || c.fornecedor || '').filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [contratos],
  );
  const temFiltro = Boolean(filtroEmpresa.trim());

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Contratos de cessão de mão de obra</CardTitle>
            <CardDescription>
              {numero(base.length)} contrato{base.length === 1 ? '' : 's'}
              {vigente ? ' com terceirizado ativo' : ` no histórico · ${numero(comAtivos)} com terceirizado ativo`}
              {temFiltro && ' no filtro'} · clique numa linha para ver os detalhes do contrato.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <VigenteToggle
              ligado={vigente}
              onChange={setVigente}
              titulo="Vigente: contratos com terceirizado alocado na competência mais recente. Desligue para incluir os já encerrados."
            />
            <BotaoExportar
              linhas={ordenados}
              colunas={COLUNAS_EXPORT}
              nomeArquivo="terceirizados-contratos"
              nomeAba="Contratos"
            />
            <ColapsarBotao colapsado={colapsado} onToggle={() => setColapsado((c) => !c)} rotulo="a tabela" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {colapsado ? (
          <p className="text-sm text-muted-foreground">
            {numero(base.length)} contrato{base.length === 1 ? '' : 's'}
            {vigente ? ' com terceirizado ativo' : ' no histórico'}
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
              <CampoBusca
                valor={filtroEmpresa}
                aoMudar={setFiltroEmpresa}
                placeholder="Filtrar por empresa…"
                rotulo="Filtrar por empresa"
                icone={Building2}
                listId={LISTA_EMPRESAS_ID}
              />
              <datalist id={LISTA_EMPRESAS_ID}>
                {opcoesEmpresa.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Ordenar contrato por
                <select
                  value={contratoOrdem}
                  onChange={(e) => {
                    setContratoOrdem(e.target.value as ContratoOrdem);
                    setCampo('contrato');
                  }}
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="ano-num">ano, depois número</option>
                  <option value="num-ano">número, depois ano</option>
                </select>
              </label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <CabecalhoOrdenavel rotulo="Contrato" campo="contrato" atual={campo} direcao={direcao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead>
                    <CabecalhoOrdenavel rotulo="Empresa" campo="empresa" atual={campo} direcao={direcao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead className="text-right">
                    <CabecalhoOrdenavel rotulo="Ativos" campo="ativos" atual={campo} direcao={direcao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead className="text-right">
                    <CabecalhoOrdenavel rotulo="Histórico" campo="total" atual={campo} direcao={direcao} onOrdenar={ordenarPor} />
                  </TableHead>
                  <TableHead className="text-right">
                    <CabecalhoOrdenavel rotulo="Valor global" campo="valor" atual={campo} direcao={direcao} onOrdenar={ordenarPor} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {temFiltro
                        ? `Nenhum contrato para “${filtroEmpresa}”`
                        : 'Nenhum contrato com terceirizado ativo. Desligue o filtro Vigente para ver o histórico.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  ordenados.map((c) => (
                    <TableRow key={c.contrato} onClick={() => onVerContrato(c)} className="cursor-pointer">
                      <TableCell className="font-medium tabular-nums">{c.contrato}</TableCell>
                      <TableCell className="max-w-[22rem] truncate text-xs text-muted-foreground" title={c.fornecedor ?? c.empresa}>
                        {c.empresa || c.fornecedor || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{numero(c.ativos)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{numero(c.total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.valorGlobal != null ? brlCompacto(c.valorGlobal) : '—'}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
