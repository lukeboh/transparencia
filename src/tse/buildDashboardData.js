// Gera web/lib/dashboard-data.ts a partir de data/tse_contratos.json:
// agregados reais (resumo, evolução anual e divisão por categoria) que o
// dashboard Next.js importa como constante tipada — sem fetch em runtime.
//
// Uso: node src/tse/buildDashboardData.js [entrada] [saida]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entrada = process.argv[2] ?? path.join(raiz, 'data/tse_contratos.json');
const saida = process.argv[3] ?? path.join(raiz, 'web/lib/dashboard-data.ts');

const MAX_FATIAS = 5; // demais categorias somadas em "Outros"

function anoDe(dataBr) {
  const m = /(\d{4})$/.exec(dataBr ?? '');
  return m ? Number(m[1]) : undefined;
}

function paraDataISO(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

async function main() {
  const contratos = JSON.parse(await readFile(entrada, 'utf8'));
  const hoje = new Date().toISOString().slice(0, 10);

  const totalContratado = contratos.reduce((s, c) => s + c.valorGlobal, 0);
  const vigentes = contratos.filter((c) => (paraDataISO(c.vigenciaFim) ?? '') >= hoje);
  const responsaveis = new Set(
    contratos.flatMap((c) => c.responsaveis.map((r) => r.matricula || r.nome)),
  );

  const porAno = new Map();
  for (const c of contratos) {
    const ano = anoDe(c.vigenciaInicio);
    if (!ano) continue;
    const acc = porAno.get(ano) ?? { ano, valor: 0, contratos: 0 };
    acc.valor += c.valorGlobal;
    acc.contratos += 1;
    porAno.set(ano, acc);
  }
  // Anos iniciais com somas simbólicas (contratos de cessão registrados por
  // R$ 1,11 etc.) só esticam o eixo sem informação; corta a cauda à esquerda
  // até o primeiro ano com valor relevante.
  const ordenadoPorAno = [...porAno.values()].sort((a, b) => a.ano - b.ano);
  const primeiroRelevante = ordenadoPorAno.findIndex((p) => p.valor >= 10_000);
  const evolucao = primeiroRelevante === -1 ? ordenadoPorAno : ordenadoPorAno.slice(primeiroRelevante);

  const porCategoria = new Map();
  for (const c of contratos) {
    const nome = c.categoria || 'Não informada';
    const acc = porCategoria.get(nome) ?? { categoria: nome, valor: 0, contratos: 0 };
    acc.valor += c.valorGlobal;
    acc.contratos += 1;
    porCategoria.set(nome, acc);
  }
  const ordenadas = [...porCategoria.values()].sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, MAX_FATIAS);
  const resto = ordenadas.slice(MAX_FATIAS);
  const categorias = resto.length
    ? [...principais, {
        categoria: 'Outros',
        valor: resto.reduce((s, c) => s + c.valor, 0),
        contratos: resto.reduce((s, c) => s + c.contratos, 0),
      }]
    : principais;

  const dados = {
    geradoEm: new Date().toISOString(),
    fonte: 'https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE',
    resumo: {
      totalContratado,
      totalContratos: contratos.length,
      contratosVigentes: vigentes.length,
      valorVigente: vigentes.reduce((s, c) => s + c.valorGlobal, 0),
      totalResponsaveis: responsaveis.size,
    },
    evolucao,
    categorias,
  };

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

export interface DashboardData {
  geradoEm: string;
  fonte: string;
  resumo: ResumoTSE;
  evolucao: PontoEvolucao[];
  categorias: FatiaCategoria[];
}

export const dashboardData: DashboardData = ${JSON.stringify(dados, null, 2)};
`;

  await writeFile(saida, ts, 'utf8');
  console.log(`Gerado ${saida}`);
  console.log(`  ${contratos.length} contratos · ${evolucao.length} anos · ${categorias.length} fatias de categoria`);
}

main().catch((err) => {
  console.error('Falha ao gerar dados do dashboard:', err);
  process.exit(1);
});
