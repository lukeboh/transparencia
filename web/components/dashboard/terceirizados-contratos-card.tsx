'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, MoveHorizontal } from 'lucide-react';
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
import { brlCompacto, cn, numero } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { ContratoTerceirizados } from '@/lib/dashboard-data';

type Campo = 'contrato' | 'empresa' | 'ativos' | 'total' | 'valor';
type Direcao = 'asc' | 'desc';

const COLUNAS_EXPORT: ColunaExport<ContratoTerceirizados>[] = [
  { cabecalho: 'Contrato', valor: (c) => c.contrato },
  { cabecalho: 'Empresa', valor: (c) => c.empresa || c.fornecedor || '' },
  { cabecalho: 'Terceirizados ativos', valor: (c) => c.ativos },
  { cabecalho: 'Terceirizados no histórico', valor: (c) => c.total },
  { cabecalho: 'Vinculado ao Compras.gov.br', valor: (c) => c.contratoId != null },
  { cabecalho: 'Valor global', valor: (c) => c.valorGlobal ?? '' },
  { cabecalho: 'Vigente', valor: (c) => (c.vigente == null ? '' : c.vigente) },
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
  contratos: ContratoTerceirizados[];
  onVerContrato: (c: ContratoTerceirizados) => void;
}) {
  const [campo, setCampo] = useState<Campo>('ativos');
  const [direcao, setDirecao] = useState<Direcao>('desc');

  function ordenarPor(c: Campo) {
    if (c === campo) {
      setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCampo(c);
      setDirecao(c === 'contrato' || c === 'empresa' ? 'asc' : 'desc');
    }
  }

  const ordenados = useMemo(() => {
    const f = direcao === 'asc' ? 1 : -1;
    return [...contratos].sort((a, b) => {
      if (campo === 'contrato') return f * a.contrato.localeCompare(b.contrato, 'pt-BR');
      if (campo === 'empresa') return f * (a.empresa || a.fornecedor || '').localeCompare(b.empresa || b.fornecedor || '', 'pt-BR');
      if (campo === 'ativos') return f * (a.ativos - b.ativos) || b.total - a.total;
      if (campo === 'total') return f * (a.total - b.total);
      return f * ((a.valorGlobal ?? -1) - (b.valorGlobal ?? -1));
    });
  }, [contratos, campo, direcao]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Contratos de cessão de mão de obra</CardTitle>
            <CardDescription>
              {numero(contratos.length)} contrato{contratos.length === 1 ? '' : 's'} · clique numa linha
              para ver os detalhes do contrato.
            </CardDescription>
          </div>
          <BotaoExportar
            linhas={ordenados}
            colunas={COLUNAS_EXPORT}
            nomeArquivo="terceirizados-contratos"
            nomeAba="Contratos"
          />
        </div>
      </CardHeader>
      <CardContent>
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
            {ordenados.map((c) => (
              <TableRow key={c.contrato} onClick={() => onVerContrato(c)} className="cursor-pointer">
                <TableCell className="font-medium tabular-nums">
                  <span className="flex items-center gap-1.5">
                    {c.contrato}
                    {c.vigente && (
                      <span className="rounded-sm bg-secondary px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                        vigente
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="max-w-[22rem] truncate text-xs text-muted-foreground" title={c.fornecedor ?? c.empresa}>
                  {c.empresa || c.fornecedor || '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{numero(c.ativos)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{numero(c.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {c.valorGlobal != null ? brlCompacto(c.valorGlobal) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
          <MoveHorizontal className="h-3 w-3 shrink-0" aria-hidden />
          Deslize a tabela para o lado para ver mais colunas
        </p>
      </CardContent>
    </Card>
  );
}
