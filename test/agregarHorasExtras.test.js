import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarHorasExtras } from '../src/tse/agregarHorasExtras.js';

// base 20.000 / 200 = 100/h; × 1,5 = 150/h → 6.000 = 40 h; piso (×2) = 30 h
function entrada() {
  return {
    porCompetencia: {
      '2022-11': [
        {
          matricula: '1', nome: 'MARIA DA SILVA', cargo: 'ANALISTA', funcao: 'FC-4',
          classePadrao: 'B-9', unidade: 'SEÇÃO DE TESTES',
          base: 20000, valorRubrica: 6000,
          rubricas: [{ ref: '10/2022', valor: 6000 }],
        },
        {
          matricula: '2', nome: 'JOÃO SOUZA', cargo: 'TÉCNICO', funcao: null,
          classePadrao: 'C-13', unidade: 'SEÇÃO DE TESTES',
          base: 10000, valorRubrica: 1500,
          rubricas: [{ ref: '10/2022', valor: 1500 }],
        },
      ],
      '2023-02': [
        {
          matricula: '1', nome: 'MARIA DA SILVA', cargo: 'ANALISTA', funcao: 'FC-4',
          classePadrao: 'B-9', unidade: 'SEÇÃO DE TESTES',
          base: 20000, valorRubrica: 300,
          // sem mês de referência → cai na competência da folha (2023-02),
          // ano sem eleição ordinária → agrupa em "outros"
          rubricas: [{ ref: null, valor: 300 }],
        },
      ],
    },
  };
}

test('estima horas por servidor e consolida', () => {
  const r = agregarHorasExtras(entrada());
  const maria = r.ranking.find((x) => x.nome === 'MARIA DA SILVA');
  assert.ok(maria);
  // 40 h (out/2022) + 2 h (fev/2023: 300 / (100 × 1,5) = 2) = 42
  assert.ok(Math.abs(maria.horasConsolidadas - 42) < 1e-6);
  assert.equal(maria.mesesComHE, 2);
  // piso: 30 + 1,5 = 31,5
  assert.ok(Math.abs(maria.horasConsolidadasMin - 31.5) < 1e-6);
  assert.equal(maria.ultimaCompetencia, '2023-02');
});

test('ranking ordenado por horas desc; quebra por ciclo ("2022" e "outros")', () => {
  const r = agregarHorasExtras(entrada());
  assert.equal(r.ranking[0].nome, 'MARIA DA SILVA');
  const maria = r.ranking[0];
  const ciclo2022 = maria.porCiclo.find((c) => c.ciclo === '2022');
  const outros = maria.porCiclo.find((c) => c.ciclo === 'outros');
  assert.ok(Math.abs(ciclo2022.horas - 40) < 1e-6);
  assert.ok(Math.abs(outros.horas - 2) < 1e-6);
  assert.equal(outros.rotulo, 'Outros meses');
  assert.deepEqual(Object.keys(maria.flags), ['acimaDoTeto']);
});

test('ocorrencias trazem a unidade da competência para o rollup por unidade', () => {
  const r = agregarHorasExtras(entrada());
  assert.equal(r.ocorrencias.length, 3);
  assert.ok(r.ocorrencias.every((o) => o.unidade === 'SEÇÃO DE TESTES'));
  const total = r.ocorrencias.reduce((s, o) => s + o.horas, 0);
  assert.ok(Math.abs(total - r.totalHoras) < 1e-6);
});

test('ciclos globais agregam horas e contam servidores distintos', () => {
  const r = agregarHorasExtras(entrada());
  const c2022 = r.ciclos.find((c) => c.ciclo === '2022');
  // Maria 40 h + João: 1500 / (10000/200 × 1,5) = 1500 / 75 = 20 h → 60 h
  assert.ok(Math.abs(c2022.horas - 60) < 1e-6);
  assert.equal(c2022.servidores, 2);
  assert.equal(c2022.tipo, 'geral');
});

test('array cru legado é aceito', () => {
  const r = agregarHorasExtras([]);
  assert.deepEqual(r.ranking, []);
  assert.equal(r.totalHoras, 0);
});

test('base parcial na folha de pagamento é substituída pela base do mês de referência', () => {
  const r = agregarHorasExtras({
    porCompetencia: {
      // meses "normais": base 20.000
      '2022-10': [
        { nome: 'ANA LIMA', unidade: 'SEÇÃO X', base: 20000, valorRubrica: 3000, rubricas: [{ ref: '10/2022', valor: 3000 }] },
      ],
      '2022-11': [
        { nome: 'ANA LIMA', unidade: 'SEÇÃO X', base: 20000, valorRubrica: 3000, rubricas: [{ ref: '11/2022', valor: 3000 }] },
      ],
      // folha 2023-01 PARCIAL (base 2.000, ~10% da mediana) pagando HE de 12/2022
      '2023-01': [
        { nome: 'ANA LIMA', unidade: 'SEÇÃO X', base: 2000, valorRubrica: 3000, rubricas: [{ ref: '12/2022', valor: 3000 }] },
      ],
    },
  });
  const ana = r.ranking.find((x) => x.nome === 'ANA LIMA');
  const dez = ana.porCompetencia.find((c) => c.chave === '2022-12');
  // com a base parcial (2.000) daria 3000 / (2000/200 × 1,5) = 200 h;
  // com a mediana (20.000) dá 3000 / (20000/200 × 1,5) = 20 h
  assert.ok(Math.abs(dez.horas - 20) < 1e-6, `esperava ~20 h, veio ${dez.horas}`);
});
