// Utilidades de data compartilhadas entre agregarDashboard.js e
// agregarFuncoes.js — em módulo próprio para evitar import circular entre
// os dois (agregarDashboard usa agregarFuncoes para mesclar os dados).

function anoDe(dataBr) {
  const m = /(\d{4})$/.exec(dataBr ?? '');
  return m ? Number(m[1]) : undefined;
}

function paraDataISO(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

export { anoDe, paraDataISO };
