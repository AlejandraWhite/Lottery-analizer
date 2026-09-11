import { useEffect, useState } from "react";
import { obtenerHistorialMiercoles } from "../api";
import { formatearFechaMiercoles } from "../utils";

const LOTERIAS = ["Meta", "Valle", "Manizales"];

export default function HistorialCompleto() {
  const [loteriaActiva, setLoteriaActiva] = useState("Meta");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;
    setCargando(true);
    setError("");

    obtenerHistorialMiercoles(loteriaActiva)
      .then((data) => {
        if (!cancelado) setFilas(data);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [loteriaActiva, abierto]);

  return (
    <div className="historial-completo">
      <button className="toggle-historial" onClick={() => setAbierto((v) => !v)}>
        {abierto ? "Ocultar historial completo" : "Ver historial completo"}
      </button>

      {abierto && (
        <div className="historial-panel">
          <div className="tabs-loteria">
            {LOTERIAS.map((loteria) => (
              <button
                key={loteria}
                className={loteria === loteriaActiva ? "tab activa" : "tab"}
                onClick={() => setLoteriaActiva(loteria)}
              >
                {loteria}
              </button>
            ))}
          </div>

          {cargando && <p>Cargando historial de {loteriaActiva}...</p>}
          {error && <p className="mensaje error">{error}</p>}

          {!cargando && !error && (
            <div className="tabla-scroll">
              <table className="tabla-grupo">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Número</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td colSpan={2}>Sin datos para {loteriaActiva}</td>
                    </tr>
                  ) : (
                    filas.map((fila) => (
                      <tr key={fila.id}>
                        <td className="num">{formatearFechaMiercoles(fila.fecha)}</td>
                        <td className="num">{fila.numero}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <p className="conteo-historial">{filas.length} resultados</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}