import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuncaoDonut, type FatiaFuncao } from '@/components/dashboard/funcao-donut';

interface FuncaoStatCardProps {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: React.ReactNode;
  contagens: FatiaFuncao[];
}

/** Como StatCard, mas com um mini-donut da distribuição por função vigente (FC-1..6, CJ-1..4). */
export function FuncaoStatCard({ titulo, valor, detalhe, icone, contagens }: FuncaoStatCardProps) {
  return (
    <Card className="transition-colors duration-200 hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{titulo}</CardTitle>
        <span className="text-muted-foreground">{icone}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{valor}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
        <div className="mt-3 border-t border-border pt-3">
          <FuncaoDonut contagens={contagens} />
        </div>
      </CardContent>
    </Card>
  );
}
