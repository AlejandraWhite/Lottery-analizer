const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function obtenerAnalisis() {
  const res = await fetch(`${API_URL}/analisis`);
  if (!res.ok) throw new Error("Error al obtener el análisis");
  return res.json();
}

export async function importarExcel(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);

  const res = await fetch(`${API_URL}/excel/importar-historico`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al importar el excel");
  }

  return res.json();
}

export async function obtenerVistaExcel() {
  const res = await fetch(`${API_URL}/vista-excel`);
  if (!res.ok) throw new Error("Error al obtener la vista de columnas");
  return res.json();
}

export async function sincronizarLoteria() {
  const res = await fetch(`${API_URL}/scrapers/sincronizar`, {
    method: "POST",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al sincronizar");
  }

  return res.json();
}

export async function agregarResultadoManual({ fecha, numero, loteria }) {
  const res = await fetch(`${API_URL}/resultados/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fecha, numero, loteria }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al agregar el resultado");
  }

  return res.json();
}

export async function listarResultados({ terminacion, loteria, limite = 50 } = {}) {
  const params = new URLSearchParams();
  if (terminacion) params.set("terminacion", terminacion);
  if (loteria) params.set("loteria", loteria);
  params.set("limite", limite);

  const res = await fetch(`${API_URL}/resultados?${params.toString()}`);
  if (!res.ok) throw new Error("Error al listar resultados");
  return res.json();
}

export async function eliminarResultado(id) {
  const res = await fetch(`${API_URL}/resultados/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al eliminar el resultado");
  }

  return res.json();
}

export async function importarExcelMiercoles(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);

  const res = await fetch(`${API_URL}/miercoles/importar-excel`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al importar el excel de miércoles");
  }

  return res.json();
}

export async function obtenerVistaMiercoles() {
  const res = await fetch(`${API_URL}/miercoles/vista`);
  if (!res.ok) throw new Error("Error al obtener la vista de miércoles");
  return res.json();
}

export async function obtenerHistorialMiercoles(loteria) {
  const res = await fetch(`${API_URL}/miercoles/historial/${loteria}`);
  if (!res.ok) throw new Error(`Error al obtener el historial de ${loteria}`);
  return res.json();
}

export async function agregarResultadoManualMiercoles({ fecha, numero, loteria }) {
  const res = await fetch(`${API_URL}/miercoles/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fecha, numero, loteria }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al agregar el resultado de miércoles");
  }

  return res.json();
}


export async function importarExcelViernes(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);
 
  const res = await fetch(`${API_URL}/viernes/importar-excel`, {
    method: "POST",
    body: formData,
  });
 
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al importar el excel de viernes");
  }
 
  return res.json();
}
 
export async function obtenerVistaViernes() {
  const res = await fetch(`${API_URL}/viernes/vista`);
  if (!res.ok) throw new Error("Error al obtener la vista de viernes");
  return res.json();
}
 
export async function obtenerHistorialViernes(loteria) {
  const res = await fetch(`${API_URL}/viernes/historial/${loteria}`);
  if (!res.ok) throw new Error(`Error al obtener el historial de ${loteria}`);
  return res.json();
}
 
export async function agregarResultadoManualViernes({ fecha, numero, loteria }) {
  const res = await fetch(`${API_URL}/viernes/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fecha, numero, loteria }),
  });
 
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al agregar el resultado de viernes");
  }
 
  return res.json();
}

export async function obtenerEstadoScraping() {
  const res = await fetch(`${API_URL}/scrapers/estado`);
  if (!res.ok) throw new Error("Error al obtener el estado del scraping");
  return res.json();
}
 
export async function sincronizarScraping() {
  const res = await fetch(`${API_URL}/scrapers/sincronizar`, { method: "POST" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Error al sincronizar por scraping");
  }
  return res.json();
}