import type { Metadata } from 'next';
import { SazonalidadeDashboard } from '@/components/pages/sazonalidade-dashboard';

export const metadata: Metadata = {
  title: 'Sazonalidade · Contratos TSE',
  description:
    'Evolução mês a mês do quadro de servidores e teletrabalho, e das horas extras estimadas por unidade do TSE.',
};

export default function SazonalidadePage() {
  return <SazonalidadeDashboard />;
}
