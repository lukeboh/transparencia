import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compactBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fullBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const inteiro = new Intl.NumberFormat('pt-BR');

/** R$ 17,3 bi — para valores de destaque e eixos. */
export function brlCompacto(valor: number) {
  return compactBRL.format(valor);
}

/** R$ 17.277.390.373 — para tooltips e tabelas. */
export function brlCompleto(valor: number) {
  return fullBRL.format(valor);
}

export function numero(valor: number) {
  return inteiro.format(valor);
}
