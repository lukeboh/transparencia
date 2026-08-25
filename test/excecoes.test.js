import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarExcecoes } from '../src/tse/excecoes.js';

const contratos = [
  { id: '1', numero: '10/2023', valorGlobal: 2_500_000_000 },
  { id: '2', numero: '11/2023', valorGlobal: 5000 },
];

test('sobrescreve o campo indicado no contrato cujo id casa com a exceção', () => {
  const excecoes = [
    {
      id: '1',
      overrides: { valorGlobal: 2_500_000 },
      motivo: 'Erro de digitação na fonte.',
      fonte: 'https://exemplo.gov.br/contrato/1',
    },
  ];

  const [c1, c2] = aplicarExcecoes(contratos, excecoes);

  assert.equal(c1.valorGlobal, 2_500_000);
  assert.deepEqual(c1._correcoes, [
    {
      campo: 'valorGlobal',
      valorOriginal: 2_500_000_000,
      valorCorrigido: 2_500_000,
      motivo: 'Erro de digitação na fonte.',
      fonte: 'https://exemplo.gov.br/contrato/1',
    },
  ]);
  assert.equal(c2.valorGlobal, 5000);
  assert.equal(c2._correcoes, undefined);
});

test('sem exceções, retorna os contratos inalterados (mesma referência)', () => {
  assert.equal(aplicarExcecoes(contratos, []), contratos);
  assert.equal(aplicarExcecoes(contratos), contratos);
});

test('exceção com id que não existe em nenhum contrato não tem efeito', () => {
  const [c1, c2] = aplicarExcecoes(contratos, [
    { id: '999', overrides: { valorGlobal: 1 }, motivo: 'x', fonte: 'y' },
  ]);
  assert.equal(c1.valorGlobal, 2_500_000_000);
  assert.equal(c2.valorGlobal, 5000);
});
