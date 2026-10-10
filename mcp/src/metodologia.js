// Notas de metodologia expostas como recurso MCP (tse://metodologia) e em
// tse_fontes. É o "manual de leitura" dos dados: sem isso, a IA tende a tratar
// estimativas como fatos e cruzamentos por nome como identificação exata.

export const METODOLOGIA = `# Dados de transparência do TSE — metodologia e limitações

## Fontes (todas oficiais e públicas)
| Conjunto | Fonte | Como é obtido |
|---|---|---|
| contratos | Compras.gov.br — Consulta contratos (unidade TSE) | API server-side do DataTables (sessão + token CSRF), paginada; colunas mapeadas pelo cabeçalho da página |
| agentes | Relação de agentes públicos (Anexo V, Res. CNJ 102/2009) | Página HTML única, sem paginação |
| unidades | Organograma oficial (lotação geral) | Endpoint JSON por trás do organograma |
| teletrabalho | Servidores em regime de teletrabalho | Listagem HTML completa (o "Detalhar" dia a dia da fonte nunca retorna dados) |
| funcoes | Legislação compilada — portarias (www.tse.jus.br/legislacao/compilada/prt) | Índice anual + texto de cada portaria cuja ementa cita função comissionada / cargo em comissão |
| terceirizados | PDFs mensais "postos de trabalho – contratos de cessão de mão de obra" | PDF (OCR) parseado por coordenadas; uma competência por mês |
| horasExtras | Anexo VIII — detalhamento da folha (contracheque por servidor) | Navegador real (WAF); só valor da rubrica e base de cálculo são guardados — nunca a remuneração inteira |

## Atualização
- Modo padrão "auto": tenta a fonte oficial ao vivo; se falhar (WAF do TSE costuma bloquear IPs de datacenter/VPN), usa o snapshot versionado do repositório github.com/lukeboh/transparencia (pasta data/), atualizado periodicamente pelo pipeline do projeto.
- Toda resposta traz \`_fontes\` com \`origem\` (ao-vivo | snapshot) e \`obtidoEm\`. Informe ao usuário a data do dado.
- Funções: só os dois últimos anos de portarias são reconsultados ao vivo; o histórico vem do snapshot (o backfill completo leva dezenas de minutos).
- Horas extras: sempre snapshot (a extração exige um navegador e um contracheque por servidor por mês).

## Identificação de pessoas
- As fontes NÃO compartilham CPF nem matrícula entre si. O cruzamento é pelo nome normalizado (sem acento, sem caixa, espaços colapsados).
- Consequências: homônimos se misturam; grafias divergentes entre fontes (abreviação, nome de casada) separam a mesma pessoa. Sempre trate cruzamentos como indício, não prova.
- Nos contratos, o "cpf" dos responsáveis vem mascarado pela própria fonte (ex.: ***.724.491-**).

## Contratos
- "Vigente" = data de fim de vigência hoje ou depois.
- valorGlobal é o valor do instrumento; valorEmpenhado/valorPago somam os empenhos listados (pago + restos a pagar pagos).
- Ranking de responsáveis: o valor do contrato conta UMA vez por pessoa por contrato, mesmo que ela tenha mais de um papel nele. Somar o "valor consolidado" de várias pessoas conta o mesmo contrato várias vezes.
- Papéis com "Substituto" são de suplência; em muitas análises convém excluí-los.
- Correções manuais (erros sabidos da própria fonte) são aplicadas a partir de data/tse_excecoes.json e ficam visíveis no campo \`correcoes\` (valor original, motivo, fonte).

## Funções comissionadas (FC-1…FC-6) e cargos em comissão (CJ-1…CJ-4)
- Fonte primária do estado ATUAL: relação de agentes públicos (campo funcao em agentes).
- Histórico: portarias de designação/dispensa, lidas por heurísticas de texto. Designações de substituição (férias/licença) são excluídas. Data = publicação no DOU.
- Mandatos são pareados FIFO por pessoa (designação → próxima dispensa). Uma dispensa não localizada deixa o mandato "vigente" pelas portarias mesmo que a pessoa não tenha mais a função — compare sempre com funcaoAtualOficial.

## Teletrabalho
- Um registro por período autorizado; período sem fim = em aberto (dias contados até hoje).
- Dias consolidados somam períodos sem mesclar sobreposições.

## Terceirizados
- OCR dos PDFs: nomes podem vir com cargo grudado ou erros de grafia; há limpeza heurística e correções manuais (data/tse_terceirizados_excecoes.json).
- mesInicio = primeira competência em que o nome aparece; mesFim = última, só quando a pessoa não está na competência mais recente.
- Competências com falha estrutural de extração (>40% das linhas sem nome) são descartadas do cálculo de início/fim.
- Lotação: a coluna "Alocação" (siglas) é resolvida contra o organograma; gabinetes de ministro caem todos em "MIN".

## Horas extras (ESTIMATIVA)
- A fonte publica só o VALOR em R$ da rubrica "HORAS EXTRAS"; a quantidade é inferida pela Res. TSE 22.901/2008, art. 9º:
  horas = valor ÷ (remuneração mensal ÷ divisor) ÷ fator.
- Divisor 200 (175 entre jan/2017 e fev/2020). Remuneração ≈ "vencimentos e vantagens" + "exercício FC/CJ" + "remuneração órgão de origem" (requisitados).
- Até ~2020 o contracheque separa dia útil (+50%) de domingo/feriado (+100%) e a estimativa é exata; depois disso a linha é única e usa-se fator 1,5 → o número é um LIMITE SUPERIOR (horasMin usa fator 2,0).
- Meses com estimativa < 0,5 h são ignorados (acertos residuais de folha). "acimaDoTeto" compara o mês com o limite legal vigente (sinal para checagem, não acusação).
- Ciclo = ano de eleição ordinária (janeiro conta para o ciclo do ano anterior).

## Boas práticas ao responder
- Cite a fonte oficial e a data (\`obtidoEm\`).
- Deixe explícito quando o número é estimativa ou cruzamento por nome.
- Dados de pessoas físicas são públicos por força da Lei de Acesso à Informação, mas evite conclusões acusatórias sem verificação na fonte oficial.
`;
