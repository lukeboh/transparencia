import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuncaoDonut, type FatiaFuncao } from '@/components/dashboard/funcao-donut';

interface FuncaoStatCardProps {
  titulo: string;
  detalhe: string;
  icone: React.ReactNode;
  contagens: FatiaFuncao[];
}

/** Como StatCard, mas o número vira o total no centro do donut da distribuição por função (FC-1..6, CJ-1..4, Sem função). */
export function FuncaoStatCard({ titulo, detalhe, icone, contagens }: FuncaoStatCardProps) {
  return (
    <Card className="transition-colors duration-200 hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{titulo}</CardTitle>
        <span className="text-muted-foreground">{icone}</span>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <FuncaoDonut contagens={contagens} />
        <p className="text-center text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}
