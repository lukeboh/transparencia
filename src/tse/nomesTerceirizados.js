// Limpeza dos nomes de terceirizados extraídos dos PDFs mensais do TSE.
//
// A fonte é um PDF escaneado (OCR) com colunas mal delimitadas: com frequência
// o "cargo/posto" vaza para dentro da coluna "Empregado", grudado no nome
// ("ABADIA CORREA CORTE Técnico em Secretariado - Nível II - 44 h - CBO 3515"),
// e às vezes a linha inteira é só um cargo, sem nome nenhum
// ("Condução de Veículo Executivo").
//
// Como o nome sempre vem ANTES do cargo, a estratégia é achar onde o cargo
// começa — por um léxico de primeiras-palavras de cargo, ou por marcadores de
// nível/CBO/carga-horária — e cortar ali. O que sobra à esquerda é o nome (se
// tiver 2+ tokens plausíveis); o resto vira o "posto" quando a coluna original
// veio vazia.
//
// Isso NÃO conserta o PDF; reduz o ruído. O que ainda escapar entra em
// data/tse_terceirizados_excecoes.json (ver carregarExcecoesTerceirizados).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const semAcento = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => semAcento(s).toUpperCase().replace(/[^A-Z]/g, '');

/**
 * Forma canônica de um número de contrato "NNN/AAAA": tira zeros à esquerda do
 * número ("01/2025" = "1/2025" = "00001/2025"), normaliza espaços em volta da
 * barra e expande ano de 2 dígitos ("13/22" → "13/2022"). É a mesma
 * canonicalização já usada no cruzamento com o Comprasnet (cujos números vêm
 * como "00039/2019"); aqui vira o identificador único do contrato em toda a
 * agregação de terceirizados, para "1/2025" e "01/2025" não virarem duas
 * linhas. Sem barra reconhecível, devolve a string aparada.
 */
export function canonicalContrato(bruto) {
  const s = String(bruto ?? '').trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
  const m = /^(\d{1,6})\/(\d{2,4})$/.exec(s);
  if (!m) return s;
  const num = String(parseInt(m[1], 10));
  const ano = m[2].length === 2 ? String(2000 + parseInt(m[2], 10)) : m[2];
  return `${num}/${ano}`;
}

// Primeira palavra de uma expressão de cargo/posto (normalizada: sem acento,
// maiúsculas, só letras). Nomes de pessoa não começam por nenhuma delas.
const POSTO_INICIO = new Set([
  'AUXILIAR', 'ASSISTENTE', 'ANALISTA', 'ANALISE', 'TECNICO', 'TECNICA',
  'ENGENHEIRO', 'ENGENHEIRA', 'ENGENHARIA', 'DESENVOLVEDOR', 'DESENVOLVEDORA',
  'ARQUITETO', 'ARQUITETA', 'ARQUITETURA', 'ESPECIALISTA', 'SUPORTE',
  'ADMINISTRACAO', 'ADMINISTRADOR', 'ADMINISTRADORA', 'ADMINISTRATIVO',
  'SECRETARIO', 'SECRETARIA', 'MOTORISTA', 'VIGILANTE', 'BOMBEIRO', 'COPEIRO',
  'COPEIRA', 'GARCOM', 'GARCONETE', 'RECEPCIONISTA', 'PLANEJAMENTO', 'CONDUCAO',
  'GESTAO', 'CONSULTOR', 'CONSULTORA', 'PROGRAMADOR', 'PROGRAMADORA', 'GERENTE',
  'OPERADOR', 'OPERADORA', 'PEDREIRO', 'ELETRICISTA', 'ENCARREGADO',
  'ENCARREGADA', 'SUPERVISOR', 'SUPERVISORA', 'TELEFONISTA', 'JARDINEIRO',
  'PORTEIRO', 'SERVENTE', 'LIMPEZA', 'HIGIENIZACAO', 'SEGURANCA', 'BRIGADISTA',
  'ALMOXARIFE', 'CONTINUO', 'MENSAGEIRO', 'COORDENADOR', 'COORDENADORA',
  'TECNOLOGO', 'CIENTISTA', 'PROJETISTA', 'DESIGNER', 'DEVOPS', 'INFRAESTRUTURA',
  'MANUTENCAO', 'MARCENEIRO', 'CARPINTEIRO', 'PINTOR', 'SOLDADOR', 'MECANICO',
  'NUTRICIONISTA', 'ENFERMEIRO', 'ENFERMEIRA', 'FISIOTERAPEUTA', 'PSICOLOGO',
  'PSICOLOGA', 'ESTAGIARIO', 'ESTAGIARIA', 'APRENDIZ', 'FOTOGRAFO', 'CINEGRAFISTA',
  'EDITOR', 'REDATOR', 'REVISOR', 'BIBLIOTECARIO', 'ARQUIVISTA', 'CONTADOR',
  'TRADUTOR', 'INTERPRETE', 'LOCUTOR', 'COZINHEIRO', 'COZINHEIRA', 'AJUDANTE',
  'ATENDENTE', 'FACILITADOR', 'INSTRUTOR', 'MONITOR', 'ELETROTECNICO',
]);

// Conectivos que fazem parte do nome / do cargo mas não contam como "palavra".
const CONECTIVOS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'DI', 'DEL', 'OU', 'EM']);
// Sufixos de nome próprio (não são cargo).
const SUFIXO_NOME = new Set(['JUNIOR', 'FILHO', 'NETO', 'SOBRINHO', 'JR']);

// Marcadores de nível / CBO / carga horária: onde aparecem, o cargo já começou.
const MARCADOR_CARGO =
  /\s[-–]\s*(CBO|N[ÍI]VEL|S[ÊE]NIOR|SEMIOR|PLENO|J[ÚU]NIOR|MASTER|TRAINEE|TRAINNE|ESPECIALIZA)\b|\bCBO\b|\b\d{3,4}-\d{2}\b|\s[-–]\s*\d+\s*[Hh]\b|\(\s*(QUALITY|SCRUM|BIG DATA|PL|SR|JR|N[ÍI]VEL)/i;

const soLetrasNome = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.-]*$/;

/** Tokeniza e diz onde (índice de token) o cargo começa, ou -1. */
function indiceInicioCargo(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const t = norm(tokens[i]);
    if (!t) continue;
    if (POSTO_INICIO.has(t)) return i;
  }
  return -1;
}

const CNPJ_RX = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2,3}/;

/**
 * Separa "NOME + cargo" grudados na coluna Empregado.
 * @param {string} empregadoBruto  coluna "Empregado" do PDF.
 * @param {string} [postoBruto]    coluna "Posto de Trabalho" do PDF.
 * @param {string} [empresaBruta]  coluna "Empresa" — em algumas competências de
 *   2023 o parser jogou o NOME para o fim dela, depois do CNPJ; usada só como
 *   resgate quando o empregado veio sem nome.
 * @returns {{ nome: string, posto: string, semNome: boolean }}
 *   `nome` limpo (ou '' quando a linha é só cargo); `posto` é o `postoBruto`
 *   quando já vinha preenchido, senão o rabo cortado do empregado.
 */
export function separarNomePosto(empregadoBruto, postoBruto = '', empresaBruta = '') {
  const bruto = String(empregadoBruto ?? '').replace(/\s+/g, ' ').trim();
  const postoOriginal = String(postoBruto ?? '').replace(/\s+/g, ' ').trim();
  if (!bruto) {
    const resgate = resgatarNomeDaEmpresa(empresaBruta, postoOriginal);
    return resgate ?? { nome: '', posto: postoOriginal, semNome: true };
  }

  const tokens = bruto.split(' ');

  // 1) Corte pelo léxico de início de cargo.
  let corte = indiceInicioCargo(tokens);

  // 2) Se não achou, tenta pelo marcador de nível/CBO/carga-horária.
  if (corte < 0) {
    const m = MARCADOR_CARGO.exec(bruto);
    if (m) {
      const ate = bruto.slice(0, m.index).trim();
      corte = ate ? ate.split(' ').length : 0;
    }
  }

  let nomeTokens;
  let tail;
  if (corte >= 0) {
    nomeTokens = tokens.slice(0, corte);
    tail = tokens.slice(corte).join(' ').trim();
  } else {
    nomeTokens = tokens;
    tail = '';
  }

  // Remove conectivo pendurado no fim do nome ("... DE") e valida tokens.
  while (nomeTokens.length && CONECTIVOS.has(norm(nomeTokens[nomeTokens.length - 1]))) {
    tail = `${nomeTokens.pop()} ${tail}`.trim();
  }
  const palavrasNome = nomeTokens.filter(
    (t) => !CONECTIVOS.has(norm(t)) && !SUFIXO_NOME.has(norm(t)),
  );
  const nomeParece =
    palavrasNome.length >= 2 &&
    nomeTokens.every((t) => soLetrasNome.test(t)) &&
    !nomeTokens.some((t) => POSTO_INICIO.has(norm(t)));

  if (!nomeParece) {
    const resgate = resgatarNomeDaEmpresa(empresaBruta, postoOriginal || bruto);
    return resgate ?? { nome: '', posto: postoOriginal || bruto, semNome: true };
  }

  const nome = nomeTokens.join(' ');
  // Posto: mantém o que veio na coluna se for descritivo; senão usa o rabo.
  const postoOriginalEhRuido = !postoOriginal || /^[\d\s.,;:/–-]+$/.test(postoOriginal);
  const posto = postoOriginalEhRuido && tail ? tail : postoOriginal;
  return { nome, posto, semNome: false };
}

/**
 * Competências de 2023 em que o parser grudou o NOME no fim da coluna
 * "Empresa", depois do CNPJ: "RCS TECNOLOGIA LTDA 08.220.952/0001-22 ABADIA
 * CORREA CORTE". Resgata o trecho pós-CNPJ como nome, se ele passar no
 * separarNomePosto normal.
 */
function resgatarNomeDaEmpresa(empresaBruta, postoFallback) {
  const s = String(empresaBruta ?? '').replace(/\s+/g, ' ').trim();
  const m = s.match(new RegExp(`${CNPJ_RX.source}\\s+(.+)$`));
  if (!m) return null;
  const cand = m[1].trim();
  // Evita recursão infinita: chama sem empresaBruta.
  const r = separarNomePosto(cand, postoFallback);
  return r.semNome ? null : r;
}

let _cacheExcecoes;
/**
 * data/tse_terceirizados_excecoes.json (opcional):
 *   {
 *     "descartar": ["ANALISTA WEB", ...],           // não são pessoas
 *     "renomear": { "<empregado bruto>": "NOME BOM" } // força um nome
 *   }
 * Chaves comparadas por nome normalizado (sem acento, maiúsculas, 1 espaço).
 */
export function carregarExcecoesTerceirizados(raizOpcional) {
  if (_cacheExcecoes) return _cacheExcecoes;
  const raiz = raizOpcional ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const arq = path.join(raiz, 'data/tse_terceirizados_excecoes.json');
  const chave = (s) => semAcento(String(s ?? '')).toUpperCase().replace(/\s+/g, ' ').trim();
  if (!existsSync(arq)) {
    _cacheExcecoes = { descartar: new Set(), renomear: new Map() };
    return _cacheExcecoes;
  }
  try {
    const j = JSON.parse(readFileSync(arq, 'utf8'));
    _cacheExcecoes = {
      descartar: new Set((j.descartar ?? []).map(chave)),
      renomear: new Map(Object.entries(j.renomear ?? {}).map(([k, v]) => [chave(k), String(v)])),
    };
  } catch {
    _cacheExcecoes = { descartar: new Set(), renomear: new Map() };
  }
  return _cacheExcecoes;
}

/** Só para os testes: zera o cache do arquivo de exceções. */
export function _resetExcecoesTerceirizados() {
  _cacheExcecoes = undefined;
}
