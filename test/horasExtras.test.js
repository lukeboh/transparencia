import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimarHorasExtras,
  divisorPorCompetencia,
  cicloEleitoralDe,
  tetoMensalPorCompetencia,
} from '../src/tse/horasExtras.js';

test('divisor do salário-hora muda com a competência (200 → 175 → 200)', () => {
  assert.equal(divisorPorCompetencia('2014-09'), 200);
  assert.equal(divisorPorCompetencia('2016-12'), 200);
  assert.equal(divisorPorCompetencia('2017-01'), 175);
  assert.equal(divisorPorCompetencia('2018-10'), 175);
  assert.equal(divisorPorCompetencia('2020-02'), 175);
  assert.equal(divisorPorCompetencia('2020-03'), 200);
  assert.equal(divisorPorCompetencia('2024-11'), 200);
});

test('fator 1,5: horas = rubrica ÷ (base/divisor × 1,5)', () => {
  // base 20.000 / 200 = 100/h normal; × 1,5 = 150/h extra; 6.000 / 150 = 40 h
  const r = estimarHorasExtras({ valorRubrica: 6000, base: 20000, chaveCompetencia: '2022-09' });
  assert.equal(r.divisor, 200);
  assert.equal(r.valorHoraNormal, 100);
  assert.equal(r.horas, 40);
});

test('horasMin usa o fator 2,0 (piso) — sempre ≤ horas', () => {
  const r = estimarHorasExtras({ valorRubrica: 6000, base: 20000, chaveCompetencia: '2022-09' });
  // 6.000 / (100 × 2) = 30
  assert.equal(r.horasMin, 30);
  assert.ok(r.horasMin <= r.horas);
});

test('tipo conhecido → fator exato (domingos ×2, úteis ×1,5) e piso = estimativa', () => {
  // base 20.000 / 200 = 100/h
  const dom = estimarHorasExtras({ valorRubrica: 6000, base: 20000, chaveCompetencia: '2018-10', tipo: 'domingos' });
  assert.equal(dom.divisor, 175); // 2018 está na faixa do divisor 175
  // 6000 / (20000/175 × 2) = 6000 / 228,57… = 26,25
  assert.ok(Math.abs(dom.horas - 26.25) < 1e-9);
  assert.equal(dom.horasMin, dom.horas); // exato
  const uteis = estimarHorasExtras({ valorRubrica: 6000, base: 20000, chaveCompetencia: '2018-10', tipo: 'uteis' });
  // 6000 / (20000/175 × 1,5) = 35
  assert.ok(Math.abs(uteis.horas - 35) < 1e-9);
  assert.equal(uteis.horasMin, uteis.horas);
  assert.ok(dom.horas < uteis.horas); // domingo rende menos horas p/ o mesmo R$
});

test('divisor 175 no ciclo eleitoral de 2018', () => {
  // 20.000 / 175 = 114,2857.../h; × 1,5 = 171,4285...; 6.000 / 171,4285... = 35
  const r = estimarHorasExtras({ valorRubrica: 6000, base: 20000, chaveCompetencia: '2018-10' });
  assert.equal(r.divisor, 175);
  assert.ok(Math.abs(r.horas - 35) < 1e-9);
});

test('base = 0 → horas nulas (sem divisão por zero)', () => {
  const r = estimarHorasExtras({ valorRubrica: 1200, base: 0, chaveCompetencia: '2022-09' });
  assert.equal(r.horas, null);
  assert.equal(r.horasMin, null);
  assert.equal(r.valorHoraNormal, null);
});

test('flag acimaDoTeto quando a estimativa passa do limite mensal do art. 4º', () => {
  assert.equal(tetoMensalPorCompetencia('2022-09'), 90);
  // 15.000 / (100 × 1,5) = 100 h > 90
  const alto = estimarHorasExtras({ valorRubrica: 15000, base: 20000, chaveCompetencia: '2022-09' });
  assert.equal(alto.horas, 100);
  assert.equal(alto.acimaDoTeto, true);
  const ok = estimarHorasExtras({ valorRubrica: 6000, base: 20000, chaveCompetencia: '2022-09' });
  assert.equal(ok.acimaDoTeto, false);
});

test('agrupamento por ciclo: ano eleitoral casa; janeiro seguinte também; resto = null', () => {
  assert.equal(cicloEleitoralDe('2022-08')?.ciclo, '2022');
  assert.equal(cicloEleitoralDe('2022-08')?.tipo, 'geral');
  assert.equal(cicloEleitoralDe('2023-01')?.ciclo, '2022'); // spillover
  assert.equal(cicloEleitoralDe('2023-06'), null); // ano sem eleição ordinária
  assert.equal(cicloEleitoralDe('2024-10')?.tipo, 'municipal');

  // O ciclo entra na estimativa só como agrupamento — não há mais flag de "fora da janela".
  const fora = estimarHorasExtras({ valorRubrica: 3000, base: 20000, chaveCompetencia: '2023-06' });
  assert.equal(fora.ciclo, null);
  assert.ok(!('foraDaJanela' in fora));
  const dentro = estimarHorasExtras({ valorRubrica: 3000, base: 20000, chaveCompetencia: '2022-09' });
  assert.equal(dentro.ciclo?.ciclo, '2022');
});
