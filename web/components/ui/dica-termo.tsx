'use client';

import { InfoDica } from '@/components/ui/info-dica';
import { GLOSSARIO, type TermoId } from '@/lib/glossario';

/**
 * Atalho: um ícone (i) já preenchido com o verbete do glossário central.
 * `<DicaTermo id="lotacao" />` em vez de repetir título e texto em cada tela.
 */
export function DicaTermo({
  id,
  tamanho,
  alinhamento,
  className,
}: {
  id: TermoId;
  tamanho?: 'sm' | 'md';
  alinhamento?: 'centro' | 'esquerda' | 'direita';
  className?: string;
}) {
  const verbete = GLOSSARIO[id];
  return (
    <InfoDica titulo={verbete.titulo} tamanho={tamanho} alinhamento={alinhamento} className={className}>
      {verbete.texto}
    </InfoDica>
  );
}
