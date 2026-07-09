import { FileCheck2, Landmark, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brlCompacto, numero } from '@/lib/utils';
import type { ResumoTSE } from '@/lib/dashboard-data';

interface StatCardProps {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: React.ReactNode;
}

function StatCard({ titulo, valor, detalhe, icone }: StatCardProps) {
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

export function StatCards({ resumo }: { resumo: ResumoTSE }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        titulo="Valor total contratado"
        valor={brlCompacto(resumo.totalContratado)}
        detalhe={`${numero(resumo.totalContratos)} contratos registrados na fonte`}
        icone={<Landmark className="h-4 w-4" aria-hidden />}
      />
      <StatCard
        titulo="Contratos vigentes"
        valor={numero(resumo.contratosVigentes)}
        detalhe={`${brlCompacto(resumo.valorVigente)} em vigência hoje`}
        icone={<FileCheck2 className="h-4 w-4" aria-hidden />}
      />
      <StatCard
        titulo="Responsáveis designados"
        valor={numero(resumo.totalResponsaveis)}
        detalhe="servidores fiscais e gestores de contrato"
        icone={<Users className="h-4 w-4" aria-hidden />}
      />
    </div>
  );
}
