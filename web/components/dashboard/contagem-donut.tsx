'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type TooltipProps } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { numero } from '@/lib/utils';

export interface FatiaContagem {
  rotulo: string;
  quantidade: number;
  /** Cor explícita da fatia — sobrepõe o ciclo de cores por índice (usado quando cada rótulo já tem uma cor fixa de domínio, ex.: faixas de valor). */
  cor?: string;
  /** Linha secundária na legenda (ex.: nome da empresa contratada). */
  sub?: string;
  /** Carga opaca devolvida em onSelecionar (ex.: o objeto do contrato). */
  meta?: unknown;
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
  if (fatia.cor) return fatia.cor;
  return fatia.rotulo === 'Outros' ? COR_OUTROS : CORES_SLOTS[index % CORES_SLOTS.length];
}

function ContagemTooltip({
  active,
  payload,
  unidadeSingular,
  unidadePlural,
  formatar,
}: TooltipProps<number, string> & {
  unidadeSingular: string;
  unidadePlural: string;
  formatar: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fatia = payload[0].payload as FatiaContagem;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md text-xs">
      <span className="font-semibold">{fatia.rotulo}</span>
      {fatia.sub && <span className="text-muted-foreground/80"> · {fatia.sub}</span>}{' '}
      <span className="text-muted-foreground">
        · {formatar(fatia.quantidade)} {fatia.quantidade === 1 ? unidadeSingular : unidadePlural}
      </span>
    </div>
  );
}

function FatiaAtiva(props: PieSectorDataItem) {
  const { outerRadius = 0 } = props;
  return <Sector {...props} outerRadius={outerRadius + 3} />;
}

/** Donut genérico de contagem por categoria — mesmo recibo visual de FuncaoDonut, cores categóricas em vez da rampa FC/CJ. */
export function ContagemDonut({
  fatias,
  tamanho = 168,
  unidadeSingular = 'servidor',
  unidadePlural = 'servidores',
  formatar = numero,
  onSelecionar,
}: {
  fatias: FatiaContagem[];
  tamanho?: number;
  /** Nome da unidade contada, para o rótulo central e o tooltip (ex.: "contrato"/"contratos"). */
  unidadeSingular?: string;
  unidadePlural?: string;
  /** Formata `quantidade` no centro, legenda e tooltip. Default: inteiro com separador. Para donut de valor: `brlCompacto`. */
  formatar?: (n: number) => string;
  /** Se informado, clicar numa fatia ou item da legenda chama isto. */
  onSelecionar?: (fatia: FatiaContagem, index: number) => void;
}) {
  const [ativa, setAtiva] = useState<number | undefined>(undefined);
  const total = fatias.reduce((s, f) => s + f.quantidade, 0);
  const comSub = fatias.some((f) => f.sub);
  const clicavel = (f: FatiaContagem) => Boolean(onSelecionar && f.meta !== undefined);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Nenhum {unidadeSingular} no filtro atual.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative shrink-0" style={{ height: tamanho, width: tamanho }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <ContagemTooltip
                  unidadeSingular={unidadeSingular}
                  unidadePlural={unidadePlural}
                  formatar={formatar}
                />
              }
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 20 }}
            />
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
              onClick={(_, index) => {
                const f = fatias[index];
                if (f && clicavel(f)) onSelecionar?.(f, index);
              }}
              className={onSelecionar ? '[&_.recharts-sector]:cursor-pointer' : undefined}
              isAnimationActive={false}
            >
              {fatias.map((fatia, index) => (
                <Cell key={fatia.rotulo} fill={corFatia(fatia, index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{formatar(total)}</span>
          <span className="text-[10px] text-muted-foreground">{unidadePlural}</span>
        </div>
      </div>
      <ul
        className={
          comSub
            ? 'flex w-full flex-col gap-0.5'
            : 'flex flex-wrap justify-center gap-x-2 gap-y-0.5'
        }
        aria-label="Legenda"
      >
        {fatias.map((fatia, index) => {
          const podeClicar = clicavel(fatia);
          return (
            <li
              key={fatia.rotulo}
              onMouseEnter={() => setAtiva(index)}
              onMouseLeave={() => setAtiva(undefined)}
              onClick={podeClicar ? () => onSelecionar?.(fatia, index) : undefined}
              className={[
                'flex items-center gap-1 text-[10px] text-muted-foreground',
                podeClicar ? 'cursor-pointer rounded-sm px-1 -mx-1 hover:bg-accent hover:text-accent-foreground' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: corFatia(fatia, index) }}
              />
              <span
                className={comSub ? 'min-w-0 flex-1 truncate' : 'max-w-[140px] truncate'}
                title={fatia.sub ? `${fatia.rotulo} · ${fatia.sub}` : fatia.rotulo}
              >
                <span className="font-medium text-foreground/80">{fatia.rotulo}</span>
                {fatia.sub && <span className="text-muted-foreground/70"> · {fatia.sub}</span>}
              </span>{' '}
              <span className="shrink-0 tabular-nums">({formatar(fatia.quantidade)})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
