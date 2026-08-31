'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColapsarBotao } from '@/components/dashboard/card-controles';
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
import type { CompetenciaTerceirizados, TerceirizadoFalha } from '@/lib/dashboard-data';

const ROTULO: Record<TerceirizadoFalha['tipo'], string> = {
  'lotacao-nao-identificada': 'Lotação não identificada',
  'sem-alocacao': 'Sem alocação no PDF',
  'contrato-nao-vinculado': 'Contrato não vinculado',
  'nome-nao-identificado': 'Nome não identificado',
};

export function TerceirizadosFalhasCard({
  falhas,
  competencias,
}: {
  falhas: TerceirizadoFalha[];
  /** Para linkar cada falha ao PDF mensal de origem. */
  competencias: CompetenciaTerceirizados[];
}) {
  const [aberto, setAberto] = useState(false);

  const pdfPorCompetencia = useMemo(
    () => new Map(competencias.map((c) => [c.chave, c.arquivoUrl])),
    [competencias],
  );

  const colunasExport = useMemo<ColunaExport<TerceirizadoFalha>[]>(
    () => [
      { cabecalho: 'Tipo', valor: (f) => ROTULO[f.tipo] },
      { cabecalho: 'Nome', valor: (f) => f.nome },
      { cabecalho: 'Alocação (PDF)', valor: (f) => f.alocacao },
      { cabecalho: 'Contrato', valor: (f) => f.contrato },
      { cabecalho: 'Competência mais recente', valor: (f) => mesAnoCurto(f.competenciaMaisRecente) },
      { cabecalho: 'PDF de origem', valor: (f) => pdfPorCompetencia.get(f.competenciaMaisRecente) ?? '' },
    ],
    [pdfPorCompetencia],
  );

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
                colunas={colunasExport}
                nomeArquivo="terceirizados-falhas"
                nomeAba="Falhas"
              />
            )}
            <ColapsarBotao
              colapsado={!aberto}
              onToggle={() => setAberto((a) => !a)}
              rotulo="a lista de falhas"
            />
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
                  <TableHead>Competência / PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {falhas.map((f, i) => {
                  const pdf = pdfPorCompetencia.get(f.competenciaMaisRecente);
                  return (
                    <TableRow key={`${f.nome}-${f.tipo}-${i}`}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>
                        <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                          {ROTULO[f.tipo]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.alocacao || '—'}</TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">{f.contrato || '—'}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {pdf ? (
                          <a
                            href={pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            title="Abrir o PDF mensal do TSE dessa competência, em nova aba"
                          >
                            {mesAnoCurto(f.competenciaMaisRecente)}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{mesAnoCurto(f.competenciaMaisRecente)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
