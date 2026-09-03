// Agregação pura das horas extras (serviço extraordinário) por servidor, a
// partir do histórico mês a mês de valores da rubrica "HORAS EXTRAS" raspado
// por src/tse/scrapeHorasExtras.js.
//
// A fonte publica só o VALOR em R$; a QUANTIDADE de horas é estimada aqui pela
// fórmula da Resolução TSE nº 22.901/2008 (ver src/tse/horasExtras.js).
//
// PRIVACIDADE: o que sai daqui — e que acaba no snapshot enviado ao navegador —
// contém APENAS grandezas de tempo (horas) e metadados (divisor, ciclo,
// flags). Nenhum valor em R$ (nem a rubrica, nem a base de cálculo) é exposto:
// a conferência dos reais é feita direto no Anexo VIII do TSE (link na UI).
import { normalizeNome } from './rankResponsaveis.js';
import { estimarHorasExtras, cicloEleitoralDe, chaveCompetencia } from './horasExtras.js';

const MESES_ROTULO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "AAAA-MM" → "Mês/AAAA". */
export function rotuloCompetencia(chave) {
  const [ano, mes] = String(chave).split('-').map(Number);
  return mes >= 1 && mes <= 12 ? `${MESES_ROTULO[mes - 1]}/${ano}` : String(chave);
}

/** "MM/AAAA" (rótulo da rubrica) → "AAAA-MM"; entrada inválida → null. */
function chaveDeRef(ref) {
  const m = /^(\d{2})\/(\d{4})$/.exec(String(ref ?? '').trim());
  return m ? `${m[2]}-${m[1]}` : null;
}

/** Aceita o objeto novo ({ porCompetencia, ... }) ou o array cru legado. */
function normalizarEntrada(entrada) {
  if (Array.isArray(entrada)) {
    return { porCompetencia: entrada.length ? { __atual__: entrada } : {} };
  }
  return { porCompetencia: entrada?.porCompetencia ?? {} };
}

const mediana = (nums) => {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * @param {object|Array} entrada saída de scrapeHorasExtras.js (com `porCompetencia`).
 * @returns {{
 *   competencias: string[], totalHoras: number, medianaHoras: number,
 *   ciclos: {ciclo:string,rotulo:string,tipo:string,horas:number,servidores:number}[],
 *   ranking: object[],
 *   ocorrencias: {nomeNorm:string,nome:string,unidade:string,chave:string,cicloId:string|null,horas:number}[]
 * }}
 */
function agregarHorasExtras(entrada) {
  const { porCompetencia } = normalizarEntrada(entrada);

  // --- Índice de base por (pessoa, competência da FOLHA) ---
  // A rubrica "HORAS EXTRAS" é de um mês de REFERÊNCIA (rub.ref); a base a usar
  // é a remuneração da pessoa NAQUELE mês, não a da folha em que o valor foi
  // pago. Folhas de pagamento parciais (licença, saída de função) têm
  // "VENCIMENTOS E VANTAGENS" reduzido e distorceriam a estimativa. Preferimos,
  // nesta ordem: base do contracheque do próprio mês de referência da pessoa →
  // mediana das bases observadas dela → base da folha de pagamento.
  const basePorPessoaComp = new Map(); // `${nomeNorm}|${chaveFolha}` -> base
  const basesPorPessoa = new Map(); // nomeNorm -> number[]
  for (const chaveFolha of Object.keys(porCompetencia)) {
    for (const reg of porCompetencia[chaveFolha] ?? []) {
      const nomeNorm = normalizeNome(reg.nome);
      if (!nomeNorm || !(reg.base > 0)) continue;
      basePorPessoaComp.set(`${nomeNorm}|${chaveFolha}`, reg.base);
      const arr = basesPorPessoa.get(nomeNorm) ?? [];
      arr.push(reg.base);
      basesPorPessoa.set(nomeNorm, arr);
    }
  }
  const medianaBasePorPessoa = new Map(
    [...basesPorPessoa].map(([k, v]) => [k, mediana(v)]),
  );
  /** Base a usar para a rubrica de `nomeNorm` referente a `chaveRef`.
   *  Preferência: base do próprio mês de referência → base da folha de
   *  pagamento → mediana das bases da pessoa. Uma base < 60% da mediana da
   *  pessoa é tida como PARCIAL (mês de licença/saída de função) e pulada. */
  function baseParaRef(nomeNorm, chaveRef, baseDaFolha) {
    const med = medianaBasePorPessoa.get(nomeNorm) ?? 0;
    const parcial = (b) => med > 0 && b > 0 && b < med * 0.6;
    const doRef = basePorPessoaComp.get(`${nomeNorm}|${chaveRef}`) ?? 0;
    if (doRef > 0 && !parcial(doRef)) return doRef;
    if (baseDaFolha > 0 && !parcial(baseDaFolha)) return baseDaFolha;
    return med > 0 ? med : doRef || baseDaFolha;
  }

  // Um mês-pessoa só entra na apresentação (e nos totais) se a estimativa
  // daquele mês arredonda para ≥ 1 h. Abaixo disso são alguns reais de acerto
  // de folha / rubrica residual — fica no arquivo cru para controle, mas não é
  // mostrado nem somado, para o total bater com o que se vê.
  const LIMIAR_EXIBICAO = 0.5;

  // pessoa (nome normalizado) -> { nome, porCompetencia: Map<chaveRef, ec> }
  //   ec = { chave, horas, horasMin, acimaDoTeto, unidades: Set }
  const pessoas = new Map();
  const competenciasRef = new Set();

  for (const chaveFolha of Object.keys(porCompetencia)) {
    for (const reg of porCompetencia[chaveFolha] ?? []) {
      const nomeNorm = normalizeNome(reg.nome);
      if (!nomeNorm) continue;
      const rubricas = Array.isArray(reg.rubricas) && reg.rubricas.length
        ? reg.rubricas
        : [{ ref: null, valor: reg.valorRubrica ?? 0 }];

      let pessoa = pessoas.get(nomeNorm);
      if (!pessoa) {
        pessoa = { nome: reg.nome, porCompetencia: new Map() };
        pessoas.set(nomeNorm, pessoa);
      }

      for (const rub of rubricas) {
        if (!(rub.valor > 0)) continue;
        const chaveRef =
          chaveDeRef(rub.ref) ??
          (/^\d{4}-\d{2}$/.test(chaveFolha) ? chaveFolha : null);
        if (!chaveRef) continue;

        const est = estimarHorasExtras({
          valorRubrica: rub.valor,
          base: baseParaRef(nomeNorm, chaveRef, reg.base ?? 0),
          chaveCompetencia: chaveRef,
        });
        if (est.horas == null) continue; // base ausente/zerada — não dá para estimar

        const ec = pessoa.porCompetencia.get(chaveRef) ?? {
          chave: chaveRef,
          horas: 0,
          horasMin: 0,
          acimaDoTeto: false,
          unidades: new Set(),
        };
        ec.horas += est.horas;
        ec.horasMin += est.horasMin ?? 0;
        ec.acimaDoTeto = ec.acimaDoTeto || est.acimaDoTeto;
        if (reg.unidade) ec.unidades.add(reg.unidade);
        pessoa.porCompetencia.set(chaveRef, ec);
      }
    }
  }

  // --- Pós-processamento: aplica o limiar e monta as saídas ---
  const ciclos = new Map(); // cicloId -> { rotulo, tipo, horas, servidores:Set }
  const ocorrencias = [];

  const ranking = [...pessoas.values()]
    .map((p) => {
      const comps = [...p.porCompetencia.values()]
        .filter((c) => c.horas >= LIMIAR_EXIBICAO)
        .sort((a, b) => a.chave.localeCompare(b.chave));
      const horasConsolidadas = comps.reduce((s, c) => s + c.horas, 0);
      const horasConsolidadasMin = comps.reduce((s, c) => s + c.horasMin, 0);
      const mesesComHE = comps.length;

      const nomeNorm = normalizeNome(p.nome);
      const porCicloMap = new Map();
      for (const c of comps) {
        const ci = cicloEleitoralDe(c.chave);
        const cicloId = ci?.ciclo ?? 'outros';
        const rotulo = ci?.rotulo ?? 'Outros meses';
        const tipo = ci?.tipo ?? 'outros';

        const pc = porCicloMap.get(cicloId) ?? { ciclo: cicloId, rotulo, tipo, horas: 0, meses: 0 };
        pc.horas += c.horas;
        pc.meses += 1;
        porCicloMap.set(cicloId, pc);

        const gc = ciclos.get(cicloId) ?? { ciclo: cicloId, rotulo, tipo, horas: 0, servidores: new Set() };
        gc.horas += c.horas;
        gc.servidores.add(nomeNorm);
        ciclos.set(cicloId, gc);

        for (const unidade of c.unidades) {
          ocorrencias.push({ nomeNorm, nome: p.nome, unidade, chave: c.chave, cicloId: ci?.ciclo ?? null, horas: c.horas / c.unidades.size });
        }
        competenciasRef.add(c.chave);
      }

      return {
        nome: p.nome,
        horasConsolidadas,
        horasConsolidadasMin,
        mesesComHE,
        mediaMensal: mesesComHE ? horasConsolidadas / mesesComHE : 0,
        ultimaCompetencia: comps.length ? comps[comps.length - 1].chave : null,
        porCiclo: [...porCicloMap.values()].sort((a, b) => a.ciclo.localeCompare(b.ciclo)),
        // Enxuto: `rotulo` sai de `chave` no cliente (mesAnoCurto); `horasMin`
        // e `divisor` por mês não são exibidos — só a faixa consolidada.
        porCompetencia: comps.map((c) => ({
          chave: c.chave,
          horas: c.horas,
          acimaDoTeto: c.acimaDoTeto,
        })),
        flags: {
          acimaDoTeto: comps.filter((c) => c.acimaDoTeto).length,
        },
      };
    })
    .filter((r) => r.horasConsolidadas >= LIMIAR_EXIBICAO)
    .sort((a, b) => b.horasConsolidadas - a.horasConsolidadas);

  return {
    competencias: [...competenciasRef].sort(),
    totalHoras: ranking.reduce((s, r) => s + r.horasConsolidadas, 0),
    medianaHoras: mediana(ranking.map((r) => r.horasConsolidadas)),
    ciclos: [...ciclos.values()]
      .map((c) => ({ ciclo: c.ciclo, rotulo: c.rotulo, tipo: c.tipo, horas: c.horas, servidores: c.servidores.size }))
      .sort((a, b) => a.ciclo.localeCompare(b.ciclo)),
    ranking,
    ocorrencias,
  };
}

export { agregarHorasExtras, chaveCompetencia };
