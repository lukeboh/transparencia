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
import type { LinhaTeletrabalho } from '@/lib/dashboard-data';

interface PontoMes {
  mes: string; // "AAAA-MM"
  count: number;
  pct: number;
}

/** Meses "AAAA-MM" de `de` até `ate`, inclusive. */
function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  let [ano, mes] = de.split('-').map(Number);
  const [anoF, mesF] = ate.split('-').map(Number);
  while (ano < anoF || (ano === anoF && mes <= mesF)) {
    out.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return out;
}

/**
 * Série mês a mês: quantos servidores do `ranking` tinham um período de
 * teletrabalho ativo naquele mês, e a fração sobre o total de agentes públicos
 * do TSE (denominador FIXO — não há quadro histórico; ver nota no card).
 */
function serieMensal(
  ranking: LinhaTeletrabalho[],
  totalOrgao: number,
  mesAtual: string,
): PontoMes[] {
  let primeiro = mesAtual;
  for (const linha of ranking) {
    for (const p of linha.periodos) {
      const ym = (p.dataInicio ?? '').slice(0, 7);
      if (ym && ym < primeiro) primeiro = ym;
    }
  }
  return mesesEntre(primeiro, mesAtual).map((mes) => {
    let count = 0;
    for (const linha of ranking) {
      const ativo = linha.periodos.some((p) => {
        const ini = (p.dataInicio ?? '').slice(0, 7);
        if (!ini) return false;
        const fim = p.dataFim ? p.dataFim.slice(0, 7) : mesAtual;
        return ini <= mes && fim >= mes;
      });
      if (ativo) count += 1;
    }
    return { mes, count, pct: totalOrgao > 0 ? (count / totalOrgao) * 100 : 0 };
  });
}

const fmtPct = (v: number) => (v > 0 && v < 10 ? v.toFixed(1) : String(Math.round(v)));

function EvolucaoTooltip({
  active,
  payload,
  totalOrgao,
}: TooltipProps<number, string> & { totalOrgao: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PontoMes;
  return (
    <div className="space-y-1 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="text-sm font-semibold text-foreground">{mesAnoLongo(p.mes)}</p>
      <p>
        <span className="font-medium text-muted-foreground">Em teletrabalho: </span>
        <span className="font-semibold">{fmtPct(p.pct)}%</span>
      </p>
      <p className="text-muted-foreground">
        {numero(p.count)} de {numero(totalOrgao)} agentes públicos
      </p>
    </div>
  );
}

export function TeletrabalhoEvolucaoChart({
  ranking,
  totalOrgao,
  mesReferencia,
  somenteVigentes,
}: {
  /** O ranking já recortado pelos filtros da página. */
  ranking: LinhaTeletrabalho[];
  totalOrgao: number;
  /** "AAAA-MM" usado como "hoje" (mês do snapshot) — evita depender do relógio do cliente. */
  mesReferencia: string;
  somenteVigentes: boolean;
}) {
  const dados = useMemo(
    () => serieMensal(ranking, totalOrgao, mesReferencia),
    [ranking, totalOrgao, mesReferencia],
  );

  const pico = dados.reduce((max, p, i) => (p.pct > (dados[max]?.pct ?? 0) ? i : max), 0);
  // ~13 px/mês: cabe a série inteira (~7 anos) num card de desktop sem rolar;
  // abaixo disso o container rola no horizontal.
  const larguraMin = Math.max(560, dados.length * 13);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Teletrabalho no TSE, mês a mês</CardTitle>
        <CardDescription>
          Percentual de agentes públicos do TSE com período de teletrabalho ativo em cada mês, sobre o
          total de hoje ({numero(totalOrgao)} — não há quadro histórico, o denominador é fixo).
          {somenteVigentes
            ? ' Com “Somente vigentes hoje” ligado, conta só o histórico de quem está em teletrabalho agora — desligue para o quadro completo.'
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum período de teletrabalho no recorte atual.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div style={{ minWidth: larguraMin, height: 260 }}>
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
                      width={40}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      tickFormatter={(v: number) => `${Math.round(v)}%`}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--muted-foreground)', fillOpacity: 0.08 }}
                      content={<EvolucaoTooltip totalOrgao={totalOrgao} />}
                    />
                    <Bar
                      dataKey="pct"
                      fill="var(--chart-1)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
              <MoveHorizontal className="h-3 w-3 shrink-0" aria-hidden />
              Deslize o gráfico para o lado para ver todos os meses
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pico: {fmtPct(dados[pico].pct)}% em {mesAnoLongo(dados[pico].mes)} ({numero(dados[pico].count)}{' '}
              servidores).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
