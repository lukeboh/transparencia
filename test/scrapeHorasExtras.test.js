import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContracheque, numeroBR } from '../src/tse/scrapeHorasExtras.js';

test('numeroBR entende o formato pt-BR e trata lixo', () => {
  assert.equal(numeroBR('1.234,56'), 1234.56);
  assert.equal(numeroBR('9.968,79'), 9968.79);
  assert.equal(numeroBR('0,00'), 0);
  assert.equal(numeroBR('-577,18'), -577.18);
  assert.equal(numeroBR('-'), 0);
  assert.equal(numeroBR(''), 0);
  assert.equal(numeroBR(null), 0);
});

// Bloco real do Anexo VIII (ADAÍRES AGUIAR LIMA, nov/2022) — servidor efetivo.
const EFETIVO = `
CARGO: TÉCNICO JUDICIÁRIO FUNÇÃO: CLASSE / PADRÃO: C-13 UNIDADE: GABINETE DA SAD
DETALHAMENTO DOS CRÉDITOS VALOR (R$)
VENCIMENTOS E VANTAGENS 14.284,59
EXERCÍCIO FC/CJ 8.411,01
GRATIFICAÇÃO POR ENCARGO DE CURSO 0,00
1/3 DE FÉRIAS 0,00
ANTECIPAÇÃO E GRATIFICAÇÃO NATALINA 11.438,13
AUXÍLIOS E BENEFÍCIOS 910,08
HORAS EXTRAS - 10/2022 9.968,79
AJUDA DE CUSTO E INDENIZAÇÕES 0,00
ABONO DE PERMANÊNCIA 0,00
TOTAL BRUTO 45.012,60
LÍQUIDO VALOR (R$)
RENDIMENTO LÍQUIDO 28.585,43
DIÁRIAS 1.625,89
REMUNERAÇÃO ÓRGÃO ORIGEM 0,00
`;

// MAURO SANS JUNIOR, ago/2022 — REQUISITADO: VV 0,00, remuneração no órgão de origem.
const REQUISITADO = `
MAURO SANS JUNIOR CARGO: REQUISITADO FUNÇÃO: FC-3 UNIDADE: SEÇÃO DE SUPORTE OPERACIONAL
DETALHAMENTO DOS CRÉDITOS VALOR (R$)
VENCIMENTOS E VANTAGENS 0,00
EXERCÍCIO FC/CJ 1.379,07
GRATIFICAÇÃO POR ENCARGO DE CURSO 0,00
1/3 DE FÉRIAS 0,00
ANTECIPAÇÃO E GRATIFICAÇÃO NATALINA 0,00
AUXÍLIOS E BENEFÍCIOS 0,00
HORAS EXTRAS - 07/2022 3.881,08
AJUDA DE CUSTO E INDENIZAÇÕES 0,00
ABONO DE PERMANÊNCIA 0,00
TOTAL BRUTO 5.260,15
LÍQUIDO VALOR (R$)
RENDIMENTO LÍQUIDO 4.682,97
DIÁRIAS 0,00
REMUNERAÇÃO ÓRGÃO ORIGEM 18.799,87
`;

test('efetivo: base = VENCIMENTOS E VANTAGENS + EXERCÍCIO FC/CJ (órgão origem 0)', () => {
  const cc = parseContracheque(EFETIVO);
  assert.ok(cc);
  assert.equal(cc.componentes.vv, 14284.59);
  assert.equal(cc.componentes.fccj, 8411.01);
  assert.equal(cc.componentes.origem, 0);
  assert.ok(Math.abs(cc.base - 22695.6) < 1e-6);
  assert.equal(cc.valorRubrica, 9968.79);
  assert.deepEqual(cc.rubricas, [{ ref: '10/2022', valor: 9968.79, tipo: null }]);
});

test('requisitado: REMUNERAÇÃO ÓRGÃO ORIGEM entra na base', () => {
  const cc = parseContracheque(REQUISITADO);
  assert.ok(cc);
  assert.equal(cc.componentes.vv, 0);
  assert.equal(cc.componentes.fccj, 1379.07);
  assert.equal(cc.componentes.origem, 18799.87);
  // sem o órgão origem a base seria só 1.379,07 e as horas ~14x maiores
  assert.ok(Math.abs(cc.base - 20178.94) < 1e-6);
  assert.equal(cc.valorRubrica, 3881.08);
});

test('formato antigo (até ~2020): 3 linhas por tipo — DOMINGOS, DIAS ÚTEIS, resíduo', () => {
  const cc = parseContracheque(
    'VENCIMENTOS E VANTAGENS 19.410,76 EXERCÍCIO FC/CJ 0,00 AUXÍLIOS E BENEFÍCIOS 910,08 ' +
      'HORAS EXTRAS - DOMINGOS E FERIADOS - 10/2018 3.977,15 ' +
      'HORAS EXTRAS - DIAS ÚTEIS E SÁBADOS - 10/2018 6.107,67 ' +
      'HORAS EXTRAS - 10/2018 115,16 ' +
      'TOTAL BRUTO 40.477,44 REMUNERAÇÃO ÓRGÃO ORIGEM 0,00',
  );
  assert.equal(cc.rubricas.length, 3);
  assert.deepEqual(
    cc.rubricas.map((r) => [r.tipo, r.ref, r.valor]),
    [
      ['domingos', '10/2018', 3977.15],
      ['uteis', '10/2018', 6107.67],
      [null, '10/2018', 115.16],
    ],
  );
  assert.ok(Math.abs(cc.valorRubrica - 10199.98) < 1e-6);
});

test('bloco lido em dobro (concorrência) → rubricas idênticas são colapsadas', () => {
  const cc = parseContracheque(
    'VENCIMENTOS E VANTAGENS 14.358,40 EXERCÍCIO FC/CJ 0,00 REMUNERAÇÃO ÓRGÃO ORIGEM 0,00 ' +
      // bloco duplicado: cada linha aparece 2×, idêntica
      'HORAS EXTRAS - DOMINGOS E FERIADOS - 09/2016 1.980,09 ' +
      'HORAS EXTRAS - DIAS ÚTEIS E SÁBADOS - 09/2016 12.668,21 ' +
      'HORAS EXTRAS - DOMINGOS E FERIADOS - 09/2016 1.980,09 ' +
      'HORAS EXTRAS - DIAS ÚTEIS E SÁBADOS - 09/2016 12.668,21 ',
  );
  assert.equal(cc.rubricas.length, 2);
  assert.ok(Math.abs(cc.valorRubrica - 14648.3) < 1e-6);
});

test('múltiplas linhas HORAS EXTRAS (retroativo) somam e mantêm o mês de referência', () => {
  const cc = parseContracheque(
    'VENCIMENTOS E VANTAGENS 10.000,00 HORAS EXTRAS - 09/2022 758,61 HORAS EXTRAS - 10/2022 6.976,33 TOTAL BRUTO 17.734,94 REMUNERAÇÃO ÓRGÃO ORIGEM 0,00',
  );
  assert.equal(cc.rubricas.length, 2);
  assert.ok(Math.abs(cc.valorRubrica - 7734.94) < 1e-6);
});

test('base <= 0 → null (contracheque não renderizado)', () => {
  assert.equal(parseContracheque('página de formulário sem detalhamento'), null);
});
