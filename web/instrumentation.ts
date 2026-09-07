// Hook de instrumentação do Next.js (App Router): `register` roda uma vez
// quando o servidor sobe; `onRequestError` roda em todo erro de servidor não
// tratado (rota, Server Component, Server Action). Usado só para gravar no
// log interno (ver src/lib/logger.js e /painel/[chave]) — nada disso afeta
// a resposta ao usuário. Documentação:
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { registrar } = await import('../src/lib/logger.js');
  registrar('app', 'info', 'Servidor Next.js iniciado');

  process.on('uncaughtException', (err) => {
    registrar('erro', 'erro', err.message, { stack: err.stack });
  });
  process.on('unhandledRejection', (motivo) => {
    registrar('erro', 'erro', motivo instanceof Error ? motivo.message : String(motivo), {
      stack: motivo instanceof Error ? motivo.stack : undefined,
    });
  });
}

export async function onRequestError(
  erro: unknown,
  requisicao: { path: string; method: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { registrar } = await import('../src/lib/logger.js');
  registrar('erro', 'erro', erro instanceof Error ? erro.message : String(erro), {
    path: requisicao?.path,
    method: requisicao?.method,
    stack: erro instanceof Error ? erro.stack : undefined,
  });
}
