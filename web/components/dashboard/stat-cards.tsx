'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileCheck2, Landmark, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { ContratosDialog } from '@/components/dashboard/contratos-dialog';
import { brlCompacto, numero } from '@/lib/utils';
import type { ContratoResumo, ResumoTSE } from '@/lib/dashboard-data';

export function StatCards({
  resumo,
  contratos,
  fonte,
}: {
  resumo: ResumoTSE;
  contratos: ContratoResumo[];
  fonte: string;
}) {
  const [vigentesAberto, setVigentesAberto] = useState(false);
  const vigentes = contratos
    .filter((c) => c.vigente)
    .sort((a, b) => b.valorGlobal - a.valorGlobal);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Existe consulta equivalente na fonte (unidade=TSE): link direto, nova aba. */}
      <a
        href={fonte}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir a consulta equivalente no Compras.gov.br"
        className="rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatCard
          titulo="Valor total contratado"
          valor={brlCompacto(resumo.totalContratado)}
          detalhe={`Emp: ${brlCompacto(resumo.totalEmpenhado || 0)} · Pg: ${brlCompacto(resumo.totalPago || 0)}`}
          icone={
            <span className="flex items-center gap-1">
              <Landmark className="h-4 w-4" aria-hidden />
              <ExternalLink className="h-3 w-3" aria-hidden />
            </span>
          }
        />
      </a>

      {/* Sem filtro de vigência via URL na fonte: modal auditável. */}
      <button
        type="button"
        onClick={() => setVigentesAberto(true)}
        aria-label="Listar contratos vigentes para auditoria"
        className="rounded-lg text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatCard
          titulo="Contratos vigentes"
          valor={numero(resumo.contratosVigentes)}
          detalhe={`${brlCompacto(resumo.valorVigente)} vigentes (Emp: ${brlCompacto(resumo.valorVigenteEmpenhado || 0)})`}
          icone={<FileCheck2 className="h-4 w-4" aria-hidden />}
        />
      </button>

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

      {vigentesAberto && (
        <ContratosDialog
          titulo="Contratos vigentes hoje"
          contratos={vigentes}
          open
          onClose={() => setVigentesAberto(false)}
        />
      )}
    </div>
  );
}
