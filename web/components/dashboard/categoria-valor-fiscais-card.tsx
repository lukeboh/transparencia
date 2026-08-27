import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { numero } from '@/lib/utils';
import { CATEGORIAS_VALOR, descricaoFaixa, type CategoriaValor, type CategoriaValorId } from '@/lib/categorias-valor';

export interface ContagemPorCategoriaValor {
  categoria: CategoriaValor;
  quantidade: number;
}

/**
 * Distribuição de fiscais pelas faixas de valor dos contratos que
 * fiscalizam — diferente de ContagemDonut/FuncaoDonut (partição exclusiva),
 * aqui a mesma pessoa pode contar em mais de uma faixa (fiscaliza contratos
 * de valores diferentes), então a soma das barras pode passar do total de
 * fiscais — por isso barras (% de `totalBase` cada) em vez de donut.
 */
export function CategoriaValorFiscaisCard({
  titulo,
  detalhe,
  icone,
  contagens,
  totalBase,
}: {
  titulo: string;
  detalhe: string;
  icone: React.ReactNode;
  contagens: ContagemPorCategoriaValor[];
  totalBase: number;
}) {
  return (
    <Card className="transition-colors duration-200 hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{titulo}</CardTitle>
        <span className="text-muted-foreground">{icone}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {contagens.map(({ categoria, quantidade }) => (
          <div key={categoria.id} className="flex items-center gap-2" title={`${categoria.nome} (${descricaoFaixa(categoria)})`}>
            <span className="w-9 shrink-0 text-xs font-semibold tabular-nums" style={{ color: categoria.cor }}>
              {categoria.simbolo}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${totalBase > 0 ? Math.min(100, (quantidade / totalBase) * 100) : 0}%`,
                  backgroundColor: categoria.cor,
                }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {numero(quantidade)}
            </span>
          </div>
        ))}
        <p className="mt-1.5 text-center text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}

/** Conta, por faixa de valor, quantos responsáveis do ranking têm ao menos um contrato naquela faixa (contagem não-exclusiva, ver acima). */
export function contarFiscaisPorFaixaValor(
  ranking: { contratos: { i: number }[] }[],
  categoriaIdPorIndiceContrato: (i: number) => CategoriaValorId,
): ContagemPorCategoriaValor[] {
  const contagem = new Map(CATEGORIAS_VALOR.map((c) => [c.id, 0]));
  for (const responsavel of ranking) {
    const faixasVistas = new Set<CategoriaValorId>();
    for (const { i } of responsavel.contratos) {
      faixasVistas.add(categoriaIdPorIndiceContrato(i));
    }
    for (const id of faixasVistas) {
      contagem.set(id, (contagem.get(id) ?? 0) + 1);
    }
  }
  return CATEGORIAS_VALOR.map((categoria) => ({ categoria, quantidade: contagem.get(categoria.id) ?? 0 }));
}
