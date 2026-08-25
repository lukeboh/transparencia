// Extrai a árvore hierárquica de unidades do TSE (organograma oficial).
//
// https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/lotacao-geral/sem-assinatura/agrupamento-por-unidade
//
// Essa página pública é só uma casca HTML que renderiza um orgchart jQuery
// (estaticos/js/tseorgachart.js) apontado para um endpoint JSON — descoberto
// lendo esse script. Um GET simples nesse endpoint já devolve a árvore
// inteira (~265 unidades, profundidade 5) em uma única resposta, sem
// sessão/CSRF, igual às outras duas fontes de `transparenciaDadosServidores`
// (scrapeAgentesPublicos.js, scrapeTeletrabalho.js) — mas ainda mais simples
// porque a resposta já é JSON, sem parsing de HTML.
//
// Cada nó tem: id, nome (nome completo — bate, módulo espaço/caixa, com o
// campo `lotacao` já raspado em scrapeAgentesPublicos.js), name (sigla),
// parentidAsString (id do pai, ausente na raiz), children? e title (string
// numérica = agentes públicos lotados DIRETAMENTE nesse nó, ou "DIV" quando
// são 0 — um sinalizador da própria UI da fonte, usado só como checagem
// cruzada em agregarUnidades.js, nunca como fonte de verdade das nossas
// contagens).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = 'https://transparencia.tse.jus.br/transparenciaDadosServidores/smvc/relatorios/lotacao-geral/json/sem-assinatura/agrupamento-por-unidade';

async function scrapeUnidades() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Falha ao buscar árvore de unidades (status ${res.status})`);
  const arvore = await res.json();
  if (!arvore || typeof arvore !== 'object' || !('nome' in arvore)) {
    throw new Error('Resposta inesperada da árvore de unidades — layout da fonte pode ter mudado.');
  }
  return arvore;
}

function contarNos(no) {
  const filhos = no.children ?? [];
  return 1 + filhos.reduce((soma, filho) => soma + contarNos(filho), 0);
}

async function main() {
  const out = process.argv[2] ?? 'data/tse_unidades.json';

  console.log('Extraindo árvore de unidades do TSE...');
  const arvore = await scrapeUnidades();

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(arvore, null, 2), 'utf8');
  console.log(`Salvo em ${out} (${contarNos(arvore)} unidades).`);
}

const isMain = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
);

if (isMain) {
  main().catch((err) => {
    console.error('Falha na extração:', err);
    process.exit(1);
  });
}

export { scrapeUnidades, contarNos };
