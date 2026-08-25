// Parser CSV genérico (delimitador ';', aspas duplas, "" como aspas escapada,
// campos com quebra de linha dentro de aspas) — necessário porque o export de
// "Consulta de contratos" do SIAC (https://siac-consultas.tse.jus.br) tem
// objetoContrato com quebras de linha internas, o que quebra um split ingênuo
// por linha.
function parseCsvSiac(texto) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroAspas = false;
  let i = 0;
  const n = texto.length;
  while (i < n) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 2; continue; }
        dentroAspas = false; i++; continue;
      }
      campo += c; i++; continue;
    } else {
      if (c === '"') { dentroAspas = true; i++; continue; }
      if (c === ';') { linha.push(campo); campo = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') {
        linha.push(campo); campo = '';
        if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
        linha = []; i++; continue;
      }
      campo += c; i++; continue;
    }
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

export { parseCsvSiac };
