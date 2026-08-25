import type { Metadata } from 'next';
import { FiscaisDashboard } from '@/components/pages/fiscais-dashboard';

export const metadata: Metadata = {
  title: 'Fiscais · Contratos TSE',
  description:
    'Ranking de servidores fiscais e gestores pelos maiores valores consolidados de contratos do TSE.',
};

export default function FiscaisPage() {
  return <FiscaisDashboard />;
}
