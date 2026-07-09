// Gerado por src/tse/buildDashboardData.js — não editar manualmente.
// Fonte: https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE
// Extraído em: 2026-07-09T12:18:49.456Z

export interface ResumoTSE {
  totalContratado: number;
  totalContratos: number;
  contratosVigentes: number;
  valorVigente: number;
  totalResponsaveis: number;
}

export interface PontoEvolucao {
  ano: number;
  valor: number;
  contratos: number;
}

export interface FatiaCategoria {
  categoria: string;
  valor: number;
  contratos: number;
}

export interface LinhaRanking {
  nome: string;
  papeis: string[];
  valorConsolidado: number;
  quantidadeContratos: number;
}

export interface ResponsaveisData {
  total: number;
  emContratosVigentes: number;
  medianaValor: number;
  ranking: LinhaRanking[];
}

export interface DashboardData {
  geradoEm: string;
  fonte: string;
  resumo: ResumoTSE;
  evolucao: PontoEvolucao[];
  categorias: FatiaCategoria[];
  responsaveis: ResponsaveisData;
}

export const dashboardData: DashboardData = {
  "geradoEm": "2026-07-09T12:18:49.456Z",
  "fonte": "https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE",
  "resumo": {
    "totalContratado": 17277390373.280083,
    "totalContratos": 1268,
    "contratosVigentes": 371,
    "valorVigente": 1483349195.3,
    "totalResponsaveis": 536
  },
  "evolucao": [
    {
      "ano": 2014,
      "valor": 12353640.649999997,
      "contratos": 13
    },
    {
      "ano": 2015,
      "valor": 2631110086.8900003,
      "contratos": 21
    },
    {
      "ano": 2016,
      "valor": 39266792.85999999,
      "contratos": 34
    },
    {
      "ano": 2017,
      "valor": 17885596.820000004,
      "contratos": 43
    },
    {
      "ano": 2018,
      "valor": 70086058.23,
      "contratos": 46
    },
    {
      "ano": 2019,
      "valor": 138312181.59999996,
      "contratos": 161
    },
    {
      "ano": 2020,
      "valor": 155716577.69,
      "contratos": 80
    },
    {
      "ano": 2021,
      "valor": 1314518002.75,
      "contratos": 87
    },
    {
      "ano": 2022,
      "valor": 11608048607.169996,
      "contratos": 166
    },
    {
      "ano": 2023,
      "valor": 449454226.8799999,
      "contratos": 98
    },
    {
      "ano": 2024,
      "valor": 236328692.51999998,
      "contratos": 182
    },
    {
      "ano": 2025,
      "valor": 316639926.90000004,
      "contratos": 198
    },
    {
      "ano": 2026,
      "valor": 287669954.8999999,
      "contratos": 101
    }
  ],
  "categorias": [
    {
      "categoria": "Serviços",
      "valor": 11829001380.340008,
      "contratos": 533
    },
    {
      "categoria": "Compras",
      "valor": 3041341595.1900063,
      "contratos": 533
    },
    {
      "categoria": "Informática (TIC)",
      "valor": 1892583695.2799997,
      "contratos": 105
    },
    {
      "categoria": "Mão de Obra",
      "valor": 499965851.07000005,
      "contratos": 30
    },
    {
      "categoria": "Serviços de Engenharia",
      "valor": 7654863.649999999,
      "contratos": 10
    },
    {
      "categoria": "Outros",
      "valor": 6842987.75,
      "contratos": 57
    }
  ],
  "responsaveis": {
    "total": 536,
    "emContratosVigentes": 374,
    "medianaValor": 18190797.85,
    "ranking": [
      {
        "nome": "RAFAEL FERNANDES DE BARROS COSTA AZEVEDO",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 4042551703.47,
        "quantidadeContratos": 18
      },
      {
        "nome": "CRISTIANO MOREIRA ANDRADE",
        "papeis": [
          "Apoio Administrativo",
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 3125400754.329999,
        "quantidadeContratos": 67
      },
      {
        "nome": "GRACE PORTO DOS SANTOS VERAS",
        "papeis": [
          "Apoio Administrativo",
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2909187539.98,
        "quantidadeContratos": 23
      },
      {
        "nome": "ANA KARINNE SIQUEIRA DE ANDRADE DOS SANTOS",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor Substituto"
        ],
        "valorConsolidado": 2775998924.12,
        "quantidadeContratos": 13
      },
      {
        "nome": "ERICK RAYNE LIMA FERREIRA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2754056761.96,
        "quantidadeContratos": 13
      },
      {
        "nome": "LÍDIA ARAUJO MIRANDA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2745562519.68,
        "quantidadeContratos": 11
      },
      {
        "nome": "JONAS PEREIRA DA SILVA JUNIOR",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2741842570.0899997,
        "quantidadeContratos": 9
      },
      {
        "nome": "ADRIANA DA SILVA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2735135449.3399997,
        "quantidadeContratos": 10
      },
      {
        "nome": "JOSÉ DE MELO CRUZ",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2719841977.31,
        "quantidadeContratos": 12
      },
      {
        "nome": "ALBERTO ARAÚJO CAVALCANTE NETO",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2717874814.08,
        "quantidadeContratos": 12
      },
      {
        "nome": "LUCAS FERREIRA DE LIMA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor",
          "Gestor Substituto"
        ],
        "valorConsolidado": 2714282879.1,
        "quantidadeContratos": 19
      },
      {
        "nome": "ANDRÉ LUÍS VIDIGAL SOARES DE ANDRADE",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2654261566.8399997,
        "quantidadeContratos": 18
      },
      {
        "nome": "HUGO GALVÃO RIBEIRO ARRAES",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2633712111.25,
        "quantidadeContratos": 3
      },
      {
        "nome": "JEAN CARLO GALDINO RODRIGUES",
        "papeis": [
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2516597645.3,
        "quantidadeContratos": 2
      },
      {
        "nome": "RODRIGO TRINDADE GONÇALVES",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2516597645.3,
        "quantidadeContratos": 2
      },
      {
        "nome": "JOSÉ ELIAS DE OLIVEIRA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Substituto",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2515639023.7900004,
        "quantidadeContratos": 21
      },
      {
        "nome": "REJANE SILVEIRA DE ARAÚJO",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2504484515.08,
        "quantidadeContratos": 4
      },
      {
        "nome": "MARIA ANGÉLICA BORGES DA SILVA",
        "papeis": [
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 2500000000,
        "quantidadeContratos": 1
      },
      {
        "nome": "MARIZE CRUZ CERQUEIRA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 1762998793.2699997,
        "quantidadeContratos": 52
      },
      {
        "nome": "ADILSON MARTINS DOS SANTOS",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor"
        ],
        "valorConsolidado": 1745636601.36,
        "quantidadeContratos": 27
      },
      {
        "nome": "CRISTIANE COSTA ROMÃO",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Titular",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 1650884856.85,
        "quantidadeContratos": 67
      },
      {
        "nome": "IVANILDO SOARES PEREIRA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor"
        ],
        "valorConsolidado": 1616062794.0299997,
        "quantidadeContratos": 29
      },
      {
        "nome": "RODRIGO CARNEIRO MUNHOZ COIMBRA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 1586002455.72,
        "quantidadeContratos": 11
      },
      {
        "nome": "DEBORAH DIAS DE SOUZA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Titular"
        ],
        "valorConsolidado": 1568308346.82,
        "quantidadeContratos": 27
      },
      {
        "nome": "MARA NUBIA DELLINGHAUSEN COELHO",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Gestor"
        ],
        "valorConsolidado": 1562791391.61,
        "quantidadeContratos": 27
      },
      {
        "nome": "CRISTINA LEMPEK MARTINS",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 1552288985.6699998,
        "quantidadeContratos": 44
      },
      {
        "nome": "GLADISTON DA SILVA COSTA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 1522151793.1699998,
        "quantidadeContratos": 8
      },
      {
        "nome": "ÉRIKA CRISTINE VIANA CARDOSO",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Titular",
          "Gestor"
        ],
        "valorConsolidado": 1507469521.03,
        "quantidadeContratos": 21
      },
      {
        "nome": "FRANCISCO DEJARDENE MOURA DA SILVA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor"
        ],
        "valorConsolidado": 1503766557.82,
        "quantidadeContratos": 17
      },
      {
        "nome": "WELLINGTON ROBERTO RODRIGUES SIQUEIRA",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Gestor"
        ],
        "valorConsolidado": 1498266809.02,
        "quantidadeContratos": 21
      },
      {
        "nome": "Gabrielly de Farias Rodrigues",
        "papeis": [
          "Fiscal Substituto",
          "Gestor",
          "Gestor Substituto",
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 641448139.8499999,
        "quantidadeContratos": 54
      },
      {
        "nome": "Lucilene Custódio da Silva",
        "papeis": [
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Gestor",
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 634723550.6099999,
        "quantidadeContratos": 55
      },
      {
        "nome": "CRISTIANE SANTANA DA COSTA",
        "papeis": [
          "Fiscal Substituto",
          "Fiscal Titular",
          "Gestor",
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 606582728.81,
        "quantidadeContratos": 53
      },
      {
        "nome": "CARLOS DA CRUZ DOS SANTOS MELO",
        "papeis": [
          "Gestor",
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 606453872.81,
        "quantidadeContratos": 51
      },
      {
        "nome": "EDUARDO LUIZ LOPES ANDRADE",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 601184171.3299999,
        "quantidadeContratos": 60
      },
      {
        "nome": "Eliane Martins de Sousa",
        "papeis": [
          "Fiscal Técnico",
          "Gestor",
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 501658063.59000003,
        "quantidadeContratos": 45
      },
      {
        "nome": "ALINE YUKA SHINIKE ASSAKAWA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto"
        ],
        "valorConsolidado": 454038492.15000004,
        "quantidadeContratos": 37
      },
      {
        "nome": "FLÁVIO WILLIAM BARBOSA SIMÕES",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Titular",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 426112030.68999994,
        "quantidadeContratos": 78
      },
      {
        "nome": "JAQUELINE FIGUEIRA BARBOSA DO NASCIMENTO",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto"
        ],
        "valorConsolidado": 401927647.36,
        "quantidadeContratos": 32
      },
      {
        "nome": "ELMANO AMÂNCIO DE SÁ ALVES",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 363682189.64000005,
        "quantidadeContratos": 23
      },
      {
        "nome": "PAULO ROBERTO DE SOUZA LEMOS",
        "papeis": [
          "Autoridade Competente",
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor"
        ],
        "valorConsolidado": 362317058.99000007,
        "quantidadeContratos": 26
      },
      {
        "nome": "RUI MOREIRA DE OLIVEIRA",
        "papeis": [
          "Autoridade Competente",
          "Fiscal Substituto"
        ],
        "valorConsolidado": 348838164.0799999,
        "quantidadeContratos": 26
      },
      {
        "nome": "MEIRIANE APÓSTOLO DA SILVA",
        "papeis": [
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 335567570.65999997,
        "quantidadeContratos": 20
      },
      {
        "nome": "RAFAEL MARQUES PIRES",
        "papeis": [
          "Responsável pela Gestão da Conta Vinculada"
        ],
        "valorConsolidado": 335567570.65999997,
        "quantidadeContratos": 20
      },
      {
        "nome": "ANDERSON CARDOSO RUBIN",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto"
        ],
        "valorConsolidado": 323803032.07,
        "quantidadeContratos": 28
      },
      {
        "nome": "BYSMARCK BARROS DE SOUSA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 321928273.49,
        "quantidadeContratos": 14
      },
      {
        "nome": "JAQUELINE MICHELLY COELHO DE SOUZA",
        "papeis": [
          "Fiscal Administrativo",
          "Fiscal Administrativo Substituto"
        ],
        "valorConsolidado": 316987602.22,
        "quantidadeContratos": 46
      },
      {
        "nome": "ALCIDES DA SILVA JÚNIOR",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Substituto",
          "Fiscal Titular",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto",
          "Gestor Substituto"
        ],
        "valorConsolidado": 311717592.52000004,
        "quantidadeContratos": 20
      },
      {
        "nome": "VANDERLEI VIEIRA BATISTA",
        "papeis": [
          "Fiscal Administrativo Substituto",
          "Fiscal Setorial",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 254585553.48,
        "quantidadeContratos": 10
      },
      {
        "nome": "CRISTIANO PEÇANHA CORRÊA",
        "papeis": [
          "Fiscal Setorial",
          "Fiscal Setorial Substituto",
          "Fiscal Técnico",
          "Fiscal Técnico Substituto"
        ],
        "valorConsolidado": 248858713.62,
        "quantidadeContratos": 9
      }
    ]
  }
};
