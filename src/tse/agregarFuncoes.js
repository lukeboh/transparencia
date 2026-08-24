// Agregação pura: uma lista de "movimentos" (eventos de início/fim de função
// comissionada extraídos das portarias, ver scrapeFuncoes.js) → o histórico
// de mandatos de cada servidor, cruzado com os contratos que ele fiscaliza
// (quando fiscaliza algum).
//
// Formato esperado de um movimento:
// {
//   tipo: 'inicio' | 'fim',
//   func: 'FC' | 'CJ',
//   nivel: number,
//   cargoTitulo: string,
//   unidade: string,
//   nome: string,
//   portaria: { numero, ano, data, url },
//   dataEfetiva: string (ISO) | null,
// }
import { rankResponsaveis, normalizeNome } from './rankResponsaveis.js';
import { paraDataISO } from './datas.js';

/**
 * Pareia sequencialmente os movimentos de uma pessoa em mandatos. Cada
 * 'inicio' abre um mandato; o próximo 'fim' da mesma pessoa o fecha. Um
 * 'inicio' sem 'fim' anterior ainda aberto fica `vigente`; um 'fim' sem
 * 'inicio' aberto correspondente vira um mandato com `nomeacaoData: null`
 * (o início ficou fora da janela pesquisada ou não foi localizado). É uma
 * heurística FIFO por pessoa — assume que alguém não acumula duas funções
 * comissionadas simultaneamente, o que é a regra geral no serviço público.
 */
function construirMandatos(movimentos) {
  const ordenados = [...movimentos].sort((a, b) =>
    (a.dataEfetiva ?? '').localeCompare(b.dataEfetiva ?? ''),
  );

  const mandatos = [];
  let aberto = null;

  for (const mv of ordenados) {
    if (mv.tipo === 'inicio') {
      if (aberto) {
        // Início novo sem que o anterior tenha sido formalmente encerrado
        // (portaria de exoneração não localizada) — fecha o anterior nesta
        // data por aproximação.
        mandatos.push({ ...aberto, vigente: false });
      }
      aberto = {
        tipo: mv.func,
        nivel: mv.nivel,
        cargoTitulo: mv.cargoTitulo,
        unidade: mv.unidade,
        nomeacaoData: mv.dataEfetiva,
        nomeacaoPortaria: mv.portaria,
        exoneracaoData: null,
        exoneracaoPortaria: null,
        vigente: true,
      };
    } else if (aberto) {
      aberto.exoneracaoData = mv.dataEfetiva;
      aberto.exoneracaoPortaria = mv.portaria;
      aberto.vigente = false;
      mandatos.push(aberto);
      aberto = null;
    } else {
      mandatos.push({
        tipo: mv.func,
        nivel: mv.nivel,
        cargoTitulo: mv.cargoTitulo,
        unidade: mv.unidade,
        nomeacaoData: null,
        nomeacaoPortaria: null,
        exoneracaoData: mv.dataEfetiva,
        exoneracaoPortaria: mv.portaria,
        vigente: false,
      });
    }
  }
  if (aberto) mandatos.push(aberto);

  return mandatos.sort((a, b) => (a.nomeacaoData ?? '').localeCompare(b.nomeacaoData ?? ''));
}

/** Um mandato "cobre" a vigência de um contrato quando os intervalos se sobrepõem. */
function cobreVigencia(mandato, inicioContratoISO, fimContratoISO) {
  if (!inicioContratoISO && !fimContratoISO) return false;
  if (mandato.nomeacaoData && fimContratoISO && mandato.nomeacaoData > fimContratoISO) return false;
  if (mandato.exoneracaoData && inicioContratoISO && mandato.exoneracaoData < inicioContratoISO) return false;
  return true;
}

function agregarFuncoes(movimentos, contratos) {
  const porPessoa = new Map();
  for (const mv of movimentos) {
    const chave = normalizeNome(mv.nome);
    if (!porPessoa.has(chave)) porPessoa.set(chave, { nome: mv.nome, movimentos: [] });
    porPessoa.get(chave).movimentos.push(mv);
  }

  const rankingBase = rankResponsaveis(contratos);
  const rankingComFuncao = rankingBase.map((r) => ({
    ...r,
    contratos: r.contratos.map((c) => ({ ...c, funcaoNoContrato: null })),
  }));
  const rankingPorNome = new Map(rankingComFuncao.map((r) => [normalizeNome(r.nome), r]));
  const contratoPorId = new Map(contratos.map((c) => [c.id, c]));

  const servidores = [];
  for (const [chave, info] of porPessoa) {
    const mandatos = construirMandatos(info.movimentos);
    const linhaRanking = rankingPorNome.get(chave);

    if (linhaRanking) {
      for (const c of linhaRanking.contratos) {
        const contrato = contratoPorId.get(c.id);
        if (!contrato) continue;
        const inicioISO = paraDataISO(contrato.vigenciaInicio);
        const fimISO = paraDataISO(contrato.vigenciaFim);
        const mandato = mandatos.find((m) => cobreVigencia(m, inicioISO, fimISO));
        c.funcaoNoContrato = mandato
          ? { tipo: mandato.tipo, nivel: mandato.nivel, cargoTitulo: mandato.cargoTitulo }
          : null;
      }
    }

    servidores.push({ nome: info.nome, zeroFiscal: !linhaRanking, mandatos });
  }

  servidores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { servidores, rankingComFuncao };
}

export { agregarFuncoes, construirMandatos, cobreVigencia };
