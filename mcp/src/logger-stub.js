// Substitui src/lib/logger.js no bundle do MCP: o logger do site grava em
// <raiz do repo>/logs, caminho que não existe (ou não deve ser tocado) numa
// instalação do MCP. Aqui o registro vai para stderr, que o cliente MCP coleta
// nos logs dele.
export function registrar(categoria, nivel, mensagem) {
  console.error(`[tse-mcp] ${categoria}/${nivel}: ${mensagem}`);
}

export function lerRegistros() {
  return [];
}
