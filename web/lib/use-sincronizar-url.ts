'use client';

import { useEffect, useState } from 'react';
import { escreverParamsUrl, lerParamsUrl } from '@/lib/url-filtros';

/**
 * Mantém um conjunto de filtros em sincronia com a query string, sem
 * recarregar a página.
 *
 * - No mount lê a URL uma vez e chama `aoLerUrl` para hidratar o estado.
 * - Depois de hidratado, toda mudança em `params` é reescrita na URL.
 *
 * `params` deve conter só as chaves desta tela/deste componente; as demais
 * chaves da URL são preservadas, então dois componentes da mesma página podem
 * chamar o hook lado a lado desde que usem chaves diferentes.
 *
 * A escrita só começa depois do primeiro render pós-hidratação, então o estado
 * default nunca chega a apagar um parâmetro que veio no link compartilhado.
 */
export function useSincronizarUrl(
  params: Record<string, string | number | null | undefined>,
  aoLerUrl: (sp: URLSearchParams) => void,
) {
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    aoLerUrl(lerParamsUrl());
    setHidratado(true);
    // roda só no mount; `aoLerUrl` é tratado como estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chave = JSON.stringify(params);
  useEffect(() => {
    if (!hidratado) return;
    escreverParamsUrl(params);
    // `chave` já representa `params`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, chave]);
}
