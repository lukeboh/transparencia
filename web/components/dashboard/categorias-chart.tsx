'use client';

import { useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
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
import type { ContratoResumo, FatiaCategoria } from '@/lib/dashboard-data';

const CORES_SLOTS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const COR_OUTROS = '#898781';

function corDaFatia(fatia: FatiaCategoria, index: number) {
  return fatia.categoria === 'Outros'
    ? COR_OUTROS
    : CORES_SLOTS[index % CORES_SLOTS.length];
}

function percentual(valor: number, total: number) {
  if (total <= 0) return '—';
  const pct = (valor / total) * 100;
  if (pct > 0 && pct < 0.1) return '<0,1%';
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function CategoriaTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const fatia = payload[0].payload as FatiaCategoria;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground text-sm">{fatia.categoria}</p>
      <p><span className="text-muted-foreground font-medium">Global:</span> <span className="font-semibold">{brlCompleto(fatia.valor)}</span></p>
      <p><span className="text-muted-foreground font-medium">Empenhado:</span> <span className="font-semibold">{brlCompleto(fatia.valorEmpenhado || 0)}</span></p>
      <p><span className="text-muted-foreground font-medium">Pago:</span> <span className="font-semibold">{brlCompleto(fatia.valorPago || 0)}</span></p>
      <p className="text-muted-foreground pt-1 border-t border-border">
        {numero(fatia.contratos)} contrato{fatia.contratos === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function FatiaAtiva(props: PieSectorDataItem) {
  const { outerRadius = 0 } = props;
  return <Sector {...props} outerRadius={outerRadius + 4} />;
}

export function CategoriasChart({
  dados,
  contratos,
}: {
  dados: FatiaCategoria[];
  contratos: ContratoResumo[];
}) {
  const [metrica, setMetrica] = useState<TipoMetrica>('global');
  const [ativa, setAtiva] = useState<number | undefined>(undefined);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const keyMap: Record<TipoMetrica, keyof FatiaCategoria> = {
    global: 'valor',
    empenhado: 'valorEmpenhado',
    pago: 'valorPago',
  };
  const dataKey = keyMap[metrica];

  const total = dados.reduce((s, f) => s + Number(f[dataKey] || 0), 0);

  const nomeadas = new Set(
    dados.map((f) => f.categoria).filter((c) => c !== 'Outros'),
  );
  const contratosDaCategoria = selecionada === null
    ? []
    : contratos
        .filter((c) =>
          selecionada === 'Outros'
            ? !nomeadas.has(c.categoria)
            : c.categoria === selecionada,
        )
        .sort((a, b) => b.valorGlobal - a.valorGlobal);

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold">Divisão por categoria</CardTitle>
          <CardDescription>
            Participação no {LABELS_METRICA[metrica].nome.toLowerCase()}. Clique para auditar.
          </CardDescription>
        </div>
        <MetricaSelector valor={metrica} onChange={setMetrica} />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <div className="relative h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CategoriaTooltip />} wrapperStyle={{ zIndex: 30 }} />
              <Pie
                data={dados}
                dataKey={dataKey}
                nameKey="categoria"
                innerRadius="68%"
                outerRadius="92%"
                paddingAngle={1}
                cornerRadius={3}
                stroke="var(--card)"
                strokeWidth={2}
                activeIndex={ativa}
                activeShape={FatiaAtiva}
                onMouseEnter={(_, index) => setAtiva(index)}
                onMouseLeave={() => setAtiva(undefined)}
                onClick={(_, index) => setSelecionada(dados[index].categoria)}
              >
                {dados.map((fatia, index) => (
                  <Cell
                    key={fatia.categoria}
                    fill={corDaFatia(fatia, index)}
                    className="cursor-pointer transition-opacity duration-200"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-semibold tracking-tight">
              {brlCompacto(total)}
            </span>
            <span className="text-xs text-muted-foreground">{LABELS_METRICA[metrica].sigla}</span>
          </div>
        </div>

        <ul className="w-full space-y-1.5 text-sm" aria-label="Legenda por categoria">
          {dados.map((fatia, index) => {
            const v = Number(fatia[dataKey] || 0);
            return (
              <li
                key={fatia.categoria}
                onMouseEnter={() => setAtiva(index)}
                onMouseLeave={() => setAtiva(undefined)}
                onClick={() => setSelecionada(fatia.categoria)}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 transition-colors duration-150 hover:bg-accent/50"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: corDaFatia(fatia, index) }}
                />
                <span title={fatia.categoria} className="truncate text-muted-foreground">
                  {fatia.categoria}
                </span>
                <span className="ml-auto font-medium tabular-nums">
                  {brlCompacto(v)}
                </span>
                <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                  {percentual(v, total)}
                </span>
              </li>
            );
          })}
        </ul>

        {selecionada !== null && (
          <ContratosDialog
            titulo={`Categoria: ${selecionada}`}
            contratos={contratosDaCategoria}
            open
            onClose={() => setSelecionada(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
