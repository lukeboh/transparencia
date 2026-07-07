// Agregação: soma o valor consolidado dos contratos sob responsabilidade de cada
// servidor (fiscal/gestor) e produz um ranking decrescente por valor total.
//
// Formato esperado de entrada (um item por contrato):
// {
//   id: string,
//   numero: string,
//   objeto: string,
//   fornecedor: string,
//   valorGlobal: number,
//   situacao: string,
//   responsaveis: [{ nome: string, matricula?: string, papel: string }]
// }

function normalizeNome(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

// Matrícula é a chave mais confiável (nomes podem repetir/variar grafia).
// Na ausência de matrícula, cai para o nome normalizado.
function chavePessoa(responsavel) {
  if (responsavel.matricula) return `mat:${responsavel.matricula}`;
  return `nome:${normalizeNome(responsavel.nome)}`;
}

function rankResponsaveis(contratos, { papeis } = {}) {
  const porPessoa = new Map();

  for (const contrato of contratos) {
    const valor = Number(contrato.valorGlobal) || 0;
    const responsaveis = contrato.responsaveis ?? [];

    const responsaveisRelevantes = papeis
      ? responsaveis.filter((r) => papeis.includes(r.papel))
      : responsaveis;

    // Uma mesma pessoa pode aparecer em mais de um papel no mesmo contrato
    // (ex.: fiscal titular e substituto de itens diferentes) — o valor do
    // contrato deve contar uma única vez por pessoa por contrato.
    const pessoasNesteContrato = new Map();
    for (const responsavel of responsaveisRelevantes) {
      const chave = chavePessoa(responsavel);
      if (!pessoasNesteContrato.has(chave)) {
        pessoasNesteContrato.set(chave, {
          nome: responsavel.nome,
          matricula: responsavel.matricula,
          papeis: new Set(),
        });
      }
      pessoasNesteContrato.get(chave).papeis.add(responsavel.papel);
    }

    for (const [chave, info] of pessoasNesteContrato) {
      if (!porPessoa.has(chave)) {
        porPessoa.set(chave, {
          nome: info.nome,
          matricula: info.matricula,
          papeis: new Set(),
          valorConsolidado: 0,
          quantidadeContratos: 0,
          contratos: [],
        });
      }
      const acumulado = porPessoa.get(chave);
      for (const papel of info.papeis) acumulado.papeis.add(papel);
      acumulado.valorConsolidado += valor;
      acumulado.quantidadeContratos += 1;
      acumulado.contratos.push({
        id: contrato.id,
        numero: contrato.numero,
        objeto: contrato.objeto,
        fornecedor: contrato.fornecedor,
        valorGlobal: valor,
        papeis: [...info.papeis],
      });
    }
  }

  return [...porPessoa.values()]
    .map((p) => ({ ...p, papeis: [...p.papeis].sort() }))
    .sort((a, b) => b.valorConsolidado - a.valorConsolidado);
}

export { rankResponsaveis, normalizeNome, chavePessoa };
