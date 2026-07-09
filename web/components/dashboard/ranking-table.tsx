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
import { brlCompleto, nomeProprio, numero } from '@/lib/utils';
import type { LinhaRanking } from '@/lib/dashboard-data';

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

export function RankingTable({ ranking }: { ranking: LinhaRanking[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ranking completo</CardTitle>
        <CardDescription>
          Top {ranking.length} responsáveis por valor consolidado — o valor de um
          contrato conta uma única vez por pessoa, mesmo com múltiplos papéis
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
            {ranking.map((linha, index) => (
              <TableRow key={linha.nome}>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {index + 1}
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
      </CardContent>
    </Card>
  );
}
