import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapearColunas,
  linhaParaContrato,
  parseResponsaveis,
  validarAmostra,
  COL,
} from '../src/tse/scrapeContratos.js';

// <thead> real da página em 2026-09 (recortado só nos rótulos que consumimos,
// nas posições certas). O segundo <thead> clonado repete tudo — mapearColunas
// deve pegar a 1ª ocorrência.
const THEAD = `
<thead><tr>
${[
  'Órgão', 'Unidade da Prestação do Serviço', 'Unidade Gestora Origem do Contrato',
  'Unidades Descentralizadas', 'Receita / Despesa', 'Número Contrato', 'PNCP',
  'Unidade Realizadora da Compra', 'Número da Compra', 'Modalidade da Compra',
  'Amparo Legal', 'Unidades Requisitantes', 'Tipo', 'Categoria', 'Subcategoria',
  'Fornecedor', 'Processo', 'Objeto', 'Informações Complementares', 'Vig. Início',
  'Vig. Fim', 'Situação', 'Valor Global', 'Núm. Parcelas', 'Valor Parcela',
  'Valor Acumulado', 'Total Despesas Acessórias', 'Histórico', 'Despesas Acessórias',
  'Empenhos', 'Faturas', 'Garantias', 'Itens', 'Prepostos', 'Responsáveis',
  'Instrumentos de Cobrança', 'Terceirizados', 'Arquivos', 'Decreto 11.430', 'Ações',
].map((r) => `<th>${r}</th>`).join('')}
</tr></thead>
<thead><tr><th>Órgão</th><th>Valor Global</th></tr></thead>
`;

test('mapearColunas: deriva os índices do <thead> (layout de 2026-09)', () => {
  const col = mapearColunas(THEAD);
  assert.equal(col.ORGAO, 0);
  assert.equal(col.NUMERO, 5);
  assert.equal(col.VIG_INICIO, 19);
  assert.equal(col.VALOR_GLOBAL, 22);
  assert.equal(col.EMPENHOS, 29);
  assert.equal(col.RESPONSAVEIS, 34);
  assert.equal(col.ACOES, 39);
});

test('mapearColunas: rótulo ausente → cai no COL fixo com aviso', () => {
  const col = mapearColunas('<thead><tr><th>Órgão</th><th>Coisa Nova</th></tr></thead>');
  assert.deepEqual(col, COL);
});

test('parseResponsaveis: tabela aninhada CPF/Nome/Tipo (com <thead>)', () => {
  const cell = `<span><table><thead><tr><th>CPF</th><th>Nome</th><th>Tipo</th></tr></thead><tbody>
    <tr> <td> ***.724.491-** </td> <td> JANAÍNA RIBEIRO PENNA PEREIRA PAIVA </td> <td> Fiscal Titular </td> </tr>
    <tr> <td> ***.775.801-** </td> <td> MARIA ÉLIS FRANCO SOARES </td> <td> Fiscal Substituto </td> </tr>
  </tbody></table></span>`;
  const r = parseResponsaveis(cell);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {
    matricula: '***.724.491-**',
    nome: 'JANAÍNA RIBEIRO PENNA PEREIRA PAIVA',
    papel: 'Fiscal Titular',
  });
});

test('linhaParaContrato: usa o mapa de colunas passado', () => {
  const col = mapearColunas(THEAD);
  const row = new Array(40).fill('');
  row[col.NUMERO] = '00014/2019';
  row[col.OBJETO] = 'aquisição de X';
  row[col.FORNECEDOR] = 'ART STILO LTDA';
  row[col.VALOR_GLOBAL] = 'R$ 2.190,00';
  row[col.VIG_INICIO] = '15/02/2019';
  row[col.VIG_FIM] = '15/02/2020';
  row[col.ACOES] = '<a href="https://contratos.comprasnet.gov.br/transparencia/contratos/5877">ver</a>';
  row[col.RESPONSAVEIS] = '<table><tbody><tr><td>***.724.491-**</td><td>JANAÍNA R P P PAIVA</td><td>Fiscal Titular</td></tr></tbody></table>';
  const c = linhaParaContrato(row, col);
  assert.equal(c.numero, '00014/2019');
  assert.equal(c.valorGlobal, 2190);
  assert.equal(c.id, '5877');
  assert.equal(c.responsaveis[0].papel, 'Fiscal Titular');
});

test('validarAmostra: aborta quando papel/nome trazem CPF ou dígito (coluna deslocada)', () => {
  const ok = [{ id: '1', valorGlobal: 100, responsaveis: [{ nome: 'FULANO', papel: 'Fiscal Titular' }] }];
  assert.doesNotThrow(() => validarAmostra(ok));
  const ruim = [{ id: '1', valorGlobal: 100, responsaveis: [{ nome: 'FULANO ***.111.222-**', papel: 'BELTRANO' }] }];
  assert.throws(() => validarAmostra(ruim), /deslocado/);
  const semId = Array.from({ length: 10 }, () => ({ id: undefined, valorGlobal: 0, responsaveis: [] }));
  assert.throws(() => validarAmostra(semId), /Ações/);
});
