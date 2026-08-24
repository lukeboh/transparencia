'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type TooltipProps } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { numero } from '@/lib/utils';
import type { ServidorFuncoes } from '@/lib/dashboard-data';

export interface FatiaFuncao {
  tipo: 'FC' | 'CJ' | 'SEM';
  nivel: number;
  quantidade: number;
}

// FC e CJ usam os dois primeiros slots da paleta categórica validada do
// projeto (--chart-1/--chart-2, ver web/app/globals.css); o nível dentro de
// cada função é ordinal (1 é o menos sênior, 6/4 o mais), então em vez de
// inventar 10 matizes novos (mais do que os 6 slots validados suportam),
// o nível vira uma rampa sequencial de claridade sobre o mesmo matiz —
// exatamente o padrão "um matiz, claro→escuro" para magnitude. "Sem função"
// usa o mesmo cinza de de-ênfase do "Outros" no donut de categorias.
const MATIZ_POR_TIPO: Record<'FC' | 'CJ', string> = {
  FC: 'var(--chart-1)',
  CJ: 'var(--chart-2)',
};
const NIVEL_MAX: Record<'FC' | 'CJ', number> = { FC: 6, CJ: 4 };
const COR_SEM_FUNCAO = '#898781';

function corFatia(fatia: FatiaFuncao) {
  if (fatia.tipo === 'SEM') return COR_SEM_FUNCAO;
  const max = NIVEL_MAX[fatia.tipo];
  const clareamento = max > 1 ? ((max - fatia.nivel) / (max - 1)) * 55 : 0;
  return `color-mix(in oklch, ${MATIZ_POR_TIPO[fatia.tipo]} ${100 - clareamento}%, var(--card))`;
}

function rotuloFatia(fatia: FatiaFuncao) {
  return fatia.tipo === 'SEM' ? 'Sem função' : `${fatia.tipo}-${fatia.nivel}`;
}

/**
 * Quantidade de servidores por função vigente hoje (tipo-nível), em ordem
 * fixa FC-1..6, CJ-1..4, com uma fatia "Sem função" para quem está no grupo
 * mas não tem função vigente na fonte primária agora (ex.: um "Zero Fiscal"
 * que só teve função no passado) — assim o donut sempre soma o total do
 * grupo recebido, sem precisar de um número à parte para explicar a
 * diferença. `funcaoAtual` vem da relação atual de agentes públicos (fonte
 * primária, mais confiável para "hoje" que o histórico de portarias).
 */
export function contarPorFuncaoAtual(servidores: ServidorFuncoes[]): FatiaFuncao[] {
  const contagem = new Map<string, FatiaFuncao>();
  let semFuncao = 0;
  for (const s of servidores) {
    const atual = s.funcaoAtual;
    if (!atual) {
      semFuncao += 1;
      continue;
    }
    const chave = `${atual.tipo}-${atual.nivel}`;
    const fatia = contagem.get(chave) ?? { tipo: atual.tipo, nivel: atual.nivel, quantidade: 0 };
    fatia.quantidade += 1;
    contagem.set(chave, fatia);
  }
  const fatias = [...contagem.values()].sort((a, b) =>
    a.tipo === b.tipo ? a.nivel - b.nivel : a.tipo.localeCompare(b.tipo),
  );
  if (semFuncao > 0) fatias.push({ tipo: 'SEM', nivel: 0, quantidade: semFuncao });
  return fatias;
}

function FuncaoTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const fatia = payload[0].payload as FatiaFuncao;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md text-xs">
      <span className="font-semibold">{rotuloFatia(fatia)}</span>{' '}
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

/** Donut: quantidade de servidores por função vigente (mais "Sem função"), sensível a qualquer filtro já aplicado a `contagens`. */
export function FuncaoDonut({ contagens, tamanho = 168 }: { contagens: FatiaFuncao[]; tamanho?: number }) {
  const [ativa, setAtiva] = useState<number | undefined>(undefined);
  const total = contagens.reduce((s, f) => s + f.quantidade, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Nenhum servidor no filtro atual.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative shrink-0" style={{ height: tamanho, width: tamanho }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<FuncaoTooltip />} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 20 }} />
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
              {contagens.map((fatia) => (
                <Cell key={`${fatia.tipo}-${fatia.nivel}`} fill={corFatia(fatia)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{numero(total)}</span>
          <span className="text-[10px] text-muted-foreground">servidores</span>
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
              style={{ backgroundColor: corFatia(fatia) }}
            />
            {rotuloFatia(fatia)} ({numero(fatia.quantidade)})
          </li>
        ))}
      </ul>
    </div>
  );
}
