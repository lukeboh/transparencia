'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { brlCompacto, brlCompleto, numero } from '@/lib/utils';
import type { PontoEvolucao } from '@/lib/dashboard-data';

const SERIE = 'var(--chart-1)';

function EvolucaoTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload as PontoEvolucao;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs text-muted-foreground">{ponto.ano}</p>
      <p className="text-sm font-semibold">{brlCompleto(ponto.valor)}</p>
      <p className="text-xs text-muted-foreground">
        {numero(ponto.contratos)} contrato{ponto.contratos === 1 ? '' : 's'} iniciados
      </p>
    </div>
  );
}

interface PicoLabelProps {
  x?: number;
  y?: number;
  index?: number;
  picoIndex: number;
  valor: string;
}

/** Rótulo direto apenas no ponto de máximo — os demais valores ficam no eixo e no tooltip. */
function PicoLabel({ x, y, index, picoIndex, valor }: PicoLabelProps) {
  if (index !== picoIndex || x === undefined || y === undefined) return null;
  return (
    <text
      x={x}
      y={y - 10}
      textAnchor="middle"
      className="fill-foreground text-xs font-medium"
    >
      {valor}
    </text>
  );
}

export function EvolucaoChart({ dados }: { dados: PontoEvolucao[] }) {
  const picoIndex = dados.reduce(
    (max, p, i) => (p.valor > dados[max].valor ? i : max),
    0,
  );

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Evolução dos gastos</CardTitle>
        <CardDescription>
          Valor global dos contratos por ano de início de vigência
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados} margin={{ top: 24, right: 12, left: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="fillEvolucao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIE} stopOpacity={0.16} />
                <stop offset="100%" stopColor={SERIE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="ano"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={64}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={(v: number) => (v === 0 ? '0' : brlCompacto(v))}
            />
            <Tooltip
              content={<EvolucaoTooltip />}
              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="valor"
              stroke={SERIE}
              strokeWidth={2}
              fill="url(#fillEvolucao)"
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--card)' }}
              label={
                <PicoLabel
                  picoIndex={picoIndex}
                  valor={brlCompacto(dados[picoIndex]?.valor ?? 0)}
                />
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
