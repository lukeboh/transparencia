import { APP_VERSION } from '@/lib/version';

/** Identificador de versão do app, para o rodapé de cada página. */
export function AppVersion() {
  return <p className="mt-3 text-xs text-muted-foreground/70">Transparência TSE · v{APP_VERSION}</p>;
}
