import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fullBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const umaCasa = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const inteiro = new Intl.NumberFormat('pt-BR');

/**
 * R$ 17,3 bi — para valores de destaque e eixos.
 * Implementado à mão em vez de Intl `notation: 'compact'`: versões de ICU
 * divergem no zero à direita ("R$ 3 bi" vs "R$ 3,0 bi") entre o Node do build
 * e o navegador, o que causava mismatch de hidratação no React.
 */
export function brlCompacto(valor: number) {
  const abs = Math.abs(valor);
  //  : espaço inquebrável, como o Intl usa — evita quebra de linha
  // no meio do valor em rótulos de eixo.
  if (abs >= 1e9) return `R$ ${umaCasa.format(valor / 1e9)} bi`;
  if (abs >= 1e6) return `R$ ${umaCasa.format(valor / 1e6)} mi`;
  if (abs >= 1e3) return `R$ ${umaCasa.format(valor / 1e3)} mil`;
  return fullBRL.format(valor);
}

/** R$ 17.277.390.373 — para tooltips e tabelas. */
export function brlCompleto(valor: number) {
  return fullBRL.format(valor);
}

export function numero(valor: number) {
  return inteiro.format(valor);
}

/**
 * "2026-07-10T11:39:00.000Z" → "10/07/2026", sem passar por Date/fuso — o
 * mesmo texto no prerender (Node, UTC) e no navegador, evitando mismatch de
 * hidratação perto da meia-noite.
 */
export function dataUTC(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "RAFAEL FERNANDES DE BARROS" → "Rafael Fernandes de Barros". */
export function nomeProprio(nome: string) {
  return nome
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra) =>
      PARTICULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1),
    )
    .join(' ');
}
