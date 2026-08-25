import type { Metadata } from 'next';
import { TeletrabalhoDashboard } from '@/components/pages/teletrabalho-dashboard';

export const metadata: Metadata = {
  title: 'Teletrabalho · Contratos TSE',
  description:
    'Dias em regime de teletrabalho por servidor do TSE, com a estrutura completa da lotação de cada período.',
};

export default function TeletrabalhoPage() {
  return <TeletrabalhoDashboard />;
}
