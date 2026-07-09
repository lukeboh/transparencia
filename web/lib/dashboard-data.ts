// Gerado por src/tse/buildDashboardData.js — não editar manualmente.
// Fonte: https://contratos.comprasnet.gov.br/transparencia/contratos?unidade=TSE
// Extraído em: 2026-07-09T12:00:37.286Z

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

export interface DashboardData {
  geradoEm: string;
  fonte: string;
  resumo: ResumoTSE;
  evolucao: PontoEvolucao[];
  categorias: FatiaCategoria[];
}

export const dashboardData: DashboardData = {
  "geradoEm": "2026-07-09T12:00:37.286Z",
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
  ]
};
