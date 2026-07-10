'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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
import { brlCompleto, cn, nomeProprio, numero } from '@/lib/utils';
import type { ContratoResumo, LinhaRanking } from '@/lib/dashboard-data';

const LINHAS_POR_PAGINA = 25;
const MAX_PAPEIS_VISIVEIS = 2;

function Papeis({ papeis }: { papeis: string[] }) {
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

function BotaoPagina({
  className,
  ...props
}: React.ComponentProps<'button'>) {
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

export function contratosDoResponsavel(
  linha: LinhaRanking,
  contratos: ContratoResumo[],
): ContratoAuditavel[] {
  return linha.contratos
    .map(({ i, papeis }) => ({ ...contratos[i], papeisNoContrato: papeis }))
    .sort((a, b) => b.valorGlobal - a.valorGlobal);
}

export function RankingTable({
  ranking,
  contratos,
}: {
  ranking: LinhaRanking[];
  contratos: ContratoResumo[];
}) {
  const [pagina, setPagina] = useState(0);
  const [selecionado, setSelecionado] = useState<LinhaRanking | null>(null);
  const totalPaginas = Math.max(1, Math.ceil(ranking.length / LINHAS_POR_PAGINA));
  const inicio = pagina * LINHAS_POR_PAGINA;
  const linhas = ranking.slice(inicio, inicio + LINHAS_POR_PAGINA);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ranking completo</CardTitle>
        <CardDescription>
          Todos os {numero(ranking.length)} responsáveis, por valor consolidado — o
          valor de um contrato conta uma única vez por pessoa, mesmo com múltiplos
          papéis. Clique em um servidor para auditar seus contratos na fonte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Servidor</TableHead>
              <TableHead>Papéis</TableHead>
              <TableHead className="text-right">Contratos</TableHead>
              <TableHead className="text-right">Valor consolidado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha, index) => (
              <TableRow
                key={inicio + index}
                onClick={() => setSelecionado(linha)}
                className="cursor-pointer"
              >
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {inicio + index + 1}
                </TableCell>
                <TableCell className="font-medium">{nomeProprio(linha.nome)}</TableCell>
                <TableCell>
                  <Papeis papeis={linha.papeis} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numero(linha.quantidadeContratos)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {brlCompleto(linha.valorConsolidado)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Exibindo {numero(inicio + 1)}–{numero(inicio + linhas.length)} de{' '}
            {numero(ranking.length)}
          </p>
          <div className="flex items-center gap-1.5">
            <BotaoPagina
              onClick={() => setPagina(0)}
              disabled={pagina === 0}
              aria-label="Primeira página"
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden />
            </BotaoPagina>
            <BotaoPagina
              onClick={() => setPagina((p) => p - 1)}
              disabled={pagina === 0}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </BotaoPagina>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">
              {numero(pagina + 1)} / {numero(totalPaginas)}
            </span>
            <BotaoPagina
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= totalPaginas - 1}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </BotaoPagina>
            <BotaoPagina
              onClick={() => setPagina(totalPaginas - 1)}
              disabled={pagina >= totalPaginas - 1}
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
