// Agregação pura: cruza a árvore oficial de unidades do TSE (ver
// scrapeUnidades.js) com as pessoas já raspadas por outras fontes
// (agentes públicos, teletrabalho, responsáveis por contrato) para produzir
// uma árvore com contagens de servidores/funções/fiscais/teletrabalho em
// cada nó — tanto "diretas" (só quem está lotado exatamente naquele nó)
// quanto "consolidadas" (soma do nó com toda a subárvore).
//
// O cruzamento é feito por NOME de unidade normalizado: `agente.lotacao`
// (string plana, ver scrapeAgentesPublicos.js) contra `no.nome` da árvore —
// nenhuma das duas fontes compartilha um id de unidade em comum. O campo
// `title` da árvore bruta (contagem de agentes públicos por nó, calculada
// pela própria fonte) é usado só como checagem cruzada manual (ver
// scrapeUnidades.js) — nunca como fonte de verdade das contagens daqui.
import { normalizeNome } from './rankResponsaveis.js';

const MAX_EXEMPLOS = 30;

/** Mesma normalização de rankResponsaveis.js — evita falso-negativo por
 * diferença de composição Unicode (NFC/NFD) entre as duas fontes, além de
 * espaço/caixa (a própria árvore tem inconsistência de espaço à direita em
 * alguns nomes de unidade). */
function normalizeUnidade(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function indexarArvore(no, porId, idPorNomeNormalizado) {
  const id = String(no.id);
  const parentId = no.parentidAsString != null ? String(no.parentidAsString) : null;
  const filhosIds = (no.children ?? []).map((filho) => String(filho.id));
  porId.set(id, { nome: no.nome ?? '', sigla: no.name ?? '', parentId, filhosIds });

  const chave = normalizeUnidade(no.nome);
  if (chave) {
    const lista = idPorNomeNormalizado.get(chave) ?? [];
    lista.push(id);
    idPorNomeNormalizado.set(chave, lista);
  }

  for (const filho of no.children ?? []) indexarArvore(filho, porId, idPorNomeNormalizado);
}

function funcoesParaArray(map) {
  return [...map.values()].sort((a, b) => (a.tipo === b.tipo ? a.nivel - b.nivel : a.tipo === 'FC' ? -1 : 1));
}

function fiscaisParaArray(map) {
  return [...map.values()].sort((a, b) => a.papel.localeCompare(b.papel, 'pt-BR'));
}

function somarFuncoes(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const item of lista) {
      const chave = `${item.tipo}-${item.nivel}`;
      const atual = map.get(chave) ?? { tipo: item.tipo, nivel: item.nivel, quantidade: 0 };
      atual.quantidade += item.quantidade;
      map.set(chave, atual);
    }
  }
  return funcoesParaArray(map);
}

function somarFiscais(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const item of lista) {
      const atual = map.get(item.papel) ?? { papel: item.papel, quantidade: 0 };
      atual.quantidade += item.quantidade;
      map.set(item.papel, atual);
    }
  }
  return fiscaisParaArray(map);
}

/**
 * @param {object} arvoreBruta árvore crua de scrapeUnidades.js.
 * @param {Array} agentesPublicos relação atual de agentes públicos (scrapeAgentesPublicos.js).
 * @param {{ranking: Array}} teletrabalho já agregado por agregarTeletrabalho.js (reaproveita o
 *   conceito de "vigente = tem período em aberto" em vez de reimplementar).
 * @param {Array} rankingResponsaveis ranking de fiscais/gestores (rankResponsaveis.js) — usado só
 *   para saber, por pessoa, quais papéis ela tem em contratos.
 */
function agregarUnidades(arvoreBruta, agentesPublicos = [], teletrabalho = { ranking: [] }, rankingResponsaveis = []) {
  const porId = new Map();
  const idPorNomeNormalizado = new Map();
  indexarArvore(arvoreBruta, porId, idPorNomeNormalizado);

  const metricas = new Map();
  for (const id of porId.keys()) {
    metricas.set(id, { servidores: 0, funcoesMap: new Map(), fiscaisMap: new Map(), teletrabalho: 0 });
  }

  const naoLocalizados = {
    servidores: 0,
    teletrabalho: 0,
    ambiguos: 0,
    exemplos: { servidores: [], teletrabalho: [] },
  };

  function resolverId(nomeUnidade) {
    const chave = normalizeUnidade(nomeUnidade);
    if (!chave) return { id: null, ambiguo: false };
    const ids = idPorNomeNormalizado.get(chave);
    if (!ids || ids.length === 0) return { id: null, ambiguo: false };
    if (ids.length > 1) return { id: null, ambiguo: true };
    return { id: ids[0], ambiguo: false };
  }

  const rankingPorNome = new Map(rankingResponsaveis.map((r, i) => [normalizeNome(r.nome), i]));

  // --- Servidores + funções + fiscais, a partir da relação de agentes públicos ---
  for (const ap of agentesPublicos) {
    const { id, ambiguo } = resolverId(ap.lotacao);
    if (ambiguo) {
      naoLocalizados.ambiguos += 1;
      continue;
    }
    if (!id) {
      naoLocalizados.servidores += 1;
      if (naoLocalizados.exemplos.servidores.length < MAX_EXEMPLOS) {
        naoLocalizados.exemplos.servidores.push(ap.lotacao ?? '(sem lotação)');
      }
      continue;
    }

    const metrica = metricas.get(id);
    metrica.servidores += 1;

    if (ap.funcao) {
      const chave = `${ap.funcao.tipo}-${ap.funcao.nivel}`;
      const atual = metrica.funcoesMap.get(chave) ?? { tipo: ap.funcao.tipo, nivel: ap.funcao.nivel, quantidade: 0 };
      atual.quantidade += 1;
      metrica.funcoesMap.set(chave, atual);
    }

    const indiceResponsavel = rankingPorNome.get(normalizeNome(ap.nome));
    if (indiceResponsavel !== undefined) {
      for (const papel of rankingResponsaveis[indiceResponsavel].papeis) {
        const atual = metrica.fiscaisMap.get(papel) ?? { papel, quantidade: 0 };
        atual.quantidade += 1;
        metrica.fiscaisMap.set(papel, atual);
      }
    }
  }

  // --- Teletrabalho vigente (só quem tem período em aberto hoje) ---
  for (const linha of teletrabalho.ranking) {
    const periodoAberto = linha.periodos.find((p) => p.dataFim === null);
    if (!periodoAberto) continue;

    const menorUnidade = periodoAberto.unidadeNiveis?.[0] ?? null;
    const { id, ambiguo } = resolverId(menorUnidade);
    if (ambiguo) {
      naoLocalizados.ambiguos += 1;
      continue;
    }
    if (!id) {
      naoLocalizados.teletrabalho += 1;
      if (naoLocalizados.exemplos.teletrabalho.length < MAX_EXEMPLOS) {
        naoLocalizados.exemplos.teletrabalho.push(menorUnidade ?? '(sem unidade)');
      }
      continue;
    }

    metricas.get(id).teletrabalho += 1;
  }

  // --- Consolidação bottom-up ---
  function construir(id) {
    const raw = porId.get(id);
    const metrica = metricas.get(id);
    const filhos = raw.filhosIds.map(construir);

    const direto = {
      servidores: metrica.servidores,
      funcoes: funcoesParaArray(metrica.funcoesMap),
      fiscais: fiscaisParaArray(metrica.fiscaisMap),
      teletrabalho: metrica.teletrabalho,
    };
    const consolidado = {
      servidores: direto.servidores + filhos.reduce((s, f) => s + f.consolidado.servidores, 0),
      funcoes: somarFuncoes(direto.funcoes, ...filhos.map((f) => f.consolidado.funcoes)),
      fiscais: somarFiscais(direto.fiscais, ...filhos.map((f) => f.consolidado.fiscais)),
      teletrabalho: direto.teletrabalho + filhos.reduce((s, f) => s + f.consolidado.teletrabalho, 0),
    };

    return { id, nome: raw.nome, sigla: raw.sigla, parentId: raw.parentId, direto, consolidado, children: filhos };
  }

  const arvore = construir(String(arvoreBruta.id));

  return {
    arvore,
    totalServidoresTSE: arvore.consolidado.servidores,
    naoLocalizados,
  };
}

export { agregarUnidades, normalizeUnidade };
