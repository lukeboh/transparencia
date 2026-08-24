// Agregação pura de função comissionada. Duas fontes:
//
// - PRIMÁRIA: `agentesPublicos` (ver scrapeAgentesPublicos.js) — a "Relação
//   de agentes públicos" atual do TSE, com quem tem FC/CJ HOJE, matrícula,
//   cargo e lotação. Rápida, confiável, mas sem histórico.
// - SECUNDÁRIA: `movimentosFuncoes` (ver scrapeFuncoes.js) — eventos de
//   início/fim de função extraídos das portarias, usados só para reconstruir
//   o HISTÓRICO (quando cada mandato começou/terminou e por qual portaria) e
//   enriquecer o que a fonte primária já disse que é verdade agora.
//
// Formato esperado de um agente público:
// { nome, matricula, cargo, funcao: {tipo,nivel,cargoTitulo}|null, lotacao,
//   atoProvimento, dataPublicacao, observacoes: string[] }
//
// Formato esperado de um movimento:
// { tipo: 'inicio'|'fim', func: 'FC'|'CJ', nivel, cargoTitulo, unidade, nome,
//   portaria: { numero, ano, data, url }, dataEfetiva }
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
 *
 * `vigente` aqui reflete só o que as PORTARIAS dizem (não tem "fim"
 * localizado) — pode divergir do estado atual real; é por isso que
 * `funcaoAtual` (da fonte primária) manda no que a UI mostra como "hoje", e
 * a divergência entre os dois vira observação (ver `agregarFuncoes`).
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

function agregarFuncoes(agentesPublicos, movimentosFuncoes, contratos) {
  // 1) Histórico por pessoa, a partir das portarias (secundário).
  const movimentosPorPessoa = new Map();
  for (const mv of movimentosFuncoes) {
    const chave = normalizeNome(mv.nome);
    if (!movimentosPorPessoa.has(chave)) movimentosPorPessoa.set(chave, { nome: mv.nome, movimentos: [] });
    movimentosPorPessoa.get(chave).movimentos.push(mv);
  }

  // 2) Universo primário: todo agente público com função hoje.
  const porChave = new Map();
  for (const ap of agentesPublicos) {
    if (!ap.funcao) continue; // fora do escopo de /funcoes — não é FC/CJ
    const chave = normalizeNome(ap.nome);
    porChave.set(chave, {
      nome: ap.nome,
      matricula: ap.matricula,
      cargo: ap.cargo,
      lotacao: ap.lotacao,
      funcaoAtual: ap.funcao,
      atoProvimentoAtual:
        ap.atoProvimento || ap.dataPublicacao
          ? { descricao: ap.atoProvimento, data: ap.dataPublicacao }
          : null,
      naRelacaoAtual: true,
      mandatos: [],
      observacoes: [...ap.observacoes],
    });
  }

  // 3) Enriquece com o histórico das portarias; quem só aparece nas
  // portarias (não está mais na relação atual — provavelmente saiu do TSE)
  // entra como um registro histórico à parte, sinalizado como tal.
  for (const [chave, info] of movimentosPorPessoa) {
    const mandatos = construirMandatos(info.movimentos);
    const existente = porChave.get(chave);
    if (existente) {
      existente.mandatos = mandatos;
    } else {
      porChave.set(chave, {
        nome: info.nome,
        matricula: null,
        cargo: null,
        lotacao: null,
        funcaoAtual: null,
        atoProvimentoAtual: null,
        naRelacaoAtual: false,
        mandatos,
        observacoes: [
          'Não consta na relação atual de agentes públicos do TSE — pode ter deixado o órgão, se aposentado, ou o nome pode ter mudado entre as duas fontes.',
        ],
      });
    }
  }

  // 4) Reconciliação: a fonte primária (agora) e o histórico de portarias
  // deveriam concordar sobre quem está em função hoje. Quando não concordam,
  // registra a divergência em vez de decidir sozinho qual fonte está certa.
  for (const s of porChave.values()) {
    const mandatoVigente = s.mandatos.find((m) => m.vigente);
    if (s.funcaoAtual && !mandatoVigente) {
      s.observacoes.push(
        `A relação atual de agentes públicos indica função vigente ${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel} ` +
          `(${s.funcaoAtual.cargoTitulo}), mas nenhuma portaria de nomeação vigente foi localizada no histórico coberto.`,
      );
    } else if (s.funcaoAtual && mandatoVigente &&
      (mandatoVigente.tipo !== s.funcaoAtual.tipo || mandatoVigente.nivel !== s.funcaoAtual.nivel)) {
      s.observacoes.push(
        `Divergência entre fontes: a relação atual de agentes públicos indica ${s.funcaoAtual.tipo}-${s.funcaoAtual.nivel} ` +
          `(${s.funcaoAtual.cargoTitulo}), mas o histórico de portarias indica ${mandatoVigente.tipo}-${mandatoVigente.nivel} ` +
          `(${mandatoVigente.cargoTitulo}) como vigente.`,
      );
    } else if (!s.funcaoAtual && mandatoVigente) {
      s.observacoes.push(
        `O histórico de portarias indica função vigente ${mandatoVigente.tipo}-${mandatoVigente.nivel} ` +
          `(${mandatoVigente.cargoTitulo}), mas a relação atual de agentes públicos não mostra função para este ` +
          'servidor — pode ter sido dispensado recentemente, fora do período coberto pelo histórico de portarias.',
      );
    }
  }

  // 5) Cruzamento com contratos (fiscal/gestor) por nome normalizado — só
  // dá pra ser por nome porque nem a fonte de portarias nem a de agentes
  // públicos expõem o CPF mascarado usado do lado dos contratos.
  const rankingBase = rankResponsaveis(contratos);
  const rankingComFuncao = rankingBase.map((r) => ({
    ...r,
    contratos: r.contratos.map((c) => ({ ...c, funcaoNoContrato: null })),
  }));
  const rankingPorNome = new Map(rankingComFuncao.map((r) => [normalizeNome(r.nome), r]));
  const contratoPorId = new Map(contratos.map((c) => [c.id, c]));

  const servidores = [];
  for (const [chave, s] of porChave) {
    const linhaRanking = rankingPorNome.get(chave);
    if (linhaRanking) {
      for (const c of linhaRanking.contratos) {
        const contrato = contratoPorId.get(c.id);
        if (!contrato) continue;
        const inicioISO = paraDataISO(contrato.vigenciaInicio);
        const fimISO = paraDataISO(contrato.vigenciaFim);
        const mandato = s.mandatos.find((m) => cobreVigencia(m, inicioISO, fimISO));
        c.funcaoNoContrato = mandato
          ? { tipo: mandato.tipo, nivel: mandato.nivel, cargoTitulo: mandato.cargoTitulo }
          : null;
      }
    }
    servidores.push({ ...s, zeroFiscal: !linhaRanking });
  }

  servidores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { servidores, rankingComFuncao };
}

export { agregarFuncoes, construirMandatos, cobreVigencia };
