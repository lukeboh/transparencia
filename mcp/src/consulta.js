// Motor de consulta genérico sobre listas de objetos: filtros, ordenação,
// agrupamento com métricas, projeção de campos e paginação. É o que permite à
// IA recortar os dados "do jeito que quiser" sem uma ferramenta por pergunta.
//
// Caminhos de campo usam ponto ("responsaveis.nome"); quando um trecho do
// caminho é uma lista, o valor vira a lista dos valores dos elementos e o
// filtro casa se QUALQUER elemento casar.
//
// Comparação de texto é sempre sem acento e sem distinção de caixa.

export const OPERADORES = [
  'igual', 'diferente', 'contem', 'nao_contem', 'comeca_com', 'termina_com',
  'maior', 'maior_igual', 'menor', 'menor_igual', 'entre', 'em', 'fora_de',
  'existe', 'nao_existe', 'regex',
];
export const METRICAS = ['contar', 'contar_distintos', 'somar', 'media', 'mediana', 'min', 'max'];

export const LIMITE_PADRAO = 50;
export const LIMITE_MAXIMO = 1000;

export function normalizarTexto(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Valor(es) de um caminho com ponto; atravessa listas achatando. */
export function valorDe(obj, caminho) {
  let atuais = [obj];
  let virouLista = false;
  for (const parte of String(caminho).split('.')) {
    const prox = [];
    for (const a of atuais) {
      if (a == null) continue;
      const v = a[parte];
      if (Array.isArray(v)) {
        virouLista = true;
        prox.push(...v);
      } else if (v !== undefined) {
        prox.push(v);
      }
    }
    atuais = prox;
  }
  if (virouLista) return atuais;
  return atuais.length ? atuais[0] : undefined;
}

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);

function comparar(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulos sempre ao fim
  if (b == null) return -1;
  if (ehNumero(a) && ehNumero(b)) return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return normalizarTexto(a).localeCompare(normalizarTexto(b), 'pt-BR', { numeric: true });
}

/** Converte o valor do filtro para o tipo do dado (número/booleano/texto). */
function coagir(alvo, valor) {
  if (ehNumero(alvo) && typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor))) {
    return Number(valor);
  }
  if (typeof alvo === 'boolean' && typeof valor === 'string') return valor.toLowerCase() === 'true';
  return valor;
}

function casaEscalar(v, op, valor) {
  switch (op) {
    case 'existe':
      return v !== null && v !== undefined && v !== '';
    case 'nao_existe':
      return v === null || v === undefined || v === '';
    case 'igual':
      return comparar(v, coagir(v, valor)) === 0 && v != null;
    case 'diferente':
      return v == null || comparar(v, coagir(v, valor)) !== 0;
    case 'contem':
      return v != null && normalizarTexto(v).includes(normalizarTexto(valor));
    case 'nao_contem':
      return v == null || !normalizarTexto(v).includes(normalizarTexto(valor));
    case 'comeca_com':
      return v != null && normalizarTexto(v).startsWith(normalizarTexto(valor));
    case 'termina_com':
      return v != null && normalizarTexto(v).endsWith(normalizarTexto(valor));
    case 'maior':
      return v != null && comparar(v, coagir(v, valor)) > 0;
    case 'maior_igual':
      return v != null && comparar(v, coagir(v, valor)) >= 0;
    case 'menor':
      return v != null && comparar(v, coagir(v, valor)) < 0;
    case 'menor_igual':
      return v != null && comparar(v, coagir(v, valor)) <= 0;
    case 'entre': {
      const [de, ate] = Array.isArray(valor) ? valor : [];
      return v != null && comparar(v, coagir(v, de)) >= 0 && comparar(v, coagir(v, ate)) <= 0;
    }
    case 'em':
      return v != null && (Array.isArray(valor) ? valor : [valor]).some((x) => comparar(v, coagir(v, x)) === 0);
    case 'fora_de':
      return v == null || !(Array.isArray(valor) ? valor : [valor]).some((x) => comparar(v, coagir(v, x)) === 0);
    case 'regex': {
      if (v == null) return false;
      const re = new RegExp(String(valor), 'i');
      return re.test(String(v)) || re.test(normalizarTexto(v));
    }
    default:
      throw new Error(`operador desconhecido: ${op} (use: ${OPERADORES.join(', ')})`);
  }
}

const NEGATIVOS = new Set(['diferente', 'nao_contem', 'fora_de', 'nao_existe']);

export function casaFiltro(item, { campo, op = 'igual', valor }) {
  const v = valorDe(item, campo);
  if (Array.isArray(v)) {
    if (v.length === 0) return op === 'nao_existe' || NEGATIVOS.has(op);
    // negativo em lista: NENHUM elemento pode violar; positivo: algum casa
    return NEGATIVOS.has(op) ? v.every((x) => casaEscalar(x, op, valor)) : v.some((x) => casaEscalar(x, op, valor));
  }
  return casaEscalar(v, op, valor);
}

export function filtrar(itens, filtros = [], { modo = 'todos' } = {}) {
  if (!filtros?.length) return itens;
  return itens.filter((it) =>
    modo === 'algum' ? filtros.some((f) => casaFiltro(it, f)) : filtros.every((f) => casaFiltro(it, f)),
  );
}

export function ordenar(itens, criterios = []) {
  if (!criterios?.length) return itens;
  const lista = criterios.map((c) => (typeof c === 'string' ? { campo: c, direcao: 'asc' } : c));
  return [...itens].sort((a, b) => {
    for (const { campo, direcao = 'asc' } of lista) {
      const va = valorDe(a, campo);
      const vb = valorDe(b, campo);
      const ka = Array.isArray(va) ? va[0] : va;
      const kb = Array.isArray(vb) ? vb[0] : vb;
      // nulos ao fim nas duas direções
      if (ka == null && kb != null) return 1;
      if (kb == null && ka != null) return -1;
      const r = comparar(ka, kb);
      if (r !== 0) return direcao === 'desc' ? -r : r;
    }
    return 0;
  });
}

function definirCaminho(destino, caminho, valor) {
  const partes = caminho.split('.');
  let atual = destino;
  for (let i = 0; i < partes.length - 1; i++) {
    atual[partes[i]] ??= {};
    atual = atual[partes[i]];
  }
  atual[partes[partes.length - 1]] = valor;
}

export function projetar(item, campos) {
  if (!campos?.length) return item;
  const saida = {};
  for (const c of campos) definirCaminho(saida, c, valorDe(item, c));
  return saida;
}

const mediana = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function calcularMetrica(itens, { op, campo }) {
  if (op === 'contar') return campo ? itens.filter((i) => valorDe(i, campo) != null).length : itens.length;
  const valores = itens.flatMap((i) => {
    const v = valorDe(i, campo);
    return Array.isArray(v) ? v : [v];
  });
  if (op === 'contar_distintos') {
    return new Set(valores.filter((v) => v != null && v !== '').map((v) => (typeof v === 'string' ? normalizarTexto(v) : v))).size;
  }
  const nums = valores.filter(ehNumero);
  if (op === 'somar') return nums.reduce((s, n) => s + n, 0);
  if (op === 'media') return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
  if (op === 'mediana') return mediana(nums);
  if (op === 'min' || op === 'max') {
    const presentes = valores.filter((v) => v != null);
    if (!presentes.length) return null;
    const ord = [...presentes].sort(comparar);
    return op === 'min' ? ord[0] : ord[ord.length - 1];
  }
  throw new Error(`métrica desconhecida: ${op} (use: ${METRICAS.join(', ')})`);
}

const nomeMetrica = (m) => m.como || (m.campo ? `${m.op}_${m.campo.replace(/\./g, '_')}` : m.op);

/**
 * Agrupa por um ou mais campos. Um campo-lista (ex.: "papeis") abre um grupo
 * por elemento — o mesmo item conta em cada grupo a que pertence.
 */
export function agrupar(itens, { por = [], metricas = [{ op: 'contar' }] } = {}) {
  const campos = Array.isArray(por) ? por : [por];
  const grupos = new Map();
  for (const it of itens) {
    let combinacoes = [[]];
    for (const c of campos) {
      const v = valorDe(it, c);
      const valores = Array.isArray(v) ? (v.length ? [...new Set(v)] : [null]) : [v ?? null];
      combinacoes = combinacoes.flatMap((comb) => valores.map((x) => [...comb, x]));
    }
    for (const comb of combinacoes) {
      const chave = JSON.stringify(comb);
      if (!grupos.has(chave)) grupos.set(chave, { valores: comb, itens: [] });
      grupos.get(chave).itens.push(it);
    }
  }
  const ms = metricas?.length ? metricas : [{ op: 'contar' }];
  return [...grupos.values()].map(({ valores, itens: doGrupo }) => {
    const linha = {};
    campos.forEach((c, i) => definirCaminho(linha, c, valores[i]));
    for (const m of ms) linha[nomeMetrica(m)] = calcularMetrica(doGrupo, m);
    return linha;
  });
}

const limitar = (n, padrao = LIMITE_PADRAO) =>
  Math.min(Math.max(1, Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : padrao), LIMITE_MAXIMO);

/**
 * Consulta completa: filtra → (agrupa) → ordena → pagina → projeta.
 * Retorna `{ total, offset, retornados, itens, truncado }`.
 */
export function consultar(itens, opcoes = {}) {
  const { filtros, modoFiltro, agruparPor, metricas, ordenarPor, campos, limite, offset = 0 } = opcoes;
  let resultado = filtrar(itens, filtros, { modo: modoFiltro });
  const totalFiltrado = resultado.length;
  if (agruparPor && (!Array.isArray(agruparPor) || agruparPor.length)) {
    resultado = agrupar(resultado, { por: agruparPor, metricas });
    const ordemPadrao = metricas?.length ? [{ campo: nomeMetrica(metricas[0]), direcao: 'desc' }] : [{ campo: 'contar', direcao: 'desc' }];
    resultado = ordenar(resultado, ordenarPor?.length ? ordenarPor : ordemPadrao);
  } else {
    resultado = ordenar(resultado, ordenarPor);
  }
  const ini = Math.max(0, Math.trunc(Number(offset) || 0));
  const lim = limitar(limite);
  const pagina = resultado.slice(ini, ini + lim);
  const usarProjecao = campos?.length && !agruparPor;
  return {
    totalRegistrosFiltrados: totalFiltrado,
    total: resultado.length,
    offset: ini,
    retornados: pagina.length,
    truncado: ini + pagina.length < resultado.length,
    itens: usarProjecao ? pagina.map((p) => projetar(p, campos)) : pagina,
  };
}
