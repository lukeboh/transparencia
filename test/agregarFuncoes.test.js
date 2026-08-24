import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarFuncoes, construirMandatos, cobreVigencia } from '../src/tse/agregarFuncoes.js';

function movimento(overrides) {
  return {
    tipo: 'inicio',
    func: 'FC',
    nivel: 6,
    cargoTitulo: 'Chefe de Seção',
    unidade: 'da Secretaria de Administração',
    nome: 'Fulano de Tal',
    portaria: { numero: '1', ano: 2020, data: '2020-01-01', url: 'https://exemplo/1' },
    dataEfetiva: '2020-01-01',
    ...overrides,
  };
}

test('construirMandatos: pareia início e fim em um único mandato encerrado', () => {
  const movs = [
    movimento({ tipo: 'inicio', dataEfetiva: '2020-01-01', portaria: { numero: '1', url: 'https://x/1' } }),
    movimento({ tipo: 'fim', dataEfetiva: '2021-06-01', portaria: { numero: '2', url: 'https://x/2' } }),
  ];
  const mandatos = construirMandatos(movs);
  assert.equal(mandatos.length, 1);
  assert.equal(mandatos[0].nomeacaoData, '2020-01-01');
  assert.equal(mandatos[0].exoneracaoData, '2021-06-01');
  assert.equal(mandatos[0].vigente, false);
  assert.equal(mandatos[0].nomeacaoPortaria.numero, '1');
  assert.equal(mandatos[0].exoneracaoPortaria.numero, '2');
});

test('construirMandatos: início sem fim correspondente fica vigente', () => {
  const movs = [movimento({ tipo: 'inicio', dataEfetiva: '2024-03-01' })];
  const mandatos = construirMandatos(movs);
  assert.equal(mandatos.length, 1);
  assert.equal(mandatos[0].vigente, true);
  assert.equal(mandatos[0].exoneracaoData, null);
});

test('construirMandatos: fim sem início correspondente vira mandato com nomeação desconhecida', () => {
  const movs = [movimento({ tipo: 'fim', dataEfetiva: '2019-05-01' })];
  const mandatos = construirMandatos(movs);
  assert.equal(mandatos.length, 1);
  assert.equal(mandatos[0].nomeacaoData, null);
  assert.equal(mandatos[0].exoneracaoData, '2019-05-01');
  assert.equal(mandatos[0].vigente, false);
});

test('construirMandatos: dois mandatos sequenciais completos, em ordem cronológica', () => {
  const movs = [
    movimento({ tipo: 'inicio', nivel: 4, dataEfetiva: '2015-01-01' }),
    movimento({ tipo: 'fim', nivel: 4, dataEfetiva: '2016-01-01' }),
    movimento({ tipo: 'inicio', nivel: 6, dataEfetiva: '2016-02-01' }),
    movimento({ tipo: 'fim', nivel: 6, dataEfetiva: '2018-01-01' }),
  ];
  const mandatos = construirMandatos(movs);
  assert.equal(mandatos.length, 2);
  assert.equal(mandatos[0].nivel, 4);
  assert.equal(mandatos[1].nivel, 6);
});

test('construirMandatos: início novo sem exoneração localizada encerra o mandato anterior por aproximação', () => {
  const movs = [
    movimento({ tipo: 'inicio', nivel: 4, dataEfetiva: '2015-01-01' }),
    movimento({ tipo: 'inicio', nivel: 6, dataEfetiva: '2016-02-01' }),
  ];
  const mandatos = construirMandatos(movs);
  assert.equal(mandatos.length, 2);
  assert.equal(mandatos[0].vigente, false);
  assert.equal(mandatos[1].vigente, true);
});

test('cobreVigencia: mandato vigente cobre contrato sem data de fim conhecida ainda em curso', () => {
  const mandato = { nomeacaoData: '2020-01-01', exoneracaoData: null };
  assert.equal(cobreVigencia(mandato, '2021-01-01', '2022-01-01'), true);
});

test('cobreVigencia: contrato totalmente anterior à nomeação não é coberto', () => {
  const mandato = { nomeacaoData: '2022-01-01', exoneracaoData: null };
  assert.equal(cobreVigencia(mandato, '2020-01-01', '2021-01-01'), false);
});

test('cobreVigencia: contrato totalmente posterior à exoneração não é coberto', () => {
  const mandato = { nomeacaoData: '2018-01-01', exoneracaoData: '2019-01-01' };
  assert.equal(cobreVigencia(mandato, '2020-01-01', '2021-01-01'), false);
});

const contratosExemplo = [
  {
    id: '1',
    numero: '10/2020',
    valorGlobal: 1000,
    vigenciaInicio: '01/06/2020',
    vigenciaFim: '31/05/2021',
    responsaveis: [{ nome: 'Fulano de Tal', papel: 'Fiscal Titular' }],
  },
  {
    id: '2',
    numero: '20/2023',
    valorGlobal: 2000,
    vigenciaInicio: '01/01/2023',
    vigenciaFim: '31/12/2023',
    responsaveis: [{ nome: 'Fulano de Tal', papel: 'Fiscal Titular' }],
  },
];

test('agregarFuncoes: marca zeroFiscal para quem não aparece nos contratos', () => {
  const movs = [movimento({ nome: 'Ciclano Sem Contrato', tipo: 'inicio', dataEfetiva: '2020-01-01' })];
  const { servidores } = agregarFuncoes(movs, contratosExemplo);
  const ciclano = servidores.find((s) => s.nome === 'Ciclano Sem Contrato');
  assert.equal(ciclano.zeroFiscal, true);
});

test('agregarFuncoes: anexa a função correta ao contrato coberto pela vigência do mandato, e null ao que não é coberto', () => {
  const movs = [
    movimento({ nome: 'Fulano de Tal', tipo: 'inicio', dataEfetiva: '2020-01-01', nivel: 6 }),
    movimento({ nome: 'Fulano de Tal', tipo: 'fim', dataEfetiva: '2021-01-01', nivel: 6 }),
  ];
  const { servidores, rankingComFuncao } = agregarFuncoes(movs, contratosExemplo);

  const fulano = servidores.find((s) => s.nome === 'Fulano de Tal');
  assert.equal(fulano.zeroFiscal, false);
  assert.equal(fulano.mandatos.length, 1);

  const linha = rankingComFuncao.find((r) => r.nome === 'Fulano de Tal');
  const contrato1 = linha.contratos.find((c) => c.id === '1');
  const contrato2 = linha.contratos.find((c) => c.id === '2');
  assert.deepEqual(contrato1.funcaoNoContrato, { tipo: 'FC', nivel: 6, cargoTitulo: 'Chefe de Seção' });
  assert.equal(contrato2.funcaoNoContrato, null);
});
