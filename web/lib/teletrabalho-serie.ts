// Série mês a mês de teletrabalho — compartilhada entre o gráfico de
// evolução de /teletrabalho (teletrabalho-evolucao-chart.tsx) e o de
// /sazonalidade (sazonalidade-servidores-chart.tsx), que só mudam a
// apresentação (linha de % vs. barra empilhada de contagem) em cima da mesma
// série.
import type { LinhaTeletrabalho } from './dashboard-data';

export interface PontoMesTeletrabalho {
  mes: string; // "AAAA-MM"
  count: number;
  pct: number;
}

/** Meses "AAAA-MM" de `de` até `ate`, inclusive. */
export function mesesEntre(de: string, ate: string): string[] {
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
 * teletrabalho ativo naquele mês, e a fração sobre `totalOrgao` — o quadro de
 * hoje do TSE inteiro ou, quando há filtro de lotação, só o dessa unidade.
 * Denominador FIXO — não há quadro histórico de pessoal, só de teletrabalho
 * (os períodos têm datas reais; o total de servidores, não).
 */
export function serieMensalTeletrabalho(
  ranking: LinhaTeletrabalho[],
  totalOrgao: number,
  mesAtual: string,
): PontoMesTeletrabalho[] {
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
