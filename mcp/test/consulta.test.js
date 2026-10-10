import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consultar, valorDe, casaFiltro, agrupar } from '../src/consulta.js';

const contratos = [
  { id: '1', categoria: 'Serviços', valor: 100, vigente: true, responsaveis: [{ nome: 'JOSÉ SILVA', papel: 'Gestor' }] },
  { id: '2', categoria: 'Serviços', valor: 50, vigente: false, responsaveis: [{ nome: 'Ana', papel: 'Fiscal Técnico' }, { nome: 'José Silva', papel: 'Fiscal Técnico Substituto' }] },
  { id: '3', categoria: 'Compras', valor: 10, vigente: true, responsaveis: [] },
];

test('valorDe atravessa listas achatando', () => {
  assert.deepEqual(valorDe(contratos[1], 'responsaveis.nome'), ['Ana', 'José Silva']);
  assert.equal(valorDe(contratos[0], 'categoria'), 'Serviços');
  assert.deepEqual(valorDe(contratos[2], 'responsaveis.nome'), []);
});

test('texto ignora acento e caixa; lista casa se algum elemento casar', () => {
  assert.ok(casaFiltro(contratos[0], { campo: 'responsaveis.nome', op: 'contem', valor: 'jose' }));
  assert.ok(casaFiltro(contratos[1], { campo: 'responsaveis.nome', op: 'contem', valor: 'JOSÉ' }));
  assert.ok(!casaFiltro(contratos[2], { campo: 'responsaveis.nome', op: 'contem', valor: 'jose' }));
});

test('operadores negativos em lista exigem que nenhum elemento viole', () => {
  assert.ok(!casaFiltro(contratos[1], { campo: 'responsaveis.papel', op: 'nao_contem', valor: 'substituto' }));
  assert.ok(casaFiltro(contratos[0], { campo: 'responsaveis.papel', op: 'nao_contem', valor: 'substituto' }));
});

test('coage número/booleano vindos como texto', () => {
  assert.ok(casaFiltro(contratos[0], { campo: 'valor', op: 'maior', valor: '60' }));
  assert.ok(casaFiltro(contratos[0], { campo: 'vigente', op: 'igual', valor: 'true' }));
  assert.ok(casaFiltro(contratos[0], { campo: 'valor', op: 'entre', valor: [100, 200] }));
});

test('agrupa com métricas e abre um grupo por elemento de lista', () => {
  const g = agrupar(contratos, { por: ['categoria'], metricas: [{ op: 'somar', campo: 'valor' }, { op: 'contar' }] });
  assert.deepEqual(g.find((x) => x.categoria === 'Serviços'), { categoria: 'Serviços', somar_valor: 150, contar: 2 });
  const porPapel = agrupar(contratos, { por: ['responsaveis.papel'] });
  assert.equal(porPapel.length, 4); // Gestor, Fiscal Técnico, Substituto, null (sem responsáveis)
});

test('consultar filtra, ordena, pagina e projeta', () => {
  const r = consultar(contratos, {
    filtros: [{ campo: 'vigente', op: 'igual', valor: true }],
    ordenarPor: [{ campo: 'valor', direcao: 'desc' }],
    campos: ['id', 'valor'],
    limite: 1,
  });
  assert.equal(r.total, 2);
  assert.equal(r.truncado, true);
  assert.deepEqual(r.itens, [{ id: '1', valor: 100 }]);
});

test('modo "algum" combina filtros com OU', () => {
  const r = consultar(contratos, {
    modoFiltro: 'algum',
    filtros: [{ campo: 'categoria', op: 'igual', valor: 'compras' }, { campo: 'valor', op: 'maior_igual', valor: 100 }],
  });
  assert.deepEqual(r.itens.map((c) => c.id).sort(), ['1', '3']);
});

test('operador inválido gera erro claro', () => {
  assert.throws(() => casaFiltro(contratos[0], { campo: 'valor', op: 'parecido', valor: 1 }), /operador desconhecido/);
});
