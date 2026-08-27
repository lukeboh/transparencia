import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContagemDonut, type FatiaContagem } from '@/components/dashboard/contagem-donut';

interface ContagemStatCardProps {
  titulo: string;
  detalhe: string;
  icone: React.ReactNode;
  fatias: FatiaContagem[];
  unidadeSingular?: string;
  unidadePlural?: string;
}

/** Como FuncaoStatCard, mas para distribuições categóricas genéricas (não FC/CJ) via ContagemDonut. */
export function ContagemStatCard({ titulo, detalhe, icone, fatias, unidadeSingular, unidadePlural }: ContagemStatCardProps) {
  return (
    <Card className="transition-colors duration-200 hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{titulo}</CardTitle>
        <span className="text-muted-foreground">{icone}</span>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <ContagemDonut fatias={fatias} unidadeSingular={unidadeSingular} unidadePlural={unidadePlural} />
        <p className="text-center text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}
