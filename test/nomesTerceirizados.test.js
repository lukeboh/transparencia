import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarNomePosto, canonicalContrato } from '../src/tse/nomesTerceirizados.js';

test('canonicalContrato: "1/2025" e "01/2025" e "00001/2025" viram o mesmo id', () => {
  assert.equal(canonicalContrato('1/2025'), '1/2025');
  assert.equal(canonicalContrato('01/2025'), '1/2025');
  assert.equal(canonicalContrato('00001/2025'), '1/2025');
  assert.equal(canonicalContrato(' 08 / 2025 '), '8/2025');
  assert.equal(canonicalContrato('00039/2019'), '39/2019');
  assert.equal(canonicalContrato('13/22'), '13/2022');
  assert.equal(canonicalContrato('2025NE000340'), '2025NE000340'); // sem barra: inalterado
  assert.equal(canonicalContrato(''), '');
});

test('nome limpo + posto na coluna: passa direto', () => {
  const r = separarNomePosto('ADELCI RIBEIRO MONTEIRO JUNIOR', 'Desenvolvedor Back-end - Sênior');
  assert.equal(r.semNome, false);
  assert.equal(r.nome, 'ADELCI RIBEIRO MONTEIRO JUNIOR');
  assert.equal(r.posto, 'Desenvolvedor Back-end - Sênior');
});

test('cargo grudado no nome (coluna posto vazia): corta pelo léxico', () => {
  const casos = [
    ['ABADIA CORREA CORTE Técnico em Secretariado - Nível II - 44 h - CBO 3515-05', 'ABADIA CORREA CORTE'],
    ['ACASSIANE CAVALCANTI ALVIM Engenharia de Software', 'ACASSIANE CAVALCANTI ALVIM'],
    ['ANDERSON VICTOR DOS SANTOS MAIA Administração e Suporte de Infraestrutura PLENO', 'ANDERSON VICTOR DOS SANTOS MAIA'],
    ['ADRIANA JUNQUEIRA BIANCHINI SECRETÁRIA DE REDAÇÃO EM RADIO OU TV', 'ADRIANA JUNQUEIRA BIANCHINI'],
    ['MARIA D’ABADIA GOMES Garçom - 44 h - CBO 5134-05', 'MARIA D’ABADIA GOMES'],
    ['AURO WAINE VIANA DE MORAIS JÚNIOR Auxiliar de Higienização', 'AURO WAINE VIANA DE MORAIS JÚNIOR'],
  ];
  for (const [entrada, esperado] of casos) {
    const r = separarNomePosto(entrada, '');
    assert.equal(r.semNome, false, entrada);
    assert.equal(r.nome, esperado, entrada);
    assert.ok(r.posto.length > 0, `posto extraído de: ${entrada}`);
  }
});

test('linha que é só cargo (sem nome) → semNome', () => {
  for (const s of [
    'Análise de Business Intelligence',
    'Condução de Veículo Executivo - Pool',
    'Auxiliar de Higienização',
    'ANALISTA WEB',
    'MARCENEIRO',
  ]) {
    assert.equal(separarNomePosto(s, '').semNome, true, s);
  }
});

test('empregado vazio + nome no fim da coluna empresa (competências ruins de 2023): resgata', () => {
  const r = separarNomePosto(
    '',
    'ANALISTA WEB',
    'G4F SOLUÇÕES CORPORATIVAS LTDA 07.094.346/0001-45 ACÁCIO BARBOSA DE MOURA',
  );
  assert.equal(r.semNome, false);
  assert.equal(r.nome, 'ACÁCIO BARBOSA DE MOURA');
  assert.equal(r.posto, 'ANALISTA WEB');
});

test('empresa sem nome depois do CNPJ → continua semNome', () => {
  const r = separarNomePosto('', 'Brigadista', 'DLF Engenharia LTDA 03.591.509/0001-44');
  assert.equal(r.semNome, true);
});

test('nome de 1 palavra antes do cargo não é aceito como pessoa', () => {
  assert.equal(separarNomePosto('João Motorista', '').semNome, true);
});
