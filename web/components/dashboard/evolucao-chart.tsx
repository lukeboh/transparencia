'use client';

import { useState } from 'react';
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
import { MetricaSelector, type TipoMetrica, LABELS_METRICA } from '@/components/dashboard/metrica-selector';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { brlCompacto, brlCompleto, numero } from '@/lib/utils';
import type { ContratoResumo, PontoEvolucao } from '@/lib/dashboard-data';

const CORES: Record<TipoMetrica, string> = {
  global: 'var(--chart-1)',
  empenhado: 'var(--chart-2)',
  pago: 'var(--chart-3)',
};

function EvolucaoTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload as PontoEvolucao;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground text-sm">{ponto.ano}</p>
      <p><span className="text-muted-foreground font-medium">Global:</span> <span className="font-semibold">{brlCompleto(ponto.valor)}</span></p>
      <p><span className="text-muted-foreground font-medium">Empenhado:</span> <span className="font-semibold">{brlCompleto(ponto.valorEmpenhado || 0)}</span></p>
      <p><span className="text-muted-foreground font-medium">Pago:</span> <span className="font-semibold">{brlCompleto(ponto.valorPago || 0)}</span></p>
      <p className="text-muted-foreground pt-1 border-t border-border">
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

export function EvolucaoChart({
  dados,
  contratos,
}: {
  dados: PontoEvolucao[];
  contratos: ContratoResumo[];
}) {
  const [metrica, setMetrica] = useState<TipoMetrica>('global');
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);

  const keyMap: Record<TipoMetrica, keyof PontoEvolucao> = {
    global: 'valor',
    empenhado: 'valorEmpenhado',
    pago: 'valorPago',
  };
  const dataKey = keyMap[metrica];

  const picoIndex = dados.reduce(
    (max, p, i) => (Number(p[dataKey] || 0) > Number(dados[max]?.[dataKey] || 0) ? i : max),
    0,
  );

  const contratosDoAno = anoSelecionado === null
    ? []
    : contratos
        .filter((c) => c.ano === anoSelecionado)
        .sort((a, b) => b.valorGlobal - a.valorGlobal);

  const corAtiva = CORES[metrica];

  return (
    <Card className="min-w-0 lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold">Evolução dos gastos</CardTitle>
          <CardDescription>
            {LABELS_METRICA[metrica].nome} por ano de início de vigência. Clique em um ano para auditar os contratos.
          </CardDescription>
        </div>
        <MetricaSelector valor={metrica} onChange={setMetrica} />
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={dados}
            margin={{ top: 24, right: 12, left: 12, bottom: 0 }}
            className="cursor-pointer"
            onClick={(state) => {
              const ano = Number(state?.activeLabel);
              if (Number.isFinite(ano)) setAnoSelecionado(ano);
            }}
          >
            <defs>
              <linearGradient id="fillEvolucao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={corAtiva} stopOpacity={0.2} />
                <stop offset="100%" stopColor={corAtiva} stopOpacity={0.02} />
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
              dataKey={dataKey}
              stroke={corAtiva}
              strokeWidth={2}
              fill="url(#fillEvolucao)"
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--card)' }}
              label={
                <PicoLabel
                  picoIndex={picoIndex}
                  valor={brlCompacto(Number(dados[picoIndex]?.[dataKey] || 0))}
                />
              }
            />
          </AreaChart>
        </ResponsiveContainer>

        {anoSelecionado !== null && (
          <ContratosDialog
            titulo={`Contratos iniciados em ${anoSelecionado}`}
            contratos={contratosDoAno}
            open
            onClose={() => setAnoSelecionado(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
