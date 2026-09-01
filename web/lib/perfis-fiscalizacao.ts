// Representação visual dos "papéis" (perfis de fiscalização/gestão) que vêm
// dos contratos do TSE. Cada papel da fonte é mapeado para um emoji + um
// rótulo curto; papéis "Substituto" reaproveitam o emoji/rótulo do titular
// correspondente e ganham um 🔄 ao final. Papel fora do mapa (ex.: o toggle
// sintético "Não-Fiscal") cai no próprio texto original.

interface PerfilVisual {
  emoji: string;
  curto: string;
}

const PERFIS: Record<string, PerfilVisual> = {
  'Autoridade Competente': { emoji: '🤴', curto: 'Autoridade' },
  Gestor: { emoji: '🧑‍💼', curto: 'Gestor' },
  'Gestor Substituto': { emoji: '🧑‍💼', curto: 'Gestor' },
  'Fiscal Titular': { emoji: '👮‍♂️', curto: 'Fiscal' },
  'Fiscal Substituto': { emoji: '👮‍♂️', curto: 'Fiscal' },
  'Fiscal Técnico': { emoji: '🧑‍🔬', curto: 'Técnico' },
  'Fiscal Técnico Substituto': { emoji: '🧑‍🔬', curto: 'Técnico' },
  'Fiscal Requisitante': { emoji: '👨‍🎓', curto: 'Requisitante' },
  'Fiscal Requisitante Substituto': { emoji: '👨‍🎓', curto: 'Requisitante' },
  'Fiscal Setorial': { emoji: '👷', curto: 'Setorial' },
  'Fiscal Setorial Substituto': { emoji: '👷', curto: 'Setorial' },
  'Fiscal Administrativo': { emoji: '🕵️‍♂️', curto: 'Administrativo' },
  'Fiscal Administrativo Substituto': { emoji: '🕵️‍♂️', curto: 'Administrativo' },
  'Responsável Unidade Requisitante': { emoji: '💂‍♂️', curto: 'Responsável Unidade' },
  'Responsável no Setor de Contratos': { emoji: '📜', curto: 'Contratos' },
  'Responsável pela Gestão da Conta Vinculada': { emoji: '🤵‍♂️', curto: 'Conta Vinculada' },
  'Apoio Administrativo': { emoji: '👨‍💻', curto: 'Apoio' },
};

export const SUBSTITUTO_MARCA = '🔄';

/** True quando o papel é a variante "Substituto" de outro. */
export function ehSubstituto(papel: string): boolean {
  return /\bsubstituto\b/i.test(papel);
}

/** Só o emoji do papel (para modo condensado do filtro). "•" se desconhecido. */
export function iconePerfil(papel: string): string {
  return PERFIS[papel]?.emoji ?? '•';
}

/** Só o rótulo curto do papel, sem emoji nem 🔄. Texto original se desconhecido. */
export function nomeCurtoPerfil(papel: string): string {
  return PERFIS[papel]?.curto ?? papel;
}

/**
 * Rótulo visual do papel: "👮‍♂️ Fiscal" (titular) ou "👮‍♂️ Fiscal 🔄"
 * (substituto). Retorna o texto original se o papel não estiver no mapa.
 */
export function rotuloPerfil(papel: string): string {
  const perfil = PERFIS[papel];
  if (!perfil) return papel;
  const base = `${perfil.emoji} ${perfil.curto}`;
  return ehSubstituto(papel) ? `${base} ${SUBSTITUTO_MARCA}` : base;
}

// ── Taxonomia hierárquica dos papéis, para o filtro de /servidores ───────────
// Cada grupo reúne papéis "titulares" afins; o substituto de cada titular (quando
// a fonte tem a variante) fica pareado com ele, não solto na lista.

/** Substituto correspondente a cada papel titular que tem essa variante na fonte. */
export const SUBSTITUTO_DE: Readonly<Record<string, string>> = {
  Gestor: 'Gestor Substituto',
  'Fiscal Titular': 'Fiscal Substituto',
  'Fiscal Técnico': 'Fiscal Técnico Substituto',
  'Fiscal Requisitante': 'Fiscal Requisitante Substituto',
  'Fiscal Setorial': 'Fiscal Setorial Substituto',
  'Fiscal Administrativo': 'Fiscal Administrativo Substituto',
};

export interface GrupoPerfis {
  id: string;
  titulo: string;
  emoji: string;
  /** Papéis titulares do grupo, na ordem de exibição. */
  titulares: string[];
}

export const GRUPOS_PERFIS: readonly GrupoPerfis[] = [
  {
    id: 'fiscalizacao',
    titulo: 'Fiscalização',
    emoji: '👮‍♂️',
    titulares: [
      'Fiscal Titular',
      'Fiscal Técnico',
      'Fiscal Requisitante',
      'Fiscal Setorial',
      'Fiscal Administrativo',
    ],
  },
  {
    id: 'outros',
    titulo: 'Outros',
    emoji: '🗂️',
    titulares: [
      'Autoridade Competente',
      'Gestor',
      'Responsável Unidade Requisitante',
      'Responsável no Setor de Contratos',
      'Responsável pela Gestão da Conta Vinculada',
      'Apoio Administrativo',
    ],
  },
];

/**
 * Organiza uma lista plana de papéis (como vem do ranking) nos grupos da
 * taxonomia. Cada item traz o titular e o substituto **quando ambos existem na
 * lista recebida**. Papéis fora da taxonomia entram no grupo "Outros" para nunca
 * sumirem silenciosamente.
 */
export function agruparPapeis(papeis: string[]): {
  grupo: GrupoPerfis;
  pares: { titular: string; substituto: string | null }[];
}[] {
  const disponiveis = new Set(papeis);
  const usados = new Set<string>();
  const resultado: { grupo: GrupoPerfis; pares: { titular: string; substituto: string | null }[] }[] = [];

  for (const grupo of GRUPOS_PERFIS) {
    const pares: { titular: string; substituto: string | null }[] = [];
    for (const titular of grupo.titulares) {
      if (!disponiveis.has(titular)) continue;
      usados.add(titular);
      const sub = SUBSTITUTO_DE[titular] ?? null;
      const substituto = sub && disponiveis.has(sub) ? sub : null;
      if (substituto) usados.add(substituto);
      pares.push({ titular, substituto });
    }
    if (pares.length > 0) resultado.push({ grupo, pares });
  }

  const semGrupo = papeis.filter((p) => !usados.has(p));
  if (semGrupo.length > 0) {
    const paresExtra = semGrupo.map((titular) => ({ titular, substituto: null }));
    const grupoOutros = resultado.find((r) => r.grupo.id === 'outros');
    if (grupoOutros) {
      grupoOutros.pares.push(...paresExtra);
    } else {
      resultado.push({
        grupo: { id: 'outros', titulo: 'Outros', emoji: '🗂️', titulares: semGrupo },
        pares: paresExtra,
      });
    }
  }

  return resultado;
}
