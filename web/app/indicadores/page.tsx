import type { Metadata } from 'next';
import { IndicadoresDashboard } from '@/components/pages/indicadores-dashboard';

export const metadata: Metadata = {
  title: 'Indicadores por unidade · Contratos TSE',
  description:
    'Relações percentuais comparáveis entre as unidades do TSE — servidores, funções, fiscais e teletrabalho sobre diferentes denominadores, com colunas configuráveis e ordenação por qualquer indicador.',
};

export default function IndicadoresPage() {
  return <IndicadoresDashboard />;
}
