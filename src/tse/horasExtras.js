// Estimativa da QUANTIDADE de horas extras a partir do VALOR pago na rubrica
// "HORAS EXTRAS" do contracheque (Anexo VIII da folha de pagamento do TSE).
//
// A fonte publica só o valor em R$ — não as horas. A conversão segue a fórmula
// da Resolução TSE nº 22.901/2008, art. 9º (com as redações das Resoluções
// 23.497/2016 e 23.629/2020):
//
//   salário-hora normal   = remuneração mensal ÷ divisor
//   salário-hora extra     = salário-hora normal × (1 + adicional)
//                            adicional = 50% em dia útil/sábado, 100% domingo/feriado
//   horas estimadas        = valor pago na rubrica ÷ salário-hora extra
//
// O `divisor` mudou ao longo do tempo (200 → 175 → 200) e a rubrica é um valor
// único que NÃO separa dia útil de domingo — por isso o número é uma ESTIMATIVA.
// Fixamos o adicional em 50% (fator 1,5): como a hora de domingo/feriado custa o
// dobro, qualquer hora que na verdade tenha sido domingo/feriado entra inflada
// em até 33%, então `horas` (fator 1,5) é um LIMITE SUPERIOR e `horasMin`
// (fator 2,0) é o piso.
//
// Base de cálculo ("remuneração mensal"): a melhor aproximação disponível no
// Anexo VIII é "VENCIMENTOS E VANTAGENS" + "EXERCÍCIO FC/CJ" + "REMUNERAÇÃO
// ÓRGÃO ORIGEM". Esta última cobre o servidor REQUISITADO, cuja remuneração
// básica é paga pelo órgão de origem mas cuja hora extra o TSE calcula sobre a
// remuneração total e paga — ver src/tse/scrapeHorasExtras.js (parseContracheque).

/** "AAAA-MM" a partir de ano/mês numéricos. */
export const chaveCompetencia = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`;

// Redação original (2008) e a da Res. 23.629/2020 usam divisor 200; a da
// Res. 23.497/2016 (publicada em dez/2016) usou 175. Faixa aproximada — as
// datas exatas de vigência no DJE ainda podem deslocar o limite em um mês.
const DIVISOR_175_DE = '2017-01';
const DIVISOR_175_ATE = '2020-02';

/** Divisor do salário-hora (art. 9º) vigente na competência "AAAA-MM".
 *  Não trata o caso de jornada de 30h/sem (divisor 150) — não identificável na
 *  fonte; ver limitações no README. */
export function divisorPorCompetencia(chave) {
  if (chave >= DIVISOR_175_DE && chave <= DIVISOR_175_ATE) return 175;
  return 200;
}

// Limite mensal de serviço extraordinário (art. 4º), também alterado ao longo
// do tempo. Usado só como TETO DE SANIDADE: estimativa acima disso (com folga)
// vira uma flag, não é descartada.
export function tetoMensalPorCompetencia(chave) {
  if (chave >= '2020-03') return 60 + 30; // 60h (regra) + até 30h p/ compensação
  if (chave >= '2017-01') return 124;
  return 124; // redação original: 44h, estendível até 124h — usamos o teto estendido
}

// Anos com eleição ordinária — usados só para AGRUPAR as horas por ciclo
// (o volume dispara nesses anos). Meses de anos sem eleição ordinária caem no
// balde "Outros meses" (eleições suplementares, plebiscitos, recesso — que
// ocorrem ao longo de todo o ano); não é um sinal de anomalia.
export const CICLOS_ELEITORAIS = [
  { ano: 2008, tipo: 'municipal' },
  { ano: 2010, tipo: 'geral' },
  { ano: 2012, tipo: 'municipal' },
  { ano: 2014, tipo: 'geral' },
  { ano: 2016, tipo: 'municipal' },
  { ano: 2018, tipo: 'geral' },
  { ano: 2020, tipo: 'municipal' },
  { ano: 2022, tipo: 'geral' },
  { ano: 2024, tipo: 'municipal' },
  { ano: 2026, tipo: 'geral' },
  { ano: 2028, tipo: 'municipal' },
];

const rotuloCiclo = (ano, tipo) =>
  `Eleições ${ano}${tipo === 'geral' ? ' (gerais)' : tipo === 'municipal' ? ' (municipais)' : ''}`;

/**
 * Ciclo eleitoral de uma competência "AAAA-MM", só para agrupar as horas na
 * apresentação. A competência pertence ao ciclo do seu próprio ano quando esse
 * ano tem eleição ordinária; janeiro é atribuído também ao ciclo do ano
 * anterior (diplomação/pagamentos residuais). `null` = ano sem eleição
 * ordinária (agrupado como "Outros meses").
 */
export function cicloEleitoralDe(chave) {
  const [anoStr, mesStr] = String(chave).split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const doAno = CICLOS_ELEITORAIS.find((c) => c.ano === ano);
  if (doAno) return { ciclo: String(ano), rotulo: rotuloCiclo(ano, doAno.tipo), tipo: doAno.tipo };
  if (mes === 1) {
    const doAnoAnterior = CICLOS_ELEITORAIS.find((c) => c.ano === ano - 1);
    if (doAnoAnterior) {
      return {
        ciclo: String(ano - 1),
        rotulo: rotuloCiclo(ano - 1, doAnoAnterior.tipo),
        tipo: doAnoAnterior.tipo,
      };
    }
  }
  return null;
}

/**
 * Converte o valor pago na rubrica "HORAS EXTRAS" em uma estimativa de horas.
 *
 * @param {object} p
 * @param {number} p.valorRubrica  R$ pagos na rubrica "HORAS EXTRAS" no mês.
 * @param {number} p.base          R$ da "remuneração mensal" (aprox.: VENCIMENTOS
 *                                 E VANTAGENS + EXERCÍCIO FC/CJ).
 * @param {string} p.chaveCompetencia  "AAAA-MM".
 * @param {number} [p.fator=1.5]   1 + adicional (1,5 = +50%).
 * @returns {{
 *   horas: number|null, horasMin: number|null, divisor: number,
 *   valorHoraNormal: number|null, acimaDoTeto: boolean,
 *   ciclo: {ciclo:string,rotulo:string,tipo:string}|null
 * }}
 */
export function estimarHorasExtras({ valorRubrica, base, chaveCompetencia: chave, fator = 1.5 }) {
  const divisor = divisorPorCompetencia(chave);
  const valorHoraNormal = base > 0 ? base / divisor : null;
  const horas =
    valorHoraNormal && valorHoraNormal > 0 ? valorRubrica / (valorHoraNormal * fator) : null;
  const horasMin =
    valorHoraNormal && valorHoraNormal > 0 ? valorRubrica / (valorHoraNormal * 2.0) : null;
  return {
    horas,
    horasMin,
    divisor,
    valorHoraNormal,
    acimaDoTeto: horas != null && horas > tetoMensalPorCompetencia(chave),
    ciclo: cicloEleitoralDe(chave),
  };
}
