import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarUnidades, normalizeUnidade } from '../src/tse/agregarUnidades.js';

// Fixture de 3 níveis: TSE (raiz) -> DIVISÃO (tem membro direto E filhos,
// caso real "GABINETE DA SGP") -> duas seções-folha.
function arvoreFixture() {
  return {
    id: '1',
    nome: 'TRIBUNAL SUPERIOR ELEITORAL',
    name: 'TSE',
    children: [
      {
        id: '2',
        nome: 'DIVISÃO CENTRAL',
        name: 'DIVC',
        parentidAsString: '1',
        children: [
          { id: '3', nome: 'SEÇÃO A', name: 'SEA', parentidAsString: '2', title: 'DIV' },
          { id: '4', nome: 'SEÇÃO B ', name: 'SEB', parentidAsString: '2', title: 'DIV' }, // espaço à direita proposital
        ],
        title: '1',
      },
    ],
    title: 'DIV',
  };
}

function agente(overrides) {
  return { nome: 'Fulano de Tal', lotacao: 'SEÇÃO A', funcao: null, ...overrides };
}

test('normalizeUnidade: colapsa espaços, remove acento e ignora caixa', () => {
  assert.equal(normalizeUnidade('  Seção   A '), normalizeUnidade('SECAO A'));
  assert.equal(normalizeUnidade('SEÇÃO B '), normalizeUnidade('seção b'));
});

test('agregarUnidades: conta servidores diretos por nó, mesmo casando com espaço à direita na fonte', () => {
  const { arvore } = agregarUnidades(arvoreFixture(), [agente({ lotacao: 'SEÇÃO B' })]);
  const secaoB = arvore.children[0].children[1];
  assert.equal(secaoB.direto.servidores, 1);
});

test('agregarUnidades: nó não-folha com membros diretos (caso "GABINETE DA SGP") soma certo consolidado', () => {
  const agentes = [
    agente({ nome: 'A', lotacao: 'DIVISÃO CENTRAL' }), // direto na divisão, não numa seção
    agente({ nome: 'B', lotacao: 'SEÇÃO A' }),
    agente({ nome: 'C', lotacao: 'SEÇÃO B' }),
  ];
  const { arvore, totalServidoresTSE } = agregarUnidades(arvoreFixture(), agentes);
  const divisao = arvore.children[0];

  assert.equal(divisao.direto.servidores, 1);
  assert.equal(divisao.consolidado.servidores, 3);
  assert.equal(arvore.direto.servidores, 0);
  assert.equal(arvore.consolidado.servidores, 3);
  assert.equal(totalServidoresTSE, 3);
});

test('agregarUnidades: lotação sem correspondência na árvore vai para naoLocalizados, não é descartada', () => {
  const { naoLocalizados, totalServidoresTSE } = agregarUnidades(arvoreFixture(), [
    agente({ lotacao: 'UNIDADE QUE NÃO EXISTE' }),
  ]);
  assert.equal(naoLocalizados.servidores, 1);
  assert.deepEqual(naoLocalizados.exemplos.servidores, ['UNIDADE QUE NÃO EXISTE']);
  assert.equal(totalServidoresTSE, 0);
});

test('agregarUnidades: lotação vazia/nula também vai para naoLocalizados', () => {
  const { naoLocalizados } = agregarUnidades(arvoreFixture(), [agente({ lotacao: null })]);
  assert.equal(naoLocalizados.servidores, 1);
});

test('agregarUnidades: nome de unidade ambíguo (duas unidades com o mesmo nome normalizado) não escolhe um arbitrariamente', () => {
  const arvore = arvoreFixture();
  arvore.children[0].children.push({ id: '5', nome: 'SEÇÃO A', name: 'SEA2', parentidAsString: '2', title: 'DIV' });
  const { naoLocalizados, arvore: resultado } = agregarUnidades(arvore, [agente({ lotacao: 'SEÇÃO A' })]);
  assert.equal(naoLocalizados.ambiguos, 1);
  const [secaoA1, , secaoA2] = resultado.children[0].children;
  assert.equal(secaoA1.direto.servidores, 0);
  assert.equal(secaoA2.direto.servidores, 0);
});

test('agregarUnidades: agrega função (FC/CJ) por nó, ordenada FC antes de CJ e por nível crescente', () => {
  const agentes = [
    agente({ nome: 'A', lotacao: 'SEÇÃO A', funcao: { tipo: 'CJ', nivel: 1, cargoTitulo: 'x' } }),
    agente({ nome: 'B', lotacao: 'SEÇÃO A', funcao: { tipo: 'FC', nivel: 3, cargoTitulo: 'y' } }),
    agente({ nome: 'C', lotacao: 'SEÇÃO A', funcao: { tipo: 'FC', nivel: 1, cargoTitulo: 'z' } }),
  ];
  const { arvore } = agregarUnidades(arvoreFixture(), agentes);
  const secaoA = arvore.children[0].children[0];
  assert.deepEqual(
    secaoA.direto.funcoes.map((f) => `${f.tipo}-${f.nivel}`),
    ['FC-1', 'FC-3', 'CJ-1'],
  );
});

test('agregarUnidades: cruza fiscal/gestor por nome normalizado e consolida chips de fiscal na subárvore', () => {
  const agentes = [agente({ nome: 'Fulano de Tal', lotacao: 'SEÇÃO A' })];
  const rankingResponsaveis = [{ nome: 'FULANO DE TAL', papeis: ['Fiscal Titular', 'Gestor'] }];
  const { arvore } = agregarUnidades(arvoreFixture(), agentes, { ranking: [] }, rankingResponsaveis);
  const secaoA = arvore.children[0].children[0];
  assert.deepEqual(
    secaoA.direto.fiscais.map((f) => f.papel),
    ['Fiscal Titular', 'Gestor'],
  );
  assert.deepEqual(arvore.children[0].consolidado.fiscais.map((f) => f.papel), ['Fiscal Titular', 'Gestor']);
});

test('agregarUnidades: teletrabalho só conta período em aberto (vigente), casado pela menor unidade', () => {
  const teletrabalho = {
    ranking: [
      { nome: 'X', periodos: [{ unidadeNiveis: ['SEÇÃO A'], dataFim: null }] },
      { nome: 'Y', periodos: [{ unidadeNiveis: ['SEÇÃO A'], dataFim: '2020-01-01' }] }, // encerrado, não conta
    ],
  };
  const { arvore } = agregarUnidades(arvoreFixture(), [], teletrabalho);
  const secaoA = arvore.children[0].children[0];
  assert.equal(secaoA.direto.teletrabalho, 1);
});

test('agregarUnidades: teletrabalho sem unidade correspondente vai para naoLocalizados.teletrabalho', () => {
  const teletrabalho = { ranking: [{ nome: 'X', periodos: [{ unidadeNiveis: ['NÃO EXISTE'], dataFim: null }] }] };
  const { naoLocalizados } = agregarUnidades(arvoreFixture(), [], teletrabalho);
  assert.equal(naoLocalizados.teletrabalho, 1);
});

test('agregarUnidades: terceirizados casam pela SIGLA da alocação (menor sigla conhecida do caminho) e consolidam na subárvore', () => {
  const terceirizados = [
    { alocacao: 'SEA/DIVC/TSE' }, // menor sigla conhecida = SEA
    { alocacao: 'SEA' },
    { alocacao: 'Sexyz/SEB/DIVC' }, // Sexyz não existe -> cai em SEB
    { alocacao: 'DIVC' }, // direto na divisão
  ];
  const { arvore } = agregarUnidades(arvoreFixture(), [], undefined, [], terceirizados);
  const divisao = arvore.children[0];
  const secaoA = divisao.children[0];
  const secaoB = divisao.children[1];

  assert.equal(secaoA.direto.terceirizados, 2);
  assert.equal(secaoB.direto.terceirizados, 1);
  assert.equal(divisao.direto.terceirizados, 1);
  assert.equal(divisao.consolidado.terceirizados, 4);
  assert.equal(arvore.consolidado.terceirizados, 4);
});

test('agregarUnidades: terceirizado com alocação sem sigla conhecida vai para naoLocalizados.terceirizados', () => {
  const { naoLocalizados } = agregarUnidades(arvoreFixture(), [], undefined, [], [
    { alocacao: 'FOO/BAR' },
    { alocacao: '' },
  ]);
  assert.equal(naoLocalizados.terceirizados, 2);
  assert.equal(naoLocalizados.exemplos.terceirizados.length, 2);
});

test('agregarUnidades: devolve lista achatada de terceirizados (nome em título, ordem alfabética, com unidadeId)', () => {
  const terceirizados = [
    { alocacao: 'SEB/DIVC', empregado: 'ZÉLIA NUNES', posto: 'Copeira', empresa: 'ACME LTDA 12.345.678/0001-90', contrato: '9/2025' },
    { alocacao: 'SEA', empregado: 'ana paula', posto: '05', empresa: '', contrato: '1/2024' },
    { alocacao: 'FOO', empregado: 'Fulano Perdido', posto: 'X', empresa: 'Y', contrato: '2/2020' },
  ];
  const { terceirizados: lista, naoLocalizados } = agregarUnidades(arvoreFixture(), [], undefined, [], terceirizados);

  assert.equal(lista.length, 2); // "Fulano Perdido" não resolve
  assert.deepEqual(lista.map((t) => t.nome), ['Ana Paula', 'Zélia Nunes']); // alfabético + título
  assert.equal(lista[0].posto, ''); // "05" é ruído -> limpo
  assert.equal(lista[1].posto, 'Copeira');
  assert.equal(lista[1].empresa, 'ACME LTDA'); // CNPJ removido
  assert.equal(lista[1].alocacao, 'SEB/DIVC'); // caminho cru preservado
  assert.equal(lista[1].contratoId, null); // só agregarDashboard preenche
  assert.ok(lista[0].unidadeId); // aponta para um nó real
  assert.equal(naoLocalizados.terceirizados, 1);
});
