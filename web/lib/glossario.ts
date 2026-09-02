// Glossário central da aplicação: um lugar só para a explicação de cada termo
// que um usuário leigo pode não conhecer. Use com <DicaTermo id="..." /> ou
// diretamente com <InfoDica>. Texto em linguagem simples, sem jargão jurídico.

export interface VerbeteGlossario {
  /** Rótulo acessível do ícone (i) — vira o aria-label do botão. */
  titulo: string;
  /** Explicação curta, 1–3 frases. */
  texto: string;
}

export const GLOSSARIO = {
  lotacao: {
    titulo: 'O que é lotação?',
    texto:
      'Lotação é a unidade onde o servidor efetivamente trabalha e à qual responde. Vem da relação oficial de agentes públicos do TSE, cruzada por nome com a estrutura de unidades.',
  },
  vigente: {
    titulo: 'O que quer dizer vigente?',
    texto:
      'Vigente = em vigor hoje. Para contrato, ainda dentro do prazo; para função comissionada, a que o servidor ocupa agora; para teletrabalho, um período sem data de término.',
  },
  fiscalGestor: {
    titulo: 'Fiscal e gestor de contrato',
    texto:
      'O fiscal acompanha a execução do contrato — prazos, entregas, qualidade. O gestor cuida da parte administrativa — pagamentos, aditivos, prorrogações. A mesma pessoa pode acumular papéis e pode ser responsável por mais de um contrato.',
  },
  fcCj: {
    titulo: 'O que são FC e CJ?',
    texto:
      'FC (Função Comissionada) e CJ (Cargo em Comissão) são as funções de chefia e assessoramento do Judiciário, nos níveis FC-1 a FC-6 e CJ-1 a CJ-4 — quanto maior o número, maior a responsabilidade e a remuneração. A FC costuma ser ocupada por servidor efetivo; o CJ pode ser ocupado por pessoa sem vínculo efetivo.',
  },
  consolidado: {
    titulo: 'Consolidado x só nesta unidade',
    texto:
      'Consolidado soma a própria unidade e tudo que está abaixo dela na estrutura. "Só nesta unidade" conta apenas quem está lotado exatamente naquele nível, sem as subunidades.',
  },
  unidadeFolha: {
    titulo: 'O que é unidade-folha?',
    texto:
      'É a ponta da estrutura: uma unidade sem subunidades abaixo dela — em geral seções e núcleos.',
  },
  altaGestao: {
    titulo: 'O que entra em alta gestão?',
    texto:
      'Unidades-folha da cúpula do tribunal: gabinetes de ministros, presidência e assessorias ligadas diretamente a ministros ou ao plenário. É uma classificação por heurística sobre o nome e a posição na árvore.',
  },
  valoresContrato: {
    titulo: 'Valor global, empenhado e pago',
    texto:
      'Global é o total previsto no contrato. Empenhado é quanto do orçamento já foi formalmente reservado para ele. Pago é quanto de fato já saiu do caixa.',
  },
  valorConsolidado: {
    titulo: 'Como o valor é somado por pessoa',
    texto:
      'Para cada responsável, somamos o valor global dos contratos em que ela aparece como fiscal ou gestor. Cada contrato conta uma vez por pessoa, mesmo que ela tenha mais de um papel nele.',
  },
  portaria: {
    titulo: 'O que é portaria?',
    texto:
      'Portaria é o ato oficial publicado que designa ou dispensa o servidor de uma função. Quando localizada, o link leva ao texto na fonte.',
  },
  basePercentual: {
    titulo: 'Base do percentual',
    texto:
      'Define sobre qual total a porcentagem é calculada: "geral" usa todos os servidores do TSE; "unidade" usa só os servidores daquela unidade.',
  },
  agentesPublicos: {
    titulo: 'Relação de agentes públicos',
    texto:
      'Lista oficial e periodicamente atualizada de quem trabalha no TSE, com o cargo, a função e a lotação de cada pessoa. É uma foto do momento — não traz histórico.',
  },
  teletrabalhoVigente: {
    titulo: 'Teletrabalho vigente',
    texto:
      'Servidores com um período de trabalho remoto autorizado e ainda sem data de término registrada na consulta pública do TSE.',
  },
  naoLocalizados: {
    titulo: 'Não localizados na estrutura',
    texto:
      'Registros que não puderam ser encaixados na árvore de unidades porque o nome da lotação não bateu com nenhum nó — ou bateu com mais de um. Nenhuma fonte compartilha um código de unidade, então o cruzamento é por nome.',
  },
  faixasValor: {
    titulo: 'Faixas de valor de contrato',
    texto:
      'Agrupam os responsáveis pela soma dos contratos sob sua responsabilidade, para comparar quem concentra os maiores valores.',
  },
  terceirizados: {
    titulo: 'Terceirizados alocados',
    texto:
      'Profissionais de empresas contratadas para prestar serviço no TSE (contratos de cessão de mão de obra: vigilância, limpeza, copa, motoristas, TI, etc.). O número é estimado a partir do PDF mensal do TSE, cruzando a coluna "Alocação" com a sigla da unidade — alguns registros não são localizados. Não são servidores públicos. O percentual é a parcela do total de terceirizados do TSE que está nesta unidade (ou na sua subárvore, quando consolidado); soma 100% na raiz.',
  },
  terceirizadoMesInicio: {
    titulo: 'Mês de início',
    texto:
      'Primeira competência (mês/ano) em que o nome do terceirizado aparece nos PDFs mensais do TSE. Não é necessariamente a data de admissão na empresa — é quando ele passou a constar na listagem pública.',
  },
  terceirizadoMesFim: {
    titulo: 'Mês de fim',
    texto:
      'Última competência em que o terceirizado apareceu, mostrada só quando ele já não consta na listagem mais recente (saída definitiva). Em branco = ainda contratado na última competência disponível.',
  },
  terceirizadoFalhas: {
    titulo: 'Registro de falhas',
    texto:
      'Terceirizados cuja lotação não foi identificada (a coluna "Alocação" do PDF não bateu com nenhuma sigla da estrutura do TSE, ou veio vazia) ou cujo contrato não foi vinculado ao Compras.gov.br. O PDF é escaneado (OCR), então parte das falhas é ruído de leitura.',
  },
  contratoCessao: {
    titulo: 'Contrato de cessão de mão de obra',
    texto:
      'Contrato em que uma empresa fornece profissionais para trabalhar nas dependências do TSE (postos de trabalho), sem vínculo de servidor público. É a fonte da lista de terceirizados.',
  },
  horasExtras: {
    titulo: 'Horas extras (estimadas)',
    texto:
      'Serviço extraordinário é o trabalho além da jornada, pago com adicional. A folha de pagamento do TSE (Anexo VIII) publica só o VALOR em R$ da rubrica "Horas Extras", não a quantidade de horas — então aqui a quantidade é ESTIMADA: valor pago ÷ (valor da hora normal × 1,5), com a hora normal = remuneração do mês ÷ 200 (÷ 175 entre 2017 e fevereiro/2020), conforme a Resolução TSE nº 22.901/2008. Como a hora de domingo/feriado custa o dobro (× 2), a mesma quantia pode representar menos horas — por isso o número é um LIMITE SUPERIOR. Confira os valores no Anexo VIII do TSE.',
  },
  horasExtrasCiclo: {
    titulo: 'Agrupamento por ciclo',
    texto:
      'As horas são agrupadas pelo ano da eleição ordinária (geral em 2010, 2014, 2018, 2022, 2026; municipal em 2012, 2016, 2020, 2024), porque é quando o volume dispara. "Outros meses" junta os demais anos — eleições suplementares, plebiscitos e recesso ocorrem ao longo de todo o ano, então é normal haver alguma hora extra fora dos anos de eleição ordinária. Pagamentos retroativos entram no ano em que o trabalho foi feito.',
  },
} as const satisfies Record<string, VerbeteGlossario>;

export type TermoId = keyof typeof GLOSSARIO;
