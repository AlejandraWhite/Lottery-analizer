// src/statsIntervalos3.js
// Estadísticas de intervalos para cada número de 3 cifras (000-999),
// a partir de { "123": ["2006-01-03", "2007-05-10", ...], ... }

const MS_DIA = 86400000;

export const aFecha = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const diasEntre = (a, b) => Math.round((b - a) / MS_DIA);

export function calcularStats(fechasPorNumero) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return Array.from({ length: 1000 }, (_, i) => {
    const combinacion = String(i).padStart(3, "0");
    const fechas = [...(fechasPorNumero[combinacion] || [])].sort(); // antigua -> reciente
    const cantidad = fechas.length;
    const ultimaFecha = cantidad ? fechas[cantidad - 1] : null;
    const diasSinCaer = ultimaFecha ? diasEntre(aFecha(ultimaFecha), hoy) : null;

    const gaps = [];
    for (let k = 1; k < fechas.length; k++) {
      gaps.push(diasEntre(aFecha(fechas[k - 1]), aFecha(fechas[k])));
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
    const distintos = new Set(combinacion).size; // 3 diferentes, 2 un repetido, 1 pacha

    return {
      combinacion, fechas, gaps, cantidad, ultimaFecha, diasSinCaer,
      promedio, mediana, min, max, cv, atraso, veces, distintos,
    };
  });
}

export const NOMBRE_TIPO = { 3: "Diferentes", 2: "Repetido", 1: "Pacha" };