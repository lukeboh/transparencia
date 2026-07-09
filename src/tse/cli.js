// CLI: lê contratos extraídos (JSON, ver README para o schema) e gera o
// ranking de responsáveis (fiscais/gestores) por valor consolidado.
//
// Uso:
//   node src/tse/cli.js --in data/tse_contratos.json --out data/ranking_responsaveis.csv
//   node src/tse/cli.js --papeis "Fiscal Titular,Fiscal Substituto" --top 20
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { rankResponsaveis } from './rankResponsaveis.js';

const { values } = parseArgs({
  options: {
    in: { type: 'string', default: 'data/tse_contratos.json' },
    out: { type: 'string', default: 'data/ranking_responsaveis.csv' },
    papeis: { type: 'string' }, // lista separada por vírgula; omitido = todos os papéis
    top: { type: 'string', default: '50' },
  },
});

function paraCsv(linhas) {
  const cabecalho = ['posicao', 'nome', 'matricula', 'papeis', 'valorConsolidado', 'quantidadeContratos'];
  const escapar = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const corpo = linhas.map((l, i) =>
    [i + 1, l.nome, l.matricula ?? '', l.papeis.join('; '), l.valorConsolidado.toFixed(2), l.quantidadeContratos]
      .map(escapar)
      .join(','),
  );
  return [cabecalho.join(','), ...corpo].join('\n') + '\n';
}

async function main() {
  const raw = await readFile(values.in, 'utf8');
  const contratos = JSON.parse(raw);

  const papeis = values.papeis ? values.papeis.split(',').map((p) => p.trim()) : undefined;
  const ranking = rankResponsaveis(contratos, { papeis });
  const top = Number(values.top);
  const recorte = ranking.slice(0, top);

  await writeFile(values.out, paraCsv(recorte), 'utf8');

  console.log(`${contratos.length} contratos processados. ${ranking.length} responsáveis distintos.`);
  console.log(`Top ${recorte.length} salvo em ${values.out}\n`);
  console.table(
    recorte.map((l, i) => ({
      '#': i + 1,
      nome: l.nome,
      papeis: l.papeis.join(', '),
      valorConsolidado: l.valorConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      contratos: l.quantidadeContratos,
    })),
  );
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
