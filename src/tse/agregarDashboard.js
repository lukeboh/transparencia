// Agregação pura: contratos extraídos → objeto DashboardData consumido pelo
// app web. Usada tanto pelo gerador de snapshot (buildDashboardData.js) quanto
// pela rota de API do app (web/app/api/tse/dados), que atualiza os dados em
// runtime a partir da fonte.
import { rankResponsaveis } from './rankResponsaveis.js';

const MAX_FATIAS = 5; // demais categorias somadas em "Outros"

function anoDe(dataBr) {
  const m = /(\d{4})$/.exec(dataBr ?? '');
  return m ? Number(m[1]) : undefined;
}

function paraDataISO(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

function agregarDashboard(contratos) {
  const hoje = new Date().toISOString().slice(0, 10);

  const totalContratado = contratos.reduce((s, c) => s + c.valorGlobal, 0);
  const vigentes = contratos.filter((c) => (paraDataISO(c.vigenciaFim) ?? '') >= hoje);
  const responsaveis = new Set(
    contratos.flatMap((c) => c.responsaveis.map((r) => r.matricula || r.nome)),
  );

  const porAno = new Map();
  for (const c of contratos) {
    const ano = anoDe(c.vigenciaInicio);
    if (!ano) continue;
    const acc = porAno.get(ano) ?? { ano, valor: 0, contratos: 0 };
    acc.valor += c.valorGlobal;
    acc.contratos += 1;
    porAno.set(ano, acc);
  }
  // Anos iniciais com somas simbólicas (contratos de cessão registrados por
  // R$ 1,11 etc.) só esticam o eixo sem informação; corta a cauda à esquerda
  // até o primeiro ano com valor relevante.
  const ordenadoPorAno = [...porAno.values()].sort((a, b) => a.ano - b.ano);
  const primeiroRelevante = ordenadoPorAno.findIndex((p) => p.valor >= 10_000);
  const evolucao = primeiroRelevante === -1 ? ordenadoPorAno : ordenadoPorAno.slice(primeiroRelevante);

  const porCategoria = new Map();
  for (const c of contratos) {
    const nome = c.categoria || 'Não informada';
    const acc = porCategoria.get(nome) ?? { categoria: nome, valor: 0, contratos: 0 };
    acc.valor += c.valorGlobal;
    acc.contratos += 1;
    porCategoria.set(nome, acc);
  }
  const ordenadas = [...porCategoria.values()].sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, MAX_FATIAS);
  const resto = ordenadas.slice(MAX_FATIAS);
  const categorias = resto.length
    ? [...principais, {
        categoria: 'Outros',
        valor: resto.reduce((s, c) => s + c.valor, 0),
        contratos: resto.reduce((s, c) => s + c.contratos, 0),
      }]
    : principais;

  // Tabela normalizada de contratos para auditoria: cada modal do dashboard
  // filtra esta lista e cada linha abre o contrato detalhado no Comprasnet
  // (/transparencia/contratos/{id}). Campos longos truncados para a UI.
  const truncar = (texto, max) =>
    (texto ?? '').length > max ? `${texto.slice(0, max - 1)}…` : (texto ?? '');
  const contratosResumo = contratos.map((c) => ({
    id: c.id,
    numero: c.numero,
    objeto: truncar(c.objeto, 140),
    fornecedor: truncar(c.fornecedor, 80),
    valorGlobal: c.valorGlobal,
    ano: anoDe(c.vigenciaInicio) ?? null,
    categoria: c.categoria || 'Não informada',
    vigente: (paraDataISO(c.vigenciaFim) ?? '') >= hoje,
  }));
  const indicePorId = new Map(contratos.map((c, i) => [c.id, i]));

  const rankingCompleto = rankResponsaveis(contratos);
  const valores = rankingCompleto.map((r) => r.valorConsolidado).sort((a, b) => a - b);
  const meio = Math.floor(valores.length / 2);
  const medianaValor = valores.length === 0
    ? 0
    : valores.length % 2 === 1
      ? valores[meio]
      : (valores[meio - 1] + valores[meio]) / 2;
  const responsaveisVigentes = new Set(
    vigentes.flatMap((c) => c.responsaveis.map((r) => r.matricula || r.nome)),
  );
  const ranking = rankingCompleto.map((r) => ({
    nome: r.nome,
    papeis: r.papeis,
    valorConsolidado: r.valorConsolidado,
    quantidadeContratos: r.quantidadeContratos,
    contratos: r.contratos
      .filter((c) => indicePorId.has(c.id))
      .map((c) => ({ i: indicePorId.get(c.id), papeis: c.papeis })),
  }));

  return {
    geradoEm: new Date().toISOString(),
    fonte: 'https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE',
    resumo: {
      totalContratado,
      totalContratos: contratos.length,
      contratosVigentes: vigentes.length,
      valorVigente: vigentes.reduce((s, c) => s + c.valorGlobal, 0),
      totalResponsaveis: responsaveis.size,
    },
    evolucao,
    categorias,
    contratos: contratosResumo,
    responsaveis: {
      total: rankingCompleto.length,
      emContratosVigentes: responsaveisVigentes.size,
      medianaValor,
      ranking,
    },
  };
}

export { agregarDashboard };
