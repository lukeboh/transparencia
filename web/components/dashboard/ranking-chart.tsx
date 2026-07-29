'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MetricaSelector, type TipoMetrica, LABELS_METRICA } from '@/components/dashboard/metrica-selector';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { contratosDoResponsavel } from '@/components/dashboard/ranking-table';
import { brlCompacto, brlCompleto, nomeProprio, numero } from '@/lib/utils';
import type { ContratoResumo, LinhaRanking } from '@/lib/dashboard-data';

const CORES: Record<TipoMetrica, string> = {
  global: 'var(--chart-1)',
  empenhado: 'var(--chart-2)',
  pago: 'var(--chart-3)',
};

const MAX_BARRAS = 10;

function RankingTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload as LinhaRanking;
  return (
    <div className="max-w-72 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground text-sm">{nomeProprio(linha.nome)}</p>
      <p><span className="text-muted-foreground font-medium">Global:</span> <span className="font-semibold">{brlCompleto(linha.valorConsolidado)}</span></p>
      <p><span className="text-muted-foreground font-medium">Empenhado:</span> <span className="font-semibold">{brlCompleto(linha.valorEmpenhadoConsolidado || 0)}</span></p>
      <p><span className="text-muted-foreground font-medium">Pago:</span> <span className="font-semibold">{brlCompleto(linha.valorPagoConsolidado || 0)}</span></p>
      <p className="text-muted-foreground pt-1 border-t border-border">
        {numero(linha.quantidadeContratos)} contrato{linha.quantidadeContratos === 1 ? '' : 's'} · {linha.papeis.join(', ')}
      </p>
    </div>
  );
}

function abreviar(nome: string, max = 24) {
  const proprio = nomeProprio(nome);
  return proprio.length > max ? `${proprio.slice(0, max - 1)}…` : proprio;
}

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
}

function NomeTick({ x, y, payload }: TickProps) {
  if (x === undefined || y === undefined || !payload) return null;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="var(--muted-foreground)"
      fontSize={12}
    >
      {abreviar(payload.value)}
    </text>
  );
}

export function RankingChart({
  ranking,
  contratos,
}: {
  ranking: LinhaRanking[];
  contratos: ContratoResumo[];
}) {
  const [metrica, setMetrica] = useState<TipoMetrica>('global');
  const [selecionado, setSelecionado] = useState<LinhaRanking | null>(null);

  const keyMap: Record<TipoMetrica, keyof LinhaRanking> = {
    global: 'valorConsolidado',
    empenhado: 'valorEmpenhadoConsolidado',
    pago: 'valorPagoConsolidado',
  };
  const dataKey = keyMap[metrica];

  const dados = [...ranking]
    .sort((a, b) => Number(b[dataKey] || 0) - Number(a[dataKey] || 0))
    .slice(0, MAX_BARRAS);

  const corAtiva = CORES[metrica];

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="text-base font-semibold">
            Maiores valores sob responsabilidade
          </CardTitle>
          <CardDescription>
            Top {dados.length} servidores por {LABELS_METRICA[metrica].nome.toLowerCase()}. Clique para auditar.
          </CardDescription>
        </div>
        <MetricaSelector valor={metrica} onChange={setMetrica} />
      </CardHeader>
      <CardContent className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 0, right: 72, left: 8, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={180}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={<NomeTick />}
            />
            <Tooltip content={<RankingTooltip />} cursor={{ fill: 'var(--accent)', fillOpacity: 0.4 }} />
            <Bar
              dataKey={dataKey}
              fill={corAtiva}
              barSize={18}
              radius={[0, 4, 4, 0]}
              activeBar={{ fillOpacity: 0.8 }}
              className="cursor-pointer"
              onClick={(_, index) => setSelecionado(dados[index])}
            >
              <LabelList
                dataKey={dataKey}
                position="right"
                offset={8}
                formatter={(valor: number) => brlCompacto(valor)}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

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
