import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCardProps {
  titulo: React.ReactNode;
  valor: string;
  detalhe: React.ReactNode;
  icone: React.ReactNode;
}

export function StatCard({ titulo, valor, detalhe, icone }: StatCardProps) {
  return (
    <Card className="transition-colors duration-200 hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground">{titulo}</CardTitle>
        <span className="text-muted-foreground">{icone}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{valor}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}
