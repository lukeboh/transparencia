'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type TooltipProps } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { numero } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

export interface FatiaFuncao {
  tipo: 'FC' | 'CJ';
  nivel: number;
  quantidade: number;
}

// FC e CJ usam os dois primeiros slots da paleta categórica validada do
// projeto (--chart-1/--chart-2, ver web/app/globals.css); o nível dentro de
// cada função é ordinal (1 é o menos sênior, 6/4 o mais), então em vez de
// inventar 10 matizes novos (mais do que os 6 slots validados suportam),
// o nível vira uma rampa sequencial de claridade sobre o mesmo matiz —
// exatamente o padrão "um matiz, claro→escuro" para magnitude.
const MATIZ_POR_TIPO: Record<FatiaFuncao['tipo'], string> = {
  FC: 'var(--chart-1)',
  CJ: 'var(--chart-2)',
};
const NIVEL_MAX: Record<FatiaFuncao['tipo'], number> = { FC: 6, CJ: 4 };

function corFatia(tipo: FatiaFuncao['tipo'], nivel: number) {
  const max = NIVEL_MAX[tipo];
  const clareamento = max > 1 ? ((max - nivel) / (max - 1)) * 55 : 0;
  return `color-mix(in oklch, ${MATIZ_POR_TIPO[tipo]} ${100 - clareamento}%, var(--card))`;
}

/** Quantidade de servidores por função vigente hoje (tipo-nível), em ordem fixa FC-1..6, CJ-1..4. */
export function contarPorFuncaoAtual(servidores: ServidorFuncoes[]): FatiaFuncao[] {
  const contagem = new Map<string, FatiaFuncao>();
  for (const s of servidores) {
    const vigente = s.mandatos.find((m) => m.vigente);
    if (!vigente) continue;
    const chave = `${vigente.tipo}-${vigente.nivel}`;
    const atual = contagem.get(chave) ?? { tipo: vigente.tipo, nivel: vigente.nivel, quantidade: 0 };
    atual.quantidade += 1;
    contagem.set(chave, atual);
  }
  return [...contagem.values()].sort((a, b) => (a.tipo === b.tipo ? a.nivel - b.nivel : a.tipo.localeCompare(b.tipo)));
}

function FuncaoTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const fatia = payload[0].payload as FatiaFuncao;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md text-xs">
      <span className="font-semibold">{fatia.tipo}-{fatia.nivel}</span>{' '}
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

/** Mini-donut: quantidade de servidores por função vigente, sensível a qualquer filtro já aplicado a `contagens`. */
export function FuncaoDonut({ contagens }: { contagens: FatiaFuncao[] }) {
  const [ativa, setAtiva] = useState<number | undefined>(undefined);
  const total = contagens.reduce((s, f) => s + f.quantidade, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma função vigente no filtro atual.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[84px] w-[84px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<FuncaoTooltip />} />
            <Pie
              data={contagens}
              dataKey="quantidade"
              nameKey="tipo"
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
              {contagens.map((fatia, index) => (
                <Cell key={`${fatia.tipo}-${fatia.nivel}`} fill={corFatia(fatia.tipo, fatia.nivel)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold tabular-nums">{numero(total)}</span>
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-2 gap-y-0.5" aria-label="Legenda por função">
        {contagens.map((fatia, index) => (
          <li
            key={`${fatia.tipo}-${fatia.nivel}`}
            onMouseEnter={() => setAtiva(index)}
            onMouseLeave={() => setAtiva(undefined)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: corFatia(fatia.tipo, fatia.nivel) }}
            />
            {fatia.tipo}-{fatia.nivel} ({numero(fatia.quantidade)})
          </li>
        ))}
      </ul>
    </div>
  );
}
