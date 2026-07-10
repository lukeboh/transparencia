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
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { brlCompacto, brlCompleto, numero } from '@/lib/utils';
import type { ContratoResumo, FatiaCategoria } from '@/lib/dashboard-data';

// Ordem fixa de slots da paleta categórica validada; "Outros" usa o cinza de
// de-ênfase em vez de consumir um slot de identidade.
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
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs text-muted-foreground">{fatia.categoria}</p>
      <p className="text-sm font-semibold">{brlCompleto(fatia.valor)}</p>
      <p className="text-xs text-muted-foreground">
        {numero(fatia.contratos)} contrato{fatia.contratos === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/** Fatia ativa "levanta" 4px no hover, mantendo o anel de 2px na cor da superfície. */
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
  const [ativa, setAtiva] = useState<number | undefined>(undefined);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const total = dados.reduce((s, f) => s + f.valor, 0);

  // "Outros" agrega tudo que não é uma das fatias nomeadas.
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Divisão por categoria</CardTitle>
        <CardDescription>
          Participação no valor total contratado. Clique em uma categoria para
          auditar os contratos na fonte.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <div className="relative h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CategoriaTooltip />} />
              <Pie
                data={dados}
                dataKey="valor"
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
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tracking-tight">
              {brlCompacto(total)}
            </span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        </div>

        <ul className="w-full space-y-1.5 text-sm" aria-label="Legenda por categoria">
          {dados.map((fatia, index) => (
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
                {brlCompacto(fatia.valor)}
              </span>
              <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                {percentual(fatia.valor, total)}
              </span>
            </li>
          ))}
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
