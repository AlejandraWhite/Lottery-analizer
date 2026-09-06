import { useState } from "react";
import { agregarResultadoManual } from "../api";

export default function GestorResultados({ onResultado }) {
  const [fecha, setFecha] = useState("");
  const [numero, setNumero] = useState("");
  const [loteria, setLoteria] = useState("Manual");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function manejarEnvio(e) {
    e.preventDefault();
    setError(null);

    if (!fecha || !numero) {
      setError("Fecha y número son obligatorios");
      return;
    }

    setCargando(true);
    try {
      const data = await agregarResultadoManual({ fecha, numero, loteria });
      onResultado(data);
      setNumero("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="formulario-manual" onSubmit={manejarEnvio}>
      <h3>Agregar resultado manual (pruebas)</h3>
      <div className="formulario-fila">
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Número
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="ej. 1234"
            maxLength={4}
          />
        </label>
        <label>
          Lotería
          <input type="text" value={loteria} onChange={(e) => setLoteria(e.target.value)} />
        </label>
        <button type="submit" disabled={cargando}>
          {cargando ? "Agregando..." : "Agregar"}
        </button>
      </div>
      {error && <p className="formulario-error">{error}</p>}
    </form>
  );
}