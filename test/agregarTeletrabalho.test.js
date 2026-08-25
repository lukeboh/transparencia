import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarTeletrabalho, diasEntre } from '../src/tse/agregarTeletrabalho.js';

function registro(overrides) {
  return {
    nome: 'Fulano de Tal',
    unidade: 'SEÇÃO X - COORDENADORIA Y - SECRETARIA Z',
    unidadeNiveis: ['SEÇÃO X', 'COORDENADORIA Y', 'SECRETARIA Z'],
    dataInicio: '01/01/2024',
    dataFim: '10/01/2024',
    ...overrides,
  };
}

test('diasEntre: conta os dias de forma inclusiva', () => {
  assert.equal(diasEntre('2024-01-01', '2024-01-10'), 10);
  assert.equal(diasEntre('2024-01-01', '2024-01-01'), 1);
});

test('agregarTeletrabalho: consolida um único período', () => {
  const { ranking } = agregarTeletrabalho([registro()], [], '2024-06-01');
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].nome, 'Fulano de Tal');
  assert.equal(ranking[0].diasConsolidados, 10);
  assert.equal(ranking[0].periodos[0].unidadeNiveis.length, 3);
});

test('agregarTeletrabalho: período sem data de fim conta até "hoje"', () => {
  const { ranking } = agregarTeletrabalho(
    [registro({ dataInicio: '01/01/2024', dataFim: null })],
    [],
    '2024-01-10',
  );
  assert.equal(ranking[0].diasConsolidados, 10);
  assert.equal(ranking[0].periodos[0].dataFim, null);
});

test('agregarTeletrabalho: soma os dias de múltiplos períodos da mesma pessoa (sem merge de sobreposição)', () => {
  const registros = [
    registro({ dataInicio: '01/01/2024', dataFim: '10/01/2024' }), // 10 dias
    registro({ dataInicio: '01/02/2024', dataFim: '05/02/2024' }), // 5 dias
  ];
  const { ranking } = agregarTeletrabalho(registros, [], '2024-06-01');
  assert.equal(ranking[0].diasConsolidados, 15);
  assert.equal(ranking[0].periodos.length, 2);
});

test('agregarTeletrabalho: cruza por nome normalizado com o ranking de responsáveis', () => {
  const rankingResponsaveis = [{ nome: 'FULANO DE TAL', papeis: ['Fiscal Titular'] }];
  const { ranking } = agregarTeletrabalho([registro()], rankingResponsaveis, '2024-06-01');
  assert.equal(ranking[0].responsavelRankingIndex, 0);
});

test('agregarTeletrabalho: quem não aparece no ranking de responsáveis fica com índice null', () => {
  const { ranking } = agregarTeletrabalho([registro()], [], '2024-06-01');
  assert.equal(ranking[0].responsavelRankingIndex, null);
});

test('agregarTeletrabalho: ordena o ranking por dias consolidados, decrescente', () => {
  const registros = [
    registro({ nome: 'Menos Dias', dataInicio: '01/01/2024', dataFim: '02/01/2024' }),
    registro({ nome: 'Mais Dias', dataInicio: '01/01/2024', dataFim: '31/01/2024' }),
  ];
  const { ranking } = agregarTeletrabalho(registros, [], '2024-06-01');
  assert.equal(ranking[0].nome, 'Mais Dias');
  assert.equal(ranking[1].nome, 'Menos Dias');
});
