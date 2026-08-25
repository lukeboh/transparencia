// Agregação pura de períodos de teletrabalho por servidor.
//
// Formato esperado de um registro cru (ver scrapeTeletrabalho.js):
// { nome, unidade, unidadeNiveis: string[], dataInicio: 'DD/MM/AAAA',
//   dataFim: 'DD/MM/AAAA'|null }
//
// A fonte de teletrabalho não expõe matrícula nem CPF — o cruzamento com o
// ranking de responsáveis (fiscais/gestores de contrato) só pode ser por
// nome normalizado, como já acontece em agregarFuncoes.js.
import { normalizeNome } from './rankResponsaveis.js';
import { paraDataISO } from './datas.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diasEntre(inicioISO, fimISO) {
  const a = Date.parse(inicioISO);
  const b = Date.parse(fimISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / MS_POR_DIA) + 1);
}

/**
 * Consolida os períodos de uma pessoa. Soma os dias de cada período — não
 * faz merge de intervalos sobrepostos (se a fonte tiver dois períodos que se
 * sobrepõem para a mesma pessoa, os dias sobrepostos são contados duas
 * vezes). É uma simplificação deliberada: sobreposição não é o caso comum
 * (cada período normalmente reflete uma autorização/renovação distinta) e
 * detectar/mesclar intervalos custa mais complexidade do que o benefício
 * aqui.
 */
function agregarTeletrabalho(registros, rankingResponsaveis = [], hojeISO = new Date().toISOString().slice(0, 10)) {
  const porPessoa = new Map();

  for (const r of registros) {
    if (!r.nome) continue;
    const chave = normalizeNome(r.nome);
    if (!porPessoa.has(chave)) porPessoa.set(chave, { nome: r.nome, periodos: [] });

    const dataInicioISO = paraDataISO(r.dataInicio) ?? null;
    const dataFimISO = r.dataFim ? (paraDataISO(r.dataFim) ?? null) : null;
    const fimEfetivoISO = dataFimISO ?? hojeISO;
    const dias = dataInicioISO ? diasEntre(dataInicioISO, fimEfetivoISO) : 0;

    porPessoa.get(chave).periodos.push({
      unidade: r.unidade,
      unidadeNiveis: r.unidadeNiveis,
      dataInicio: dataInicioISO,
      dataFim: dataFimISO,
      dias,
    });
  }

  const rankingPorNome = new Map(rankingResponsaveis.map((r, i) => [normalizeNome(r.nome), i]));

  const ranking = [...porPessoa.values()].map((p) => {
    const periodos = [...p.periodos].sort((a, b) => (b.dataInicio ?? '').localeCompare(a.dataInicio ?? ''));
    const diasConsolidados = periodos.reduce((s, per) => s + per.dias, 0);
    return {
      nome: p.nome,
      diasConsolidados,
      periodos,
      responsavelRankingIndex: rankingPorNome.get(normalizeNome(p.nome)) ?? null,
    };
  });

  ranking.sort((a, b) => b.diasConsolidados - a.diasConsolidados);

  const calcMediana = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    if (s.length === 0) return 0;
    return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  return {
    total: ranking.length,
    medianaDias: calcMediana(ranking.map((r) => r.diasConsolidados)),
    ranking,
  };
}

export { agregarTeletrabalho, diasEntre };
