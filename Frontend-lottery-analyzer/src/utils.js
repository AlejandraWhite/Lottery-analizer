export function formatearFechaMiercoles(fechaIso) {
  if (!fechaIso) return "";

  // Se parsea manualmente año-mes-día como fecha LOCAL, evitando que
  // new Date("YYYY-MM-DD") la interprete como medianoche UTC y se
  // corra un día hacia atrás en zonas horarias negativas (ej. Bogotá).
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);

  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function esReciente(fechaIso, dias = 7) {
  if (!fechaIso) return false;
  const fecha = new Date(fechaIso);
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return fecha >= limite;
}

// --- Búsqueda con varios términos ---

// "07 15, 0725" -> ["07", "15", "0725"]
export function terminosBusqueda(busqueda) {
  return [...new Set(String(busqueda ?? "").split(/[\s,;]+/).filter(Boolean))];
}

function coincideUno(valor, patron, modo) {
  const str = String(valor ?? "").toLowerCase();
  const pat = patron.toLowerCase();
  return modo === "ultimas2" ? str.endsWith(pat) : str.includes(pat);
}

// true si el valor coincide con CUALQUIERA de los términos
export function coincideTexto(valor, busqueda, modo = "cualquiera") {
  return terminosBusqueda(busqueda).some((t) => coincideUno(valor, t, modo));
}