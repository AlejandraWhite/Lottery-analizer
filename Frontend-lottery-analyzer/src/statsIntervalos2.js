// src/statsIntervalos2.js
// Estadísticas de intervalos para cada terminación de 2 cifras (00-99),
// a partir de { "07": ["2006-01-03", "2006-01-03", "2007-05-10", ...], ... }
//
// - cantidad  = veces que cayó (cuenta repeticiones el mismo día, ej. 2 loterías)
// - fechas    = fechas DISTINTAS (antigua -> reciente); los intervalos se miden entre ellas
// - divisor   = 1 para medir en días, 7 para medir en miércoles/semanas

const MS_DIA = 86400000;

export const aFecha = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const diasEntre = (a, b) => Math.round((b - a) / MS_DIA);

export function calcularStats2(fechasPorNumero, { divisor = 1 } = {}) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return Array.from({ length: 100 }, (_, i) => {
    const combinacion = String(i).padStart(2, "0");
    const todas = [...((fechasPorNumero && fechasPorNumero[combinacion]) || [])].sort();
    const fechas = [...new Set(todas)];
    const cantidad = todas.length;

    const conteo = {};
    for (const f of todas) conteo[f] = (conteo[f] || 0) + 1;

    const ultimaFecha = fechas.length ? fechas[fechas.length - 1] : null;
    const diasSinCaer = ultimaFecha
      ? Math.floor(diasEntre(aFecha(ultimaFecha), hoy) / divisor)
      : null;

    const gaps = [];
    for (let k = 1; k < fechas.length; k++) {
      gaps.push(diasEntre(aFecha(fechas[k - 1]), aFecha(fechas[k])) / divisor);
    }

    let promedio = null, mediana = null, min = null, max = null, cv = null;
    if (gaps.length > 0) {
      promedio = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const ord = [...gaps].sort((a, b) => a - b);
      const mid = Math.floor(ord.length / 2);
      mediana = ord.length % 2 ? ord[mid] : (ord[mid - 1] + ord[mid]) / 2;
      min = ord[0];
      max = ord[ord.length - 1];
      const varianza = gaps.reduce((s, g) => s + (g - promedio) ** 2, 0) / gaps.length;
      cv = promedio > 0 ? Math.sqrt(varianza) / promedio : null;
    }

    const atraso = promedio != null && diasSinCaer != null ? diasSinCaer - promedio : null;
    const veces = promedio > 0 && diasSinCaer != null ? diasSinCaer / promedio : null;

    return {
      combinacion, fechas, conteo, gaps, cantidad, ultimaFecha, diasSinCaer,
      promedio, mediana, min, max, cv, atraso, veces,
    };
  });
}