// Mecanismo de correção manual de dados extraídos: quando se sabe, por fonte
// externa confiável, que um campo extraído da fonte oficial está errado (erro
// da própria fonte, não do parser — ver README para o caso que motivou isto),
// a correção fica registrada em `data/tse_excecoes.json` em vez de hardcoded
// no código, com motivo e fonte, para manter a auditabilidade do dashboard.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARQUIVO_PADRAO = path.join(raiz, 'data/tse_excecoes.json');

/** Lê o arquivo de exceções (ver README para o schema). Retorna [] se não existir. */
function carregarExcecoes(caminho = ARQUIVO_PADRAO) {
  if (!existsSync(caminho)) return [];
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

/**
 * Aplica as correções da lista de exceções aos contratos, casando por `id`.
 * Cada campo sobrescrito gera uma entrada em `_correcoes` no contrato
 * resultante (valor original, motivo, fonte) — a correção fica visível em vez
 * de silenciosamente substituir o dado extraído.
 */
function aplicarExcecoes(contratos, excecoes = []) {
  if (!excecoes.length) return contratos;
  const porId = new Map(excecoes.map((e) => [e.id, e]));

  return contratos.map((c) => {
    const excecao = porId.get(c.id);
    if (!excecao) return c;

    const correcoes = Object.entries(excecao.overrides).map(([campo, valorCorrigido]) => ({
      campo,
      valorOriginal: c[campo],
      valorCorrigido,
      motivo: excecao.motivo,
      fonte: excecao.fonte,
    }));

    return {
      ...c,
      ...excecao.overrides,
      _correcoes: [...(c._correcoes ?? []), ...correcoes],
    };
  });
}

export { carregarExcecoes, aplicarExcecoes, ARQUIVO_PADRAO };
