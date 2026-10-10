// Integração: cliente MCP real ↔ servidor, sobre os snapshots do próprio repo (offline).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { criarServidor } from '../src/servidor.js';
import { configuracao } from '../src/dados.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
let cliente;

before(async () => {
  const config = configuracao({
    TSE_MCP_MODO: 'snapshot',
    TSE_MCP_SNAPSHOT_DIR: dataDir,
    TSE_MCP_CACHE_DIR: await mkdtemp(path.join(os.tmpdir(), 'tse-mcp-srv-')),
  });
  const { servidor } = criarServidor({ config });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await servidor.connect(a);
  cliente = new Client({ name: 'teste', version: '1' });
  await cliente.connect(b);
});
after(() => cliente?.close());

const chamar = async (name, args = {}) => {
  const r = await cliente.callTool({ name, arguments: args });
  assert.ok(!r.isError, r.content[0].text);
  return JSON.parse(r.content[0].text);
};

test('lista as ferramentas esperadas, todas somente-leitura', async () => {
  const { tools } = await cliente.listTools();
  const nomes = tools.map((t) => t.name);
  for (const n of ['tse_fontes', 'tse_consultar', 'tse_buscar_contratos', 'tse_perfil_servidor', 'tse_horas_extras']) {
    assert.ok(nomes.includes(n), n);
  }
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint));
});

test('consulta livre agrupa contratos vigentes por categoria', async () => {
  const r = await chamar('tse_consultar', {
    tabela: 'contratos',
    filtros: [{ campo: 'vigente', op: 'igual', valor: true }],
    agruparPor: ['categoria'],
    metricas: [{ op: 'somar', campo: 'valorGlobal', como: 'valor' }],
  });
  assert.ok(r.itens.length > 0);
  assert.ok(r.itens[0].valor >= r.itens[r.itens.length - 1].valor, 'ordenado pela métrica, desc');
  assert.equal(r._fontes.contratos.origem, 'snapshot');
});

test('ranking conta cada contrato uma vez por pessoa', async () => {
  const r = await chamar('tse_ranking_responsaveis', { limite: 5 });
  assert.equal(r.itens[0].posicao, 1);
  assert.ok(r.itens[0].valorConsolidado >= r.itens[1].valorConsolidado);
});

test('busca de servidor por lotação inclui subunidades', async () => {
  const r = await chamar('tse_buscar_servidores', { lotacao: 'STI', limite: 1000 });
  assert.ok(r.total > 50);
  assert.ok(r.itens.every((s) => s.secretaria === 'STI'));
});

test('perfil de nome ambíguo devolve candidatos', async () => {
  const r = await chamar('tse_perfil_servidor', { nome: 'Silva' });
  assert.equal(r.ambiguo, true);
  assert.ok(r.candidatos.length > 1);
});

test('perfil cruza as fontes de um servidor real do snapshot', async () => {
  const { itens } = await chamar('tse_ranking_responsaveis', { limite: 1 });
  const r = await chamar('tse_perfil_servidor', { nome: itens[0].nome });
  assert.ok(r.contratosComoResponsavel.quantidade > 0);
  assert.match(r.aviso, /nome normalizado/);
});

test('horas extras sempre vêm com aviso de estimativa', async () => {
  const r = await chamar('tse_horas_extras', { visao: 'ciclos' });
  assert.match(r.aviso, /Estimativa/);
  assert.ok(r.itens.some((c) => /Eleições/.test(c.cicloRotulo)));
});

test('terceirizados: resumo e filtro por lotação', async () => {
  const resumo = await chamar('tse_terceirizados', { visao: 'resumo' });
  assert.ok(resumo.ativos > 0);
  const r = await chamar('tse_terceirizados', { lotacao: 'STI', somenteAtivos: true, limite: 3 });
  assert.ok(r.itens.every((p) => p.ativo));
});

test('metodologia disponível como recurso', async () => {
  const r = await cliente.readResource({ uri: 'tse://metodologia' });
  assert.match(r.contents[0].text, /LIMITE SUPERIOR/);
});
