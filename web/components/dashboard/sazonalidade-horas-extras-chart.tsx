'use client';

import { useMemo, useState } from 'react';
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
import { PillToggle } from '@/components/ui/pill-toggle';
import { InfoDica } from '@/components/ui/info-dica';
import { mesAnoCurto, mesAnoLongo, numero } from '@/lib/utils';
import { CATEGORIAS_UNIDADE, unidadesTopoDaCategoria, type CategoriaUnidade } from '@/lib/unidades-categoria';
import type { UnidadeNode } from '@/lib/dashboard-data';

const CORES_SLOTS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];
const COR_OUTROS = '#898781';
const COR_SEM_SUBDIVISAO = 'var(--chart-1)';
const MAX_SERIES = CORES_SLOTS.length;

interface Serie {
  id: string;
  nome: string;
  cor: string;
  total: number;
}

interface Resultado {
  dados: Record<string, number | string>[];
  series: Serie[];
}

/**
 * A altura da barra é sempre o total do TSE no mês (`arvore.consolidado`,
 * raiz — soma a árvore inteira uma única vez). O chip de nível só decide como
 * ela se subdivide: as até `MAX_SERIES` unidades de topo da categoria
 * (`unidadesTopoDaCategoria` já garante que não há ancestral/descendente da
 * mesma categoria somado duas vezes) ganham uma cor cada; o resto do total —
 * o rabo da própria categoria E tudo que é de outra categoria — cai em
 * "Outros". Sem nível (`unidades` null), a barra sai inteira, sem
 * subdivisão.
 */
function montarSerie(arvore: UnidadeNode, unidades: UnidadeNode[] | null, meses: string[]): Resultado {
  const totalPorMes = new Map(arvore.consolidado.horasExtrasPorMes.map((m) => [m.mes, m.horas]));

  if (!unidades) {
    const series: Serie[] = [
      {
        id: 'total',
        nome: 'Horas extras',
        cor: COR_SEM_SUBDIVISAO,
        total: [...totalPorMes.values()].reduce((s, h) => s + h, 0),
      },
    ];
    const dados = meses.map((mes) => ({ mes, total: totalPorMes.get(mes) ?? 0 }));
    return { dados, series };
  }

  const topo = unidades
    .map((u) => ({
      unidade: u,
      total: u.consolidado.horasExtrasPorMes.reduce((s, m) => s + m.horas, 0),
    }))
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_SERIES);

  const series: Serie[] = topo.map((u, i) => ({
    id: u.unidade.id,
    nome: u.unidade.sigla || u.unidade.nome,
    cor: CORES_SLOTS[i % CORES_SLOTS.length],
    total: u.total,
  }));

  const porMes = new Map<string, Record<string, number | string>>(
    meses.map((mes) => [mes, { mes, ...Object.fromEntries(series.map((s) => [s.id, 0])), outros: 0 }]),
  );
  for (const { unidade } of topo) {
    for (const { mes, horas } of unidade.consolidado.horasExtrasPorMes) {
      const linha = porMes.get(mes);
      if (linha) linha[unidade.id] = (Number(linha[unidade.id]) || 0) + horas;
    }
  }

  let outrosTotal = 0;
  for (const mes of meses) {
    const linha = porMes.get(mes)!;
    const somaTopo = topo.reduce((s, { unidade }) => s + (Number(linha[unidade.id]) || 0), 0);
    const outros = Math.max(0, (totalPorMes.get(mes) ?? 0) - somaTopo);
    linha.outros = outros;
    outrosTotal += outros;
  }
  if (outrosTotal > 0.5) {
    series.push({ id: 'outros', nome: 'Outros', cor: COR_OUTROS, total: outrosTotal });
  }

  return { dados: meses.map((mes) => porMes.get(mes)!), series };
}

function StackTooltip({ active, payload, series }: TooltipProps<number, string> & { series: Serie[] }) {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload as Record<string, number | string>;
  const total = series.reduce((s, serie) => s + (Number(linha[serie.id]) || 0), 0);
  return (
    <div className="max-w-[16rem] space-y-1 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="text-sm font-semibold text-foreground">{mesAnoLongo(String(linha.mes))}</p>
      {series
        .map((s) => ({ ...s, valor: Number(linha[s.id]) || 0 }))
        .filter((s) => s.valor > 0.5)
        .sort((a, b) => b.valor - a.valor)
        .map((s) => (
          <p key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.cor }} />
            <span className="min-w-0 truncate text-muted-foreground">{s.nome}:</span>
            <span className="ml-auto shrink-0 font-semibold">{numero(Math.round(s.valor))} h</span>
          </p>
        ))}
      <p className="border-t border-border pt-1 text-muted-foreground">Total: {numero(Math.round(total))} h</p>
    </div>
  );
}

export function SazonalidadeHorasExtrasChart({
  arvore,
  categoriaPorId,
  competencias,
}: {
  arvore: UnidadeNode;
  categoriaPorId: Map<string, CategoriaUnidade>;
  /** DashboardData.horasExtras.competencias — meses "AAAA-MM" ascendente com alguma hora extra estimada. */
  competencias: string[];
}) {
  const [nivel, setNivel] = useState<CategoriaUnidade | null>('secretaria');

  const unidades = useMemo(
    () => (nivel ? unidadesTopoDaCategoria(arvore, nivel, categoriaPorId) : null),
    [arvore, nivel, categoriaPorId],
  );

  const { dados, series } = useMemo(
    () => montarSerie(arvore, unidades, competencias),
    [arvore, unidades, competencias],
  );

  const alternarNivel = (id: CategoriaUnidade) => setNivel((atual) => (atual === id ? null : id));

  const larguraMin = Math.max(560, dados.length * 16);
  const semDados = dados.length === 0 || series.every((s) => s.total <= 0);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Horas extras por unidade, mês a mês</CardTitle>
        <CardDescription>
          Barra empilhada: o total de horas extras <strong>estimadas</strong> do TSE em cada mês — essa
          altura não muda. Os chips só decidem como ela se subdivide: as até {MAX_SERIES} unidades com mais
          horas no nível escolhido ganham uma cor cada, e o restante do total (inclusive de outros níveis)
          cai em &ldquo;Outros&rdquo;. Sem nenhum chip selecionado, a barra aparece inteira, sem subdivisão.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5" role="group" aria-label="Nível de subdivisão da barra">
          {CATEGORIAS_UNIDADE.map((c) => (
            <PillToggle key={c.id} pressionado={nivel === c.id} onClick={() => alternarNivel(c.id)}>
              <span title={c.descricao}>{c.rotulo}</span>
            </PillToggle>
          ))}
          <InfoDica titulo="Por que só um nível por vez?" alinhamento="esquerda">
            Uma coordenadoria fica dentro de uma secretaria — somar os dois níveis juntos contaria a mesma
            hora extra duas vezes. Clique de novo no chip ativo pra tirar a subdivisão e ver o total absoluto.
          </InfoDica>
        </div>

        {semDados ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma hora extra estimada no período.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div style={{ minWidth: larguraMin, height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados} margin={{ top: 16, right: 8, left: 4, bottom: 0 }} barCategoryGap={1}>
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
                      tickFormatter={(v: number) => numero(Math.round(v))}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--muted-foreground)', fillOpacity: 0.08 }}
                      content={<StackTooltip series={series} />}
                    />
                    {series.map((s, i) => (
                      <Bar
                        key={s.id}
                        dataKey={s.id}
                        stackId="he"
                        fill={s.cor}
                        maxBarSize={22}
                        radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
              <MoveHorizontal className="h-3 w-3 shrink-0" aria-hidden />
              Deslize o gráfico para o lado para ver todos os meses
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
              {series.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: s.cor }} />
                  <span title={s.nome}>{s.nome}</span>
                  <span className="tabular-nums">({numero(Math.round(s.total))} h)</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
