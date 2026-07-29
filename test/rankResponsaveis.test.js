import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankResponsaveis } from '../src/tse/rankResponsaveis.js';

const contratosExemplo = [
  {
    id: '1',
    numero: '10/2023',
    objeto: 'Serviço de limpeza',
    fornecedor: 'Empresa A',
    valorGlobal: 1000,
    responsaveis: [
      { nome: 'Maria Silva', matricula: '111', papel: 'Fiscal Titular' },
      { nome: 'João Souza', matricula: '222', papel: 'Gestor Titular' },
    ],
  },
  {
    id: '2',
    numero: '11/2023',
    objeto: 'Locação de veículos',
    fornecedor: 'Empresa B',
    valorGlobal: 5000,
    responsaveis: [
      { nome: 'Maria Silva', matricula: '111', papel: 'Fiscal Titular' },
      { nome: 'Ana Costa', matricula: '333', papel: 'Fiscal Substituto' },
    ],
  },
  {
    id: '3',
    numero: '12/2023',
    objeto: 'Manutenção predial',
    fornecedor: 'Empresa C',
    valorGlobal: 2000,
    // mesma pessoa em dois papéis no mesmo contrato: valor conta uma única vez
    responsaveis: [
      { nome: 'João Souza', matricula: '222', papel: 'Fiscal Titular' },
      { nome: 'João Souza', matricula: '222', papel: 'Gestor Titular' },
    ],
  },
];

test('soma o valor consolidado por pessoa e ordena decrescente', () => {
  const ranking = rankResponsaveis(contratosExemplo);

  assert.equal(ranking.length, 3);
  assert.equal(ranking[0].nome, 'Maria Silva');
  assert.equal(ranking[0].valorConsolidado, 6000);
  assert.equal(ranking[0].quantidadeContratos, 2);

  assert.equal(ranking[1].nome, 'Ana Costa');
  assert.equal(ranking[1].valorConsolidado, 5000);

  assert.equal(ranking[2].nome, 'João Souza');
  assert.equal(ranking[2].valorConsolidado, 3000);
  assert.equal(ranking[2].quantidadeContratos, 2);
  assert.deepEqual(ranking[2].papeis, ['Fiscal Titular', 'Gestor Titular']);
});

test('não conta valor duas vezes quando a mesma pessoa tem dois papéis no mesmo contrato', () => {
  const ranking = rankResponsaveis(contratosExemplo);
  const joao = ranking.find((p) => p.matricula === '222');
  assert.equal(joao.quantidadeContratos, 2); // contrato 1 + contrato 3, não 1+1+3
});

test('filtra por papel quando informado', () => {
  const ranking = rankResponsaveis(contratosExemplo, { papeis: ['Fiscal Titular'] });
  const nomes = ranking.map((p) => p.nome).sort();
  assert.deepEqual(nomes, ['João Souza', 'Maria Silva']);
});

test('agrupa por nome normalizado quando não há matrícula', () => {
  const contratos = [
    { id: 'a', numero: '1', valorGlobal: 100, valorEmpenhado: 80, valorPago: 50, responsaveis: [{ nome: 'josé  da silva', papel: 'Fiscal Titular' }] },
    { id: 'b', numero: '2', valorGlobal: 200, valorEmpenhado: 150, valorPago: 120, responsaveis: [{ nome: 'José da Silva', papel: 'Fiscal Titular' }] },
  ];
  const ranking = rankResponsaveis(contratos);
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].valorConsolidado, 300);
  assert.equal(ranking[0].valorEmpenhadoConsolidado, 230);
  assert.equal(ranking[0].valorPagoConsolidado, 170);
});
