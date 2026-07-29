import type { Metadata } from 'next';
import { ResponsaveisDashboard } from '@/components/pages/responsaveis-dashboard';

export const metadata: Metadata = {
  title: 'Responsáveis · Contratos TSE',
  description:
    'Ranking de servidores fiscais e gestores pelos maiores valores consolidados de contratos do TSE.',
};

export default function ResponsaveisPage() {
  return <ResponsaveisDashboard />;
}
