import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RepositorioDados } from '../src/dados.js';

async function preparar({ aoVivo, modo = 'auto', snapshot = [{ v: 'snapshot' }] } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tse-mcp-'));
  const snapDir = path.join(dir, 'snap');
  await mkdir(snapDir, { recursive: true });
  if (snapshot) await writeFile(path.join(snapDir, 'x.json'), JSON.stringify(snapshot));
  let chamadasAoVivo = 0;
  const conjuntos = {
    x: {
      titulo: 'X',
      arquivo: 'x.json',
      ttlHoras: 1,
      aoVivo: aoVivo && (async (base) => (chamadasAoVivo++, aoVivo(base))),
    },
  };
  let agora = Date.parse('2026-01-01T00:00:00Z');
  const repo = new RepositorioDados(
    { modo, diretorioCache: path.join(dir, 'cache'), snapshotDir: snapDir, snapshotUrl: 'http://invalido', ttlMultiplicador: 1 },
    { conjuntos, agora: () => agora },
  );
  return { repo, avancar: (ms) => (agora += ms), chamadas: () => chamadasAoVivo, dir };
}

test('usa a fonte ao vivo quando disponível e guarda em cache', async () => {
  const { repo, chamadas } = await preparar({ aoVivo: async () => [{ v: 'ao-vivo' }] });
  const r = await repo.obter('x');
  assert.equal(r.meta.origem, 'ao-vivo');
  assert.deepEqual(r.dados, [{ v: 'ao-vivo' }]);
  await repo.obter('x');
  assert.equal(chamadas(), 1, 'segunda chamada dentro do TTL não consulta a fonte');
});

test('cai para o snapshot quando a fonte oficial falha, com aviso', async () => {
  const { repo } = await preparar({ aoVivo: async () => { throw new Error('status 403'); } });
  const r = await repo.obter('x');
  assert.equal(r.meta.origem, 'snapshot');
  assert.match(r.meta.avisos[0], /403/);
});

test('após falha ao vivo, espera antes de tentar de novo', async () => {
  const { repo, avancar, chamadas } = await preparar({ aoVivo: async () => { throw new Error('fora do ar'); } });
  await repo.obter('x');
  avancar(2 * 60 * 60 * 1000); // TTL de 1h expirou
  const repo2 = new RepositorioDados(repo.config, { conjuntos: repo.conjuntos, agora: repo.agora });
  await repo2.obter('x');
  assert.equal(chamadas(), 2, 'tentou de novo depois que a espera passou');
});

test('modo snapshot nunca chama a fonte oficial', async () => {
  const { repo, chamadas } = await preparar({ modo: 'snapshot', aoVivo: async () => [{ v: 'ao-vivo' }] });
  const r = await repo.obter('x');
  assert.equal(r.meta.origem, 'snapshot');
  assert.equal(chamadas(), 0);
});

test('modo ao-vivo propaga a falha em vez de usar snapshot', async () => {
  const { repo } = await preparar({ modo: 'ao-vivo', aoVivo: async () => { throw new Error('bloqueado'); } });
  await assert.rejects(repo.obter('x'), /bloqueado/);
});

test('extração incremental recebe a base anterior', async () => {
  let baseRecebida;
  const { repo, avancar } = await preparar({ aoVivo: async (base) => ((baseRecebida = base), [...(base ?? []), { v: 'novo' }]) });
  await repo.obter('x');
  avancar(2 * 60 * 60 * 1000);
  const r = await repo.obter('x');
  assert.deepEqual(baseRecebida, [{ v: 'novo' }]);
  assert.equal(r.dados.length, 2);
});

test('cache em disco expirado é o último recurso', async () => {
  const { repo, avancar } = await preparar({ aoVivo: async () => [{ v: 'ao-vivo' }], snapshot: null });
  await repo.obter('x');
  avancar(2 * 60 * 60 * 1000);
  repo.conjuntos.x.aoVivo = async () => { throw new Error('caiu'); };
  repo.memoria.clear();
  const r = await repo.obter('x');
  assert.equal(r.meta.expirado, true);
  assert.deepEqual(r.dados, [{ v: 'ao-vivo' }]);
});

test('funções: bloqueio da fonte cai para o snapshot em vez de "ao vivo" vazio', async () => {
  const { CONJUNTOS } = await import('../src/dados.js');
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('bloqueado', { status: 403 });
  try {
    await assert.rejects(CONJUNTOS.funcoes.aoVivo([{ nome: 'X', portaria: { url: 'u' } }]), /403/);
  } finally {
    globalThis.fetch = original;
  }
});
