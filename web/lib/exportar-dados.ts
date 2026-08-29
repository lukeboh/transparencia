// Exportação client-side das tabelas para planilha, sem dependências.
//
// Dois formatos, ambos abrem no Excel:
//  • CSV  — UTF-8 com BOM e separador ';' (padrão do Excel pt-BR), número com
//           vírgula decimal para entrar como número, não como texto.
//  • XLS  — SpreadsheetML 2003 (XML que o Excel abre como planilha nativa, com
//           tipo de célula de verdade e cabeçalho em negrito).
//
// O recorte exportado é responsabilidade de quem chama: passe as linhas já
// filtradas/ordenadas exatamente como estão na tela.

export type FormatoExport = 'csv' | 'xls';

/** Byte-order mark: faz o Excel abrir o CSV como UTF-8 (acentos corretos). */
const BOM = String.fromCharCode(0xfeff);

export type ValorCelula = string | number | boolean | null | undefined;

export interface ColunaExport<T> {
  /** Texto do cabeçalho da coluna. */
  cabecalho: string;
  /** Valor bruto da célula para a linha — `number` entra como número na planilha. */
  valor: (linha: T) => ValorCelula;
}

/** "fiscais" → "fiscais-2026-08-28" (data local, para diferenciar exportações). */
function comData(nomeBase: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${nomeBase}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function baixar(partes: BlobPart[], nomeArquivo: string, mime: string) {
  const blob = new Blob(partes, { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga fora do clique — Safari precisa do URL vivo durante o download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ── CSV ─────────────────────────────────────────────────────────────────────
function celulaCSV(v: ValorCelula): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    // Vírgula decimal: com separador ';' o Excel pt-BR lê como número.
    return String(v).replace('.', ',');
  }
  const texto = String(v);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function gerarCSV<T>(linhas: T[], colunas: ColunaExport<T>[]): string {
  const sep = ';';
  const linha = (celulas: string[]) => celulas.join(sep);
  const cabecalho = linha(colunas.map((c) => celulaCSV(c.cabecalho)));
  const corpo = linhas.map((l) => linha(colunas.map((c) => celulaCSV(c.valor(l)))));
  return [cabecalho, ...corpo].join('\r\n');
}

// ── XLS (SpreadsheetML 2003) ────────────────────────────────────────────────
function escaparXML(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function celulaXLS(v: ValorCelula, estilo?: string): string {
  const attr = estilo ? ` ss:StyleID="${estilo}"` : '';
  if (v === null || v === undefined || v === '') return `<Cell${attr}/>`;
  if (typeof v === 'boolean') {
    return `<Cell${attr}><Data ss:Type="String">${v ? 'Sim' : 'Não'}</Data></Cell>`;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return `<Cell${attr}/>`;
    return `<Cell${attr}><Data ss:Type="Number">${v}</Data></Cell>`;
  }
  return `<Cell${attr}><Data ss:Type="String">${escaparXML(String(v))}</Data></Cell>`;
}

/** Nome de aba válido: sem \ / ? * [ ] e no máximo 31 caracteres. */
function nomeAbaValido(nome: string): string {
  return nome.replace(/[\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Dados';
}

function gerarXLS<T>(linhas: T[], colunas: ColunaExport<T>[], nomeAba: string): string {
  const row = (celulas: string[]) => `<Row>${celulas.join('')}</Row>`;
  const cabecalho = row(colunas.map((c) => celulaXLS(c.cabecalho, 'cab')));
  const corpo = linhas.map((l) => row(colunas.map((c) => celulaXLS(c.valor(l))))).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
    '<Styles><Style ss:ID="cab"><Font ss:Bold="1"/>' +
    '<Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/></Style></Styles>\n' +
    `<Worksheet ss:Name="${escaparXML(nomeAbaValido(nomeAba))}">\n` +
    `<Table>${cabecalho}${corpo}</Table>\n` +
    '</Worksheet>\n</Workbook>'
  );
}

// ── API ─────────────────────────────────────────────────────────────────────
export function exportarDados<T>(
  formato: FormatoExport,
  linhas: T[],
  colunas: ColunaExport<T>[],
  nomeBase: string,
  nomeAba = 'Dados',
): void {
  const arquivo = comData(nomeBase);
  if (formato === 'csv') {
    baixar([BOM, gerarCSV(linhas, colunas)], `${arquivo}.csv`, 'text/csv');
  } else {
    baixar([gerarXLS(linhas, colunas, nomeAba)], `${arquivo}.xls`, 'application/vnd.ms-excel');
  }
}
