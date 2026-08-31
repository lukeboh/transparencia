'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BotaoExportar } from '@/components/dashboard/botao-exportar';
import { DicaTermo } from '@/components/ui/dica-termo';
import { mesAnoCurto, numero } from '@/lib/utils';
import type { ColunaExport } from '@/lib/exportar-dados';
import type { TerceirizadoFalha } from '@/lib/dashboard-data';

const ROTULO: Record<TerceirizadoFalha['tipo'], string> = {
  'lotacao-nao-identificada': 'Lotação não identificada',
  'sem-alocacao': 'Sem alocação no PDF',
  'contrato-nao-vinculado': 'Contrato não vinculado',
};

const COLUNAS_EXPORT: ColunaExport<TerceirizadoFalha>[] = [
  { cabecalho: 'Tipo', valor: (f) => ROTULO[f.tipo] },
  { cabecalho: 'Nome', valor: (f) => f.nome },
  { cabecalho: 'Alocação (PDF)', valor: (f) => f.alocacao },
  { cabecalho: 'Contrato', valor: (f) => f.contrato },
  { cabecalho: 'Competência mais recente', valor: (f) => mesAnoCurto(f.competenciaMaisRecente) },
];

export function TerceirizadosFalhasCard({ falhas }: { falhas: TerceirizadoFalha[] }) {
  const [aberto, setAberto] = useState(false);

  const porTipo = useMemo(() => {
    const m = new Map<TerceirizadoFalha['tipo'], number>();
    for (const f of falhas) m.set(f.tipo, (m.get(f.tipo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [falhas]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            Registro de falhas <DicaTermo id="terceirizadoFalhas" />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              {numero(falhas.length)}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {falhas.length > 0 && (
              <BotaoExportar
                linhas={falhas}
                colunas={COLUNAS_EXPORT}
                nomeArquivo="terceirizados-falhas"
                nomeAba="Falhas"
              />
            )}
            <button
              type="button"
              onClick={() => setAberto((a) => !a)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {aberto ? 'Recolher' : 'Ver lista'}
              {aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {porTipo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma falha — todos os terceirizados foram cruzados.</p>
          ) : (
            porTipo.map(([tipo, qtd]) => (
              <span
                key={tipo}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
              >
                {ROTULO[tipo]}
                <span className="font-semibold tabular-nums">{numero(qtd)}</span>
              </span>
            ))
          )}
        </div>

        {aberto && falhas.length > 0 && (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alocação (PDF)</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Competência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {falhas.map((f, i) => (
                  <TableRow key={`${f.nome}-${f.tipo}-${i}`}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>
                      <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        {ROTULO[f.tipo]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.alocacao || '—'}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">{f.contrato || '—'}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {mesAnoCurto(f.competenciaMaisRecente)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
