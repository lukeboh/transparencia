'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type TooltipProps } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { numero } from '@/lib/utils';

export interface FatiaContagem {
  rotulo: string;
  quantidade: number;
}

// Mesma paleta categórica de 5 slots + cinza de de-ênfase usada em
// categorias-chart.tsx — aqui generalizada para qualquer distribuição por
// contagem (não específica de FC/CJ como FuncaoDonut).
const CORES_SLOTS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const COR_OUTROS = '#898781';

function corFatia(fatia: FatiaContagem, index: number) {
  return fatia.rotulo === 'Outros' ? COR_OUTROS : CORES_SLOTS[index % CORES_SLOTS.length];
}

function ContagemTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const fatia = payload[0].payload as FatiaContagem;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md text-xs">
      <span className="font-semibold">{fatia.rotulo}</span>{' '}
      <span className="text-muted-foreground">
        · {numero(fatia.quantidade)} servidor{fatia.quantidade === 1 ? '' : 'es'}
      </span>
    </div>
  );
}

function FatiaAtiva(props: PieSectorDataItem) {
  const { outerRadius = 0 } = props;
  return <Sector {...props} outerRadius={outerRadius + 3} />;
}

/** Donut genérico de contagem por categoria — mesmo recibo visual de FuncaoDonut, cores categóricas em vez da rampa FC/CJ. */
export function ContagemDonut({ fatias, tamanho = 168 }: { fatias: FatiaContagem[]; tamanho?: number }) {
  const [ativa, setAtiva] = useState<number | undefined>(undefined);
  const total = fatias.reduce((s, f) => s + f.quantidade, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Nenhum servidor no filtro atual.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative shrink-0" style={{ height: tamanho, width: tamanho }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ContagemTooltip />} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 20 }} />
            <Pie
              data={fatias}
              dataKey="quantidade"
              nameKey="rotulo"
              innerRadius="62%"
              outerRadius="95%"
              paddingAngle={1}
              cornerRadius={2}
              stroke="var(--card)"
              strokeWidth={1.5}
              activeIndex={ativa}
              activeShape={FatiaAtiva}
              onMouseEnter={(_, index) => setAtiva(index)}
              onMouseLeave={() => setAtiva(undefined)}
              isAnimationActive={false}
            >
              {fatias.map((fatia, index) => (
                <Cell key={fatia.rotulo} fill={corFatia(fatia, index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{numero(total)}</span>
          <span className="text-[10px] text-muted-foreground">servidores</span>
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-2 gap-y-0.5" aria-label="Legenda">
        {fatias.map((fatia, index) => (
          <li
            key={fatia.rotulo}
            onMouseEnter={() => setAtiva(index)}
            onMouseLeave={() => setAtiva(undefined)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: corFatia(fatia, index) }}
            />
            <span className="max-w-[140px] truncate" title={fatia.rotulo}>
              {fatia.rotulo}
            </span>{' '}
            ({numero(fatia.quantidade)})
          </li>
        ))}
      </ul>
    </div>
  );
}
