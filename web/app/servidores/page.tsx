import type { Metadata } from 'next';
import { ServidoresDashboard } from '@/components/pages/servidores-dashboard';

export const metadata: Metadata = {
  title: 'Servidores (Agentes Públicos) · Contratos TSE',
  description:
    'Agentes públicos do TSE — fiscais e gestores de contrato pelos maiores valores consolidados, com histórico de funções comissionadas (FC/CJ).',
};

export default function ServidoresPage() {
  return <ServidoresDashboard />;
}
