import Link from 'next/link';
import { FileCheck2, Landmark, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { brlCompacto, numero } from '@/lib/utils';
import type { ResumoTSE } from '@/lib/dashboard-data';

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
      <Link
        href="/responsaveis"
        aria-label="Ver dashboard de responsáveis"
        className="rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatCard
          titulo="Responsáveis designados"
          valor={numero(resumo.totalResponsaveis)}
          detalhe="ver ranking por valor sob responsabilidade →"
          icone={<Users className="h-4 w-4" aria-hidden />}
        />
      </Link>
    </div>
  );
}
