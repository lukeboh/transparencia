import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarDashboard } from '../src/tse/agregarDashboard.js';

const HOJE = new Date().toISOString().slice(0, 10);
const ANO = Number(HOJE.slice(0, 4));

function contrato(overrides) {
  return {
    id: '1',
    numero: '10/2020',
    objeto: 'Objeto de teste',
    fornecedor: 'Fornecedor X',
    valorGlobal: 1000,
    valorEmpenhado: 500,
    valorPago: 250,
    vigenciaInicio: '01/01/2020',
    vigenciaFim: '31/12/2020',
    categoria: 'Serviços',
    responsaveis: [{ nome: 'Fiscal Da Relacao', papel: 'Fiscal Titular' }],
    ...overrides,
  };
}

function agente(overrides) {
  return {
    nome: 'Fulano',
    matricula: '1',
    cargo: 'Analista Judiciário',
    funcao: null,
    lotacao: 'Alguma Seção',
    atoProvimento: null,
    dataPublicacao: null,
    observacoes: [],
    ...overrides,
  };
}

test('agregarDashboard: servidores.lista reúne a relação de agentes públicos + fiscais fora dela', () => {
  const contratos = [
    contrato({ id: '1', responsaveis: [{ nome: 'Fiscal Da Relacao', papel: 'Fiscal Titular' }] }),
    contrato({
      id: '2',
      numero: '20/2020',
      responsaveis: [{ nome: 'Fiscal Fora Da Relacao', papel: 'Gestor' }],
    }),
  ];
  const agentes = [
    agente({ nome: 'Fiscal Da Relacao', matricula: '10', funcao: { tipo: 'FC', nivel: 4, cargoTitulo: 'Chefe' } }),
    agente({ nome: 'Servidor Sem Nada', matricula: '20', funcao: null }),
  ];

  const d = agregarDashboard(contratos, [], agentes, [], [], null, []);

  assert.ok(d.servidores, 'tem a seção servidores');
  assert.equal(d.servidores.total, 3); // 2 da relação + 1 fiscal fora dela
  assert.equal(d.servidores.comContrato, 2);
  assert.equal(d.servidores.semContrato, 1);

  const daRelacao = d.servidores.lista.find((s) => s.nome === 'Fiscal Da Relacao');
  assert.equal(daRelacao.naRelacaoAtual, true);
  assert.equal(typeof daRelacao.rankingIndex, 'number');
  assert.deepEqual(daRelacao.funcaoAtual, { tipo: 'FC', nivel: 4, cargoTitulo: 'Chefe' });
  assert.equal(d.responsaveis.ranking[daRelacao.rankingIndex].nome, 'Fiscal Da Relacao');

  const semNada = d.servidores.lista.find((s) => s.nome === 'Servidor Sem Nada');
  assert.equal(semNada.naRelacaoAtual, true);
  assert.equal(semNada.rankingIndex, null);
  assert.equal(semNada.funcoesIndex, null);
  assert.equal(semNada.funcaoAtual, null);

  const fora = d.servidores.lista.find((s) => s.nome === 'Fiscal Fora Da Relacao');
  assert.equal(fora.naRelacaoAtual, false);
  assert.equal(typeof fora.rankingIndex, 'number');
});

test('agregarDashboard: funcoesIndex aponta para o registro certo em funcoes.servidores', () => {
  const contratos = [contrato()];
  const movimentos = [
    {
      tipo: 'inicio',
      func: 'CJ',
      nivel: 2,
      cargoTitulo: 'Assessor',
      unidade: 'de Gabinete',
      nome: 'Fiscal Da Relacao',
      portaria: { numero: '1', ano: ANO, data: `${HOJE}`, url: 'https://x/1' },
      dataEfetiva: `${ANO - 1}-01-01`,
    },
  ];
  const agentes = [agente({ nome: 'Fiscal Da Relacao', funcao: { tipo: 'CJ', nivel: 2, cargoTitulo: 'Assessor' } })];

  const d = agregarDashboard(contratos, movimentos, agentes, [], [], null, []);
  const linha = d.servidores.lista.find((s) => s.nome === 'Fiscal Da Relacao');
  assert.equal(typeof linha.funcoesIndex, 'number');
  assert.equal(d.funcoes.servidores[linha.funcoesIndex].nome, 'Fiscal Da Relacao');
  assert.ok(d.funcoes.servidores[linha.funcoesIndex].mandatos.length >= 1);
});
