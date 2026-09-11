'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
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
import { MoveHorizontal } from 'lucide-react';
import { mesAnoCurto, mesAnoLongo, numero } from '@/lib/utils';
import { serieMensalTeletrabalho } from '@/lib/teletrabalho-serie';
import type { LinhaTeletrabalho } from '@/lib/dashboard-data';

const COR_TELETRABALHO = 'var(--chart-1)';
// Mesmo cinza de-ênfase de "Outros" no donut de categorias — aqui é "o
// resto do quadro" (quem não está em teletrabalho naquele mês).
const COR_DEMAIS = '#898781';

interface PontoStack {
  mes: string;
  teletrabalho: number;
  demais: number;
}

function StackTooltip({ active, payload, totalOrgao }: TooltipProps<number, string> & { totalOrgao: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PontoStack;
  return (
    <div className="space-y-1 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="text-sm font-semibold text-foreground">{mesAnoLongo(p.mes)}</p>
      <p className="flex items-center gap-1.5">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: COR_TELETRABALHO }} />
        <span className="text-muted-foreground">Em teletrabalho:</span>
        <span className="font-semibold">{numero(p.teletrabalho)}</span>
      </p>
      <p className="flex items-center gap-1.5">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: COR_DEMAIS }} />
        <span className="text-muted-foreground">Demais servidores:</span>
        <span className="font-semibold">{numero(p.demais)}</span>
      </p>
      <p className="border-t border-border pt-1 text-muted-foreground">{numero(totalOrgao)} agentes públicos hoje</p>
    </div>
  );
}

export function SazonalidadeServidoresChart({
  ranking,
  totalOrgao,
  mesReferencia,
}: {
  /** DashboardData.teletrabalho.ranking, sem filtro — o quadro do TSE inteiro. */
  ranking: LinhaTeletrabalho[];
  /** Quadro de agentes públicos de HOJE — não há série histórica de pessoal, então é um denominador fixo (ver descrição do card). */
  totalOrgao: number;
  /** "AAAA-MM" usado como "hoje" (mês do snapshot). */
  mesReferencia: string;
}) {
  const dados = useMemo<PontoStack[]>(() => {
    const serie = serieMensalTeletrabalho(ranking, totalOrgao, mesReferencia);
    return serie.map((p) => ({ mes: p.mes, teletrabalho: p.count, demais: Math.max(0, totalOrgao - p.count) }));
  }, [ranking, totalOrgao, mesReferencia]);

  const larguraMin = Math.max(560, dados.length * 13);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Servidores e teletrabalho, mês a mês</CardTitle>
        <CardDescription>
          Barra empilhada: quantos dos {numero(totalOrgao)} agentes públicos do TSE <strong>hoje</strong> tinham
          período de teletrabalho ativo em cada mês, contra os demais. O total ({numero(totalOrgao)}) é o
          quadro atual, não uma série histórica de pessoal — a fonte não publica o quantitativo total de
          servidores por mês no passado, só quem estava em teletrabalho (datas reais de início/fim de cada
          período). Considera apenas o <strong>regime formal de teletrabalho</strong> — não inclui o
          trabalho remoto emergencial da pandemia (2020–2021).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dados.length === 0 || totalOrgao === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum período de teletrabalho registrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div style={{ minWidth: larguraMin, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados} margin={{ top: 16, right: 8, left: 4, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={mesAnoCurto}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      width={48}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      tickFormatter={(v: number) => numero(v)}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--muted-foreground)', fillOpacity: 0.08 }}
                      content={<StackTooltip totalOrgao={totalOrgao} />}
                    />
                    <Bar dataKey="teletrabalho" stackId="quadro" fill={COR_TELETRABALHO} maxBarSize={22} />
                    <Bar dataKey="demais" stackId="quadro" fill={COR_DEMAIS} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
              <MoveHorizontal className="h-3 w-3 shrink-0" aria-hidden />
              Deslize o gráfico para o lado para ver todos os meses
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: COR_TELETRABALHO }} />
                Em teletrabalho
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: COR_DEMAIS }} />
                Demais servidores (quadro atual)
              </li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
