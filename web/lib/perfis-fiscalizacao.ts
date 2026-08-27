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

const SUBSTITUTO = '🔄';

/** True quando o papel é a variante "Substituto" de outro. */
export function ehSubstituto(papel: string): boolean {
  return /\bsubstituto\b/i.test(papel);
}

/**
 * Rótulo visual do papel: "👮‍♂️ Fiscal" (titular) ou "👮‍♂️ Fiscal 🔄"
 * (substituto). Retorna o texto original se o papel não estiver no mapa.
 */
export function rotuloPerfil(papel: string): string {
  const perfil = PERFIS[papel];
  if (!perfil) return papel;
  const base = `${perfil.emoji} ${perfil.curto}`;
  return ehSubstituto(papel) ? `${base} ${SUBSTITUTO}` : base;
}
