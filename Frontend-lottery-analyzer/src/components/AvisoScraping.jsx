import { useState } from "react";

const NOMBRE_CORTO = {
  "Lotería del Valle": "Valle",
  "Lotería del Meta": "Meta",
  "Lotería de Manizales": "Manizales",
};

function nombreCorto(nombre) {
  return NOMBRE_CORTO[nombre] || nombre;
}

export default function AvisoScraping({ estado }) {
  const [cerrado, setCerrado] = useState(false);

  if (!estado || !estado.hay_datos || cerrado) return null;

  const { loterias_ok = [], loterias_fallidas = [] } = estado;
  if (loterias_ok.length === 0 && loterias_fallidas.length === 0) return null;

  const hayFallos = loterias_fallidas.length > 0;

  return (
    <div className={hayFallos ? "aviso-scraping aviso-con-fallos" : "aviso-scraping"}>
      <div className="aviso-scraping-texto">
        {loterias_ok.length > 0 && (
          <p>
            ✅ Se actualizaron: {loterias_ok.map(nombreCorto).join(", ")}
          </p>
        )}
        {hayFallos && (
          <p>
            ⚠️ No se pudo actualizar: {loterias_fallidas.map(nombreCorto).join(", ")}
          </p>
        )}
      </div>
      <button className="aviso-scraping-cerrar" onClick={() => setCerrado(true)}>
        ✕
      </button>
    </div>
  );
}