# Candidatos a exceção — cruzamento com export do SIAC

Gerado por `src/tse/cruzarSiac.js` a partir de:
- Nossos dados: `data/tse_contratos.json` (fonte: Compras.gov.br)
- Export do SIAC: `C:\Users\luciano.bohnert\.claude\uploads\bfe3a503-b52a-4128-bc5e-d6b8a3131e69\81ab1f98-contratos.csv`

Em: 2026-08-25T11:54:23.094Z

## Metodologia e como ler este relatório

O casamento entre as duas fontes é feito por número/ano do contrato **e**
nome do fornecedor (normalizado, ignorando termos genéricos como "LTDA",
"TECNOLOGIA", "TRIBUNAL" etc.) — número/ano sozinho não é chave única: várias
parcerias diferentes (convênios, TEDs, acordos de cooperação) reaproveitam o
mesmo par número/ano com contrapartes diferentes.

**Importante:** o valor `valorAtualizado` do SIAC não é automaticamente a
verdade — nesta rodada apareceram pelo menos 2 casos (Lanlink, Minha
Biblioteca) onde o valor do SIAC parece implausível para o objeto do
contrato, sugerindo que o erro pode estar do lado do SIAC, não do nosso. Cada
item abaixo precisa de conferência manual na página de detalhe do SIAC (link
incluído) antes de virar exceção em `data/tse_excecoes.json` — ver seção
"Exceções" do README para o formato.

## Cobertura

- Total de contratos: 1311
- Sem número/ano interpretável: 236
- Sem nenhuma linha candidata no CSV (mesmo número/ano): 187
- Com candidato(s) mas nome não bateu (sem match confiável): 240
- Casados com confiança: 648

## Categoria A — razão ≈ potência de 10 (10x/100x/1000x/...)

Assinatura clássica de erro de vírgula/ponto decimal — mas o lado errado pode
ser **qualquer um dos dois** (já vimos casos nos dois sentidos). Confirmar
manualmente qual fonte bate com o contrato real antes de decidir o valor da
exceção.

### 00052/2024 — id `307565`

- Nosso (Compras.gov.br): **R$ 3.681.382,08** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/307565)
- SIAC (`valorAtualizado`): **R$ 368.138.208,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00522024/CT)
- Razão: 100.0x
- Fornecedor (nosso): 19.877.285/0002-52 - LANLINK SOLUCOES E COMERCIALIZACAO EM INFORMATICA S/A
- Contratado (SIAC): LANLINK SOLUÇÕES E COMERCIALIZAÇÃO EM INFORMÁTICA 
- Objeto: AQUISIÇÃO DE INFRAESTRUTURA E SOFTWARE DE BACKUP PARA USO GERAL, PARA MICROSOFT 365, NA FORMA DE RENOVAÇÃO DO LICENCIAMENTO ATUALMENTE EM USO PELO TSE, CONSOANTE ESPECIFICAÇÕES, EXIGÊNCIAS, QUANTIDADES E PRAZOS CONSTANTES DO TERMO DE REFERÊNCIA - ANEXO I DO EDITAL DA LICITAÇÃO-TSE Nº 90007/2024, MODALIDADE PREGÃO, NA FORMA ELETRÔNICA, E PROPOSTA DA CONTRATADA.

### 00114/2022 — id `170991`

- Nosso (Compras.gov.br): **R$ 60.000,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/170991)
- SIAC (`valorAtualizado`): **R$ 6.000.000,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/01142022/CT)
- Razão: 100.0x
- Fornecedor (nosso): 13.183.749/0001-63 - MINHA BIBLIOTECA LTDA.
- Contratado (SIAC): MINHA BIBLIOTECA
- Objeto: ASSINATURA ANUAL DA PLATAFORMA DIGITAL DE LIVROS ELETRÔNICOS MINHA BIBLIOTECA, PELO PERÍODO DE 12(DOZE) MESES, CONSOANTE ESPECIFICAÇÕES, EXIGÊNCIAS E PRAZOS CONSTANTES DO PROJETO BÁSICO E DA PROPOSTA DA CONTRATADA,

### 00061/2022 — id `159345`

- Nosso (Compras.gov.br): **R$ 133,25** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/159345)
- SIAC (`valorAtualizado`): **R$ 133.248,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00612022/CT)
- Razão: 1000.0x
- Fornecedor (nosso): 13.505.280/0001-31 - GMO SOLUCOES COMERCIAIS LTDA
- Contratado (SIAC): GMO SOLUÇÕES COMERCIAIS
- Objeto: AQUISIÇÃO DE HARDWARES E LICENÇAS DE SOFTWARE PARA EDITORAÇÃO E VÍDEO-GRAFISMO, CONSOANTE ESPECIFICAÇÕES, EXIGÊNCIAS, QUANTIDADES E PRAZOS CONSTANTES DO EDITAL DA LICITAÇÃO E SEU ANEXO I, MODALIDADE PREGÃO, FORMA ELETRÔNICA E PROPOSTA DA CONTRATADA, QUE PASSAM A FAZER PARTE DESTE INSTRUMENTO, INDEPENDENTEMENTE DE TRANSCRIÇÃO, NO QUE NÃO CONFLITAR COM AS DISPOSIÇÕES DO PRESENTE CONTRATO.


## Categoria B — zero em um lado, valor no outro

Pode ser erro de extração, mas também pode ser instrumento-base com valor
simbólico no SIAC (ex.: acordo de cooperação sem custo direto) enquanto o
valor real aparece em outro instrumento (TED) associado — ou o inverso.
Precisa checar o objeto/tipo de instrumento em cada caso.

### 00090/2022 — id `310984`

- Nosso (Compras.gov.br): **R$ 11.061.452.230,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/310984)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00902022/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 110407 - MINISTÉRIO DA DEFESA
- Contratado (SIAC): Ministério da Defesa
- Objeto: APOIO ÀS ELEIÇÕES PELAS FORÇAS ARMADAS QUE PRESTARÃO APOIO LOGÍSTICO E AÇÕES PARA A GARANTIA DA VOTAÇÃO E APURAÇÃO (GVA) NAS ELEIÇÕES GERAIS DE 2022, NAS LOCALIDADES SOLICITADAS PELO TRIBUNAL SUPERIOR ELEITORAL (TSE), MEDIANTE TERMO DE EXECUÇÃO DESCENTRALIZADA (TED), CONFORME ESPECIFICAÇÕES TÉCNICAS E OBJETIVOS CONSTANTES DO PLANO DE TRABALHO FIRMADO ENTRE AS PARTES, QUE PASSAM A INTEGRAR O PRESENTE TERMO.

### 00015/2023 — id `198656`

- Nosso (Compras.gov.br): **R$ 7.889.427,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/198656)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00152023/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 63.025.530/0001-04 - UNIVERSIDADE DE SAO PAULO
- Contratado (SIAC): Universidade de São Paulo
- Objeto: PROMOVER A COOPERAÇÃO TÉCNICO-CIENTÍFICA, VISANDO FORTALECER, AMPLIAR E INTENSIFICAR A INTEGRAÇÃO ENTRE OS PARTÍCIPES POR MEIO DO INTERCÂMBIO DE CONHECIMENTO E ATIVIDADES DE PESQUISA E DESENVOLVIMENTO, EM ESPECIAL ANALISAR E AVALIAR A SEGURANÇA DO HARDWARE E SOFTWARE DO SISTEMA ELETRÔNICO DE VOTAÇÃO, IDENTIFICANDO, SE HOUVER, VULNERABILIDADES OU FALHAS, E INDICANDO PONTOS DE MELHORIA VISANDO APRIMORAR SUA SEGURANÇA, INTEGRIDADE E CONFIABILIDADE.

### 00017/2024 — id `268128`

- Nosso (Compras.gov.br): **R$ 1.487.700,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/268128)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00172024/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 63.025.530/0001-04 - UNIVERSIDADE DE SAO PAULO
- Contratado (SIAC): Universidade de São Paulo
- Objeto: PROMOVER A COOPERAÇÃO TÉCNICO-CIENTÍFICA, POR MEIO DO INTERCÂMBIO DE CONHECIMENTO E DE ATIVIDADES DE PESQUISA, DESENVOLVIMENTO E INOVAÇÃO, BEM COMO A CAPACITAÇÃO DE RECURSOS HUMANOS E REALIZAÇÃO DE PROJETOS CONJUNTOS, ESPECIALMENTE PARA A EXECUÇÃO DA ETAPA II DO PROJETO ELEIÇÕES DO FUTURO, EM DECORRÊNCIA DOS ACHADOS RELEVANTES DA ETAPA I, VISANDO IDENTIFICAR E MATERIALIZAR SOLUÇÕES PARA REDUÇÃO DE CUSTOS, APERFEIÇOAMENTO DE MECANISMOS DE SEGURANÇA, AUDITORIA E TRANSPARÊNCIA E O APRIMORAMENTO DA EXPERIÊNCIA DO ELEITOR.

### 00018/2024 — id `275907`

- Nosso (Compras.gov.br): **R$ 1.379.698,20** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/275907)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00182024/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 05.940.740/0001-21 - TRIBUNAL REGIONAL ELEITORAL DE MINAS GERAIS
- Contratado (SIAC): TRIBUNAL REGIONAL ELEITORAL DE MINAS GERAIS
- Objeto: HOSPEDAGEM DE EQUIPAMENTOS DO TSE EM SALA COFRE SITUADA NO TRE/MG. FUNDAMENTAÇÃO LEGAL: LEI Nº 14.133/2021, DECRETOS Nº 825/1993 E Nº 10.426/2020. VIGÊNCIA: PARTIR DA SUA DATA DE ASSINATURA E DURAÇÃO DE 5 (CINCO) ANOS. ASSINATURA: 24/5/2024. ASSINAM: ADAIRES AGUIAR LIMA, SECRETÁRIA DE ADMINISTRAÇÃO, PELO TSE; E CASSIANA LOPES VIANA, DIRETORA-GERAL, PELO TRE-MG. PA 2018.00.000002991-6.

### 00014/2023 — id `310901`

- Nosso (Compras.gov.br): **R$ 0,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/310901)
- SIAC (`valorAtualizado`): **R$ 865.997,51** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00142023/ED)
- Um dos dois lados é zero
- Fornecedor (nosso): 080001 - TRIBUNAL SUPERIOR DO TRABALHO
- Contratado (SIAC): Tribunal Superior do Trabalho
- Objeto: A PARTICIPAÇÃO, NO PROGRAMA DE BERÇÁRIO DO TST, DE ATÉ 14 BEBÊS (DEPENDENTES COM IDADES ENTRE 6 E 18 MESES), FILHOS(AS) DE SERVIDORES(AS) DO TSE, EM DIAS ÚTEIS, DE 12H ÀS 19H.

### 00006/2023 — id `310709`

- Nosso (Compras.gov.br): **R$ 0,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/310709)
- SIAC (`valorAtualizado`): **R$ 119.219,11** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00062023/ED)
- Um dos dois lados é zero
- Fornecedor (nosso): 00.531.640/0001-28 - SUPREMO TRIBUNAL FEDERAL
- Contratado (SIAC): SUPREMO TRIBUNAL FEDERAL
- Objeto: CONSTITUI OBJETO DO PRESENTE TERMO DE EXECUÇÃO DESCENTRALIZADA ESTABELECER AS CONDIÇÕES PARA A DIVULGAÇÃO, POR INTERMÉDIO DA TV JUSTIÇA E RÁDIO JUSTIÇA, DOS ATOS INSTITUCIONAIS DO TRIBUNAL SUPERIOR ELEITORAL, OBSERVADA A LEGISLAÇÃO EM VIGOR.

### 00062/2020 — id `107478`

- Nosso (Compras.gov.br): **R$ 35.280,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/107478)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00622020/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 00.531.954/0001-20 - TRIBUNAL DE JUSTIçA DO DISTRITO FEDERAL E TERRITóR
- Contratado (SIAC): Tribunal de Justiça do Distrito Federal e Territór
- Objeto: O PRESENTE INSTRUMENTO TEM POR OBJETO O EMPRÉSTIMO GRATUITO, PELO TRIBUNAL DE JUSTIÇA DO DISTRITO FEDERAL E DOS TERRITÓRIOS - TJDFT AO TRIBUNAL SUPERIOR ELEITORAL, DE 4 (QUATRO) ESCÂNERES DA MARCA KODAK MODELO I3400, CONFORME PATRIMÔNIOS TJDFT E VALORES DISCRIMINADOS NA TABELA ABAIXO.

### 00003/2023 — id `182140`

- Nosso (Compras.gov.br): **R$ 20.000,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/182140)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00032023/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 27.865.757/0001-02 - GLOBO COMUNICACAO E PARTICIPACOES S/A
- Contratado (SIAC): GLOBO COMUNICAÇão E PARTICIPAÇÕES S.A.
- Objeto: O PRESENTE TERMO DE AUTORIZAÇÃO TRATA DO USO DOS AMBIENTES PLENÁRIO E FACHADA DO PRÉDIO, INCLUINDO O SUBSOLO PARA CAMARIM DA EQUIPE, E O ESTACIONAMENTO DO CENTRO CULTURAL DA JUSTIÇA ELEITORAL - CCJE, SITO NA RUA PRIMEIRO DE MARÇO, Nº 42, CENTRO, RIO DE JANEIRO, E TEM COMO OBJETO SERVIR COMO APOIO PARA AS EQUIPES E CAMARIM PARA A ARRUMAÇÃO DOS ATORES E FIGURANTES DA GRAVAÇÃO DE OBRA AUDIOVISUAL PRODUZIDA PELO AUTORIZADO, A SABER: A FILMAGEM DE CENAS DA NOVELA AMOR PERFEITO, COM A PARTICIPAÇÃO DE APROXIMADAMENTE 140 (CENTO E QUARENTA) PESSOAS NO LOCAL.

### 00034/2023 — id `211691`

- Nosso (Compras.gov.br): **R$ 20.000,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/211691)
- SIAC (`valorAtualizado`): **R$ 0,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00342023/SE)
- Um dos dois lados é zero
- Fornecedor (nosso): 27.865.757/0001-02 - GLOBO COMUNICACAO E PARTICIPACOES S/A
- Contratado (SIAC): GLOBO COMUNICAÇão E PARTICIPAÇÕES S.A.
- Objeto: O PRESENTE TERMO DE AUTORIZAÇÃO TRATA DO USO DE ESPAÇOS DO CENTRO CULTURAL DA JUSTIÇA ELEITORAL - CCJE, SITO NA RUA PRIMEIRO DE MARÇO, Nº 42, CENTRO, RIO DE JANEIRO, E TEM COMO OBJETO FILMAGEM DE CENAS DA NOVELA INTITULADA "FUZUÊ", COM A PARTICIPAÇÃO DE APROXIMADAMENTE 80 (OITENTA) PESSOAS NO LOCAL.


## Categoria C — outras divergências grandes (razão não é potência redonda)

Mais provável de refletir evolução legítima do valor ao longo do contrato
(aditivos plurianuais) do que erro de extração — mas listado para revisão,
principalmente quando o objeto é um fornecimento pontual (não contínuo).

### 00031/2015 — id `5882`

- Nosso (Compras.gov.br): **R$ 2.500.000.000,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/5882)
- SIAC (`valorAtualizado`): **R$ 3.076.688,09** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00312015/CT)
- Razão: 812.6x
- Fornecedor (nosso): 05.085.461/0001-28 - DATAINFO SOLUCOES EM TECNOLOGIA DA INFORMACAO LTDA
- Contratado (SIAC): Datainfo- Soluções em Tecnologia da Informação Ltd
- Objeto: Prestação de serviços de apoio às atividades de controle da Tecnologia da Informação, a fim de atender às demandas do Tribunal Superior Eleitoral, pelo período de 12 (doze) meses, podendo ser prorrogados na forma da lei, de acordo com as especificações, quantidades, condições e prazos constantes do Edital de Licitação TSE nº 14/2015 e proposta da contratada.

### 00105/2020 — id `99438`

- Nosso (Compras.gov.br): **R$ 24.189.766,25** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/99438)
- SIAC (`valorAtualizado`): **R$ 594.190.075,36** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/01052020/CT)
- Razão: 24.6x
- Fornecedor (nosso): 81.243.735/0001-48 - POSITIVO TECNOLOGIA S.A.
- Contratado (SIAC): POSITIVO INFORMÁTICA LTDA
- Objeto: O PRESENTE CONTRATO TEM POR OBJETO A PRODUÇÃO E O FORNECIMENTO DOS EQUIPAMENTOS E MATERIAIS E A PRESTAÇÃO DOS SERVIÇOS, CONFORME ESPECIFICAÇÕES, QUANTIDADES E PRAZOS CONSTANTES DO EDITAL DE LICITAÇÃO-TSE Nº 43/2019 E SEUS ANEXOS (PRODUÇÃO, EMBALAGEM E TRANSPORTE E DE 91.780 UE2020 - ARP TSE 53/2019)

### 00076/2020 — id `104812`

- Nosso (Compras.gov.br): **R$ 14.656.816,05** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/104812)
- SIAC (`valorAtualizado`): **R$ 361.157.462,55** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00762020/CT)
- Razão: 24.6x
- Fornecedor (nosso): 81.243.735/0001-48 - POSITIVO TECNOLOGIA S.A.
- Contratado (SIAC): POSITIVO TECNOLOGIA S.A.
- Objeto: PRODUÇÃO E O FORNECIMENTO DOS EQUIPAMENTOS E MATERIAIS E A PRESTAÇÃO DOS SERVIÇOS, CONFORME ESPECIFICAÇÕES, QUANTIDADES E PRAZOS CONSTANTES DO EDITAL DE LICITAÇÃO-TSE Nº 43/2019 E SEUS ANEXOS, E PROPOSTA DA CONTRATADA

### 00008/2021 — id `95977`

- Nosso (Compras.gov.br): **R$ 8.594.456,85** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/95977)
- SIAC (`valorAtualizado`): **R$ 209.182.039,59** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00082021/CT)
- Razão: 24.3x
- Fornecedor (nosso): 81.243.735/0001-48 - POSITIVO TECNOLOGIA S.A.
- Contratado (SIAC): POSITIVO TECNOLOGIA S.A.
- Objeto: FORNECIMENTO DE 32.609 (TRINTA E DUAS MIL, SEISCENTAS E NOVE) URNAS ELETRÔNICAS MODELO (UE2020), COM A RESPECTIVA EMBALAGEM, BEM COMO O FORNECIMENTO DE SUPRIMENTOS (ITENS A E D), LISTADOS NA CLÁUSULA QUINTA DESTE CONTRATO, CONFORME ESPECIFICAÇÕES E PRAZOS CONSTANTES DO EDITAL DE LICITAÇÃO-TSE Nº 43/2019 E SEUS ANEXOS, E PROPOSTA DA CONTRATADA.

### 00085/2016 — id `5825`

- Nosso (Compras.gov.br): **R$ 6.741.044,08** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/5825)
- SIAC (`valorAtualizado`): **R$ 85.847,50** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00852016/CT)
- Razão: 78.5x
- Fornecedor (nosso): 81.627.838/0001-01 - INGRAM MICRO INFORMATICA LTDA
- Contratado (SIAC): Ingram Micro Informática Ltda.
- Objeto: Renovação de subscrição de licenças de Red Hat (lote 1) e Suporte on-site no ambiente do TSE (lote 2), COM PRORROGAÇÃO PARA OS SERVIÇOS DE SUPORTE ON SITE - Licitação TSE nº 49/2016 e ARP TSE nº 57/2016.

### 00032/2021 — id `124435`

- Nosso (Compras.gov.br): **R$ 158.150,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/124435)
- SIAC (`valorAtualizado`): **R$ 4.082.023,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00322021/CT)
- Razão: 25.8x
- Fornecedor (nosso): 08.925.028/0001-41 - EVERY TI TECNOLOGIA & INOVACAO LTDA
- Contratado (SIAC): EVERY TI TECNOLOGIA & INOVAÇÃO EIRELI
- Objeto: PRESTAÇÃO DE SERVIÇOS DE ANÁLISE EM SEGURANÇA DA INFORMAÇÃO NAS ÁREAS DE APOIO TÉCNICO ESPECIALIZADO EM SEGURANÇA DA INFORMAÇÃO (LOTE 3), PELO PRAZO DE 12 MESES, PRORROGÁVEL NOS TERMOS DA LEI, CONFORME ESPECIFICAÇÕES, EXIGÊNCIAS E PRAZOS CONSTANTES DO ANEXO I DO EDITAL DA LICITAÇÃO TSE Nº 22/2021

### 00033/2020 — id `65066`

- Nosso (Compras.gov.br): **R$ 1,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/65066)
- SIAC (`valorAtualizado`): **R$ 41.500,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00332020/CT)
- Razão: 41500.0x
- Fornecedor (nosso): 32.076.851/0001-04 - WSS COMERCIO DE EQUIPAMENTOS ELETRONICOS E LICITACOES LTDA
- Contratado (SIAC): WSS COMERCIO DE EQUIPAMENTOS ELETRONICOS E LICI...
- Objeto: AQUISIÇÃO DE BOMBAS, ATUADORES ELÉTRICOS E PEÇAS PARA REPOSIÇÃO E MANUTENÇÃO DAS BOMBAS UTILIZADAS NA GERAÇÃO DE VÁCUO E NO DESCARTE NA CENTRAL DE ESGOTO DO TRIBUNAL SUPERIOR ELEITORAL, CONFORME ESPECIFICAÇÕES, QUANTIDADES, EXIGÊNCIAS E PRAZOS CONSTANTES DO TERMO DE REFERÊNCIA - ANEXO I DESTE EDITAL TSE Nº 20/2020 E SEUS ANEXOS, MODALIDADE PREGÃO, E PROPOSTA DA CONTRATADA.

### 00009/2019 — id `5968`

- Nosso (Compras.gov.br): **R$ 40.000,00** — [ver contrato](https://contratos.comprasnet.gov.br/transparencia/contratos/5968)
- SIAC (`valorAtualizado`): **R$ 878,00** — [ver no SIAC](https://siac-consultas.tse.jus.br/main/contratos/detalhar/00092019/CT)
- Razão: 45.6x
- Fornecedor (nosso): 18.876.112/0001-76 - GIBBOR PUBLICIDADE E PUBLICACOES DE EDITAIS LTDA
- Contratado (SIAC): GIBBOR PUBLICIDADE E PUBLICACOES DE EDITAIS EIR...
- Objeto: PRESTAÇÃO DE SERVIÇOS CONTÍNUOS DE DIVULGAÇÃO DAS MATÉRIAS INERENTES ÀS LICITAÇÕES E CONTRATAÇÕES REALIZADAS PELA SECRETARIA DO TRIBUNAL SUPERIOR ELEITORAL.

