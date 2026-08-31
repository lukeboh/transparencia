import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarTerceirizados } from '../src/tse/agregarTerceirizados.js';

// Árvore de 3 níveis: TSE > STI > (COINF, SEBD)
function arvore() {
  return {
    id: '1',
    nome: 'TRIBUNAL SUPERIOR ELEITORAL',
    name: 'TSE',
    children: [
      {
        id: '2',
        nome: 'SECRETARIA DE TECNOLOGIA DA INFORMAÇÃO',
        name: 'STI',
        parentidAsString: '1',
        children: [
          { id: '3', nome: 'COORDENADORIA DE INFRAESTRUTURA', name: 'COINF', parentidAsString: '2' },
          { id: '4', nome: 'SEÇÃO DE BANCO DE DADOS', name: 'SEBD', parentidAsString: '2' },
        ],
      },
    ],
  };
}

const contratos = [
  { id: 'c-digi', numero: '31/2023', fornecedor: '01.936.069/0010-85 - DIGISYSTEM SERVICOS LTDA', objeto: 'apoio técnico em TIC', valorGlobal: 100, valorEmpenhado: 90, valorPago: 80, vigente: true, categoria: 'Informática (TIC)' },
  { id: 'c-imovel', numero: '31/2023', fornecedor: '00.000.208/0001-00 - BRB BANCO DE BRASILIA SA', objeto: 'cessão de uso de área', valorGlobal: 0, valorEmpenhado: 0, valorPago: 0, vigente: false, categoria: 'Cessão' },
];

function reg(over) {
  return { contrato: '31/2023', empresa: 'DIGISYSTEM SERVICOS LTDA 01.936.069/0010-85', cnpj: '', empregado: 'ana paula souza', posto: 'Analista', alocacao: 'SEBD/STI/TSE', ...over };
}

function entrada(porCompetencia) {
  const competencias = Object.keys(porCompetencia)
    .sort()
    .map((chave) => {
      const [ano, mes] = chave.split('-').map(Number);
      return { chave, mes, ano, rotulo: `${chave}` };
    });
  return {
    porCompetencia,
    competencias,
    competenciaAtual: { chave: competencias[competencias.length - 1].chave },
  };
}

test('mês de início é a 1ª competência; mês de fim fica vazio se ainda consta na mais recente', () => {
  const r = agregarTerceirizados(
    entrada({
      '2025-03': [reg()],
      '2025-04': [reg()],
      '2025-05': [reg()],
    }),
    arvore(),
    contratos,
  );
  assert.equal(r.pessoas.length, 1);
  assert.equal(r.pessoas[0].mesInicio, '2025-03');
  assert.equal(r.pessoas[0].mesFim, null);
  assert.equal(r.pessoas[0].ativo, true);
  assert.equal(r.pessoas[0].competencias, 3);
  assert.equal(r.ativos, 1);
  assert.equal(r.encerrados, 0);
});

test('mês de fim é a última competência em que aparece, quando some antes da mais recente', () => {
  const r = agregarTerceirizados(
    entrada({
      '2025-03': [reg()],
      '2025-04': [reg()],
      '2025-05': [], // saiu
      '2025-06': [],
    }),
    arvore(),
    contratos,
  );
  assert.equal(r.pessoas[0].mesInicio, '2025-03');
  assert.equal(r.pessoas[0].mesFim, '2025-04');
  assert.equal(r.pessoas[0].ativo, false);
  assert.equal(r.ativos, 0);
  assert.equal(r.encerrados, 1);
});

test('reentrada: volta a aparecer na competência mais recente ⇒ mês de fim vazio de novo', () => {
  const r = agregarTerceirizados(
    entrada({ '2025-03': [reg()], '2025-04': [], '2025-05': [reg()] }),
    arvore(),
    contratos,
  );
  assert.equal(r.pessoas[0].mesInicio, '2025-03');
  assert.equal(r.pessoas[0].mesFim, null);
  assert.equal(r.pessoas[0].competencias, 2);
});

test('lotação: caminho de até 3 siglas, da unidade mais específica para a mais alta', () => {
  const r = agregarTerceirizados(entrada({ '2025-05': [reg({ alocacao: 'SEBD/STI/TSE' })] }), arvore(), contratos);
  assert.deepEqual(r.pessoas[0].lotacaoSiglas, ['SEBD', 'STI']);
  assert.equal(r.semLotacao, 0);
});

test('lotação não identificada vira falha e conta em semLotacao', () => {
  const r = agregarTerceirizados(entrada({ '2025-05': [reg({ alocacao: 'FOO/BAR' })] }), arvore(), contratos);
  assert.deepEqual(r.pessoas[0].lotacaoSiglas, []);
  assert.equal(r.semLotacao, 1);
  assert.equal(r.falhas.length, 1);
  assert.equal(r.falhas[0].tipo, 'lotacao-nao-identificada');
  assert.equal(r.falhas[0].alocacao, 'FOO/BAR');
});

test('alocação vazia vira falha "sem-alocacao"', () => {
  const r = agregarTerceirizados(entrada({ '2025-05': [reg({ alocacao: '' })] }), arvore(), contratos);
  assert.equal(r.falhas[0].tipo, 'sem-alocacao');
});

test('KPI por contrato: ativos x total (quem saiu conta no total, não nos ativos)', () => {
  const r = agregarTerceirizados(
    entrada({
      '2025-03': [reg({ empregado: 'ana paula souza' }), reg({ empregado: 'bruno lima' })],
      '2025-04': [reg({ empregado: 'ana paula souza' })], // bruno saiu
    }),
    arvore(),
    contratos,
  );
  const c = r.porContrato.find((x) => x.contrato === '31/2023');
  assert.equal(c.total, 2);
  assert.equal(c.ativos, 1);
});

test('contrato: casa pelo número e desempata pelo fornecedor quando o número se repete', () => {
  const r = agregarTerceirizados(entrada({ '2025-05': [reg()] }), arvore(), contratos);
  assert.equal(r.pessoas[0].contratoId, 'c-digi'); // não o 'c-imovel' (BRB)
  const c = r.porContrato.find((x) => x.contrato === '31/2023');
  assert.equal(c.contratoId, 'c-digi');
  assert.equal(c.valorGlobal, 100);
});

test('aceita o array cru legado (uma foto só, sem histórico)', () => {
  const r = agregarTerceirizados([reg()], arvore(), contratos);
  assert.equal(r.historicoMeses, 0);
  assert.equal(r.pessoas.length, 1);
  assert.equal(r.pessoas[0].ativo, true);
  assert.equal(r.pessoas[0].mesFim, null);
});

test('nomes em caixa de título e ordem alfabética', () => {
  const r = agregarTerceirizados(
    entrada({ '2025-05': [reg({ empregado: 'ZÉLIA NUNES DE SÁ' }), reg({ empregado: 'ana paula souza' })] }),
    arvore(),
    contratos,
  );
  assert.deepEqual(r.pessoas.map((p) => p.nome), ['Ana Paula Souza', 'Zélia Nunes de Sá']);
});
