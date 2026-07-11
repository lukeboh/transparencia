// Gera web/lib/dashboard-data.ts a partir de data/tse_contratos.json:
// snapshot dos agregados que o dashboard usa como carga inicial instantânea
// (em runtime o app se atualiza sozinho pela rota /api/tse/dados).
//
// Uso: node src/tse/buildDashboardData.js [entrada] [saida]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agregarDashboard } from './agregarDashboard.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entrada = process.argv[2] ?? path.join(raiz, 'data/tse_contratos.json');
const saida = process.argv[3] ?? path.join(raiz, 'web/lib/dashboard-data.ts');

async function main() {
  const contratos = JSON.parse(await readFile(entrada, 'utf8'));
  const dados = agregarDashboard(contratos);

  const ts = `// Gerado por src/tse/buildDashboardData.js — não editar manualmente.
// Fonte: ${dados.fonte}
// Extraído em: ${dados.geradoEm}

export interface ResumoTSE {
  totalContratado: number;
  totalContratos: number;
  contratosVigentes: number;
  valorVigente: number;
  totalResponsaveis: number;
}

export interface PontoEvolucao {
  ano: number;
  valor: number;
  contratos: number;
}

export interface FatiaCategoria {
  categoria: string;
  valor: number;
  contratos: number;
}

export interface ContratoResumo {
  id: string;
  numero: string;
  objeto: string;
  fornecedor: string;
  valorGlobal: number;
  ano: number | null;
  categoria: string;
  vigente: boolean;
}

export interface ContratoDoResponsavel {
  /** Índice na tabela DashboardData.contratos. */
  i: number;
  papeis: string[];
}

export interface LinhaRanking {
  nome: string;
  papeis: string[];
  valorConsolidado: number;
  quantidadeContratos: number;
  contratos: ContratoDoResponsavel[];
}

export interface ResponsaveisData {
  total: number;
  emContratosVigentes: number;
  medianaValor: number;
  ranking: LinhaRanking[];
}

export interface DashboardData {
  geradoEm: string;
  fonte: string;
  resumo: ResumoTSE;
  evolucao: PontoEvolucao[];
  categorias: FatiaCategoria[];
  contratos: ContratoResumo[];
  responsaveis: ResponsaveisData;
}

/** URL do contrato detalhado na consulta pública do Comprasnet. */
export function urlContrato(id: string) {
  return \`https://contratos.comprasnet.gov.br/transparencia/contratos/\${id}\`;
}

export const dashboardData: DashboardData = ${JSON.stringify(dados)};
`;

  await writeFile(saida, ts, 'utf8');
  console.log(`Gerado ${saida}`);
  console.log(
    `  ${contratos.length} contratos · ${dados.evolucao.length} anos · ${dados.categorias.length} fatias de categoria`,
  );
}

main().catch((err) => {
  console.error('Falha ao gerar dados do dashboard:', err);
  process.exit(1);
});
