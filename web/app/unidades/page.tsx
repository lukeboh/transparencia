import type { Metadata } from 'next';
import { UnidadesDashboard } from '@/components/pages/unidades-dashboard';

export const metadata: Metadata = {
  title: 'Unidades e Lotações · Contratos TSE',
  description: 'Estrutura hierárquica do TSE, do tribunal até a última seção, com servidores, funções, fiscais e teletrabalho por unidade.',
};

export default function UnidadesPage() {
  return <UnidadesDashboard />;
}
