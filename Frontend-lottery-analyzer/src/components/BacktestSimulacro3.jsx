import { useState } from "react";
import { obtenerBacktest3 } from "../api";

const dinero = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatoFecha = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function BacktestSimulacro3() {
  const [dias, setDias] = useState(90);
  const [total, setTotal] = useState(150);
  const [diasReciente, setDiasReciente] = useState(365);
  const [apuesta, setApuesta] = useState(3000);
  const [multiplicador, setMultiplicador] = useState(400);
  const [encime, setEncime] = useState(80);
  const [iva, setIva] = useState(19);

  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const correr = async () => {
    setCargando(true);
    setError("");
    try {
      const data = await obtenerBacktest3({
        dias: Number(dias) || 90,
        total: Number(total) || 150,
        dias_reciente: Number(diasReciente) || 0,
        apuesta: Number(apuesta) || 0,
        multiplicador: Number(multiplicador) || 0,
        encime: Number(encime) || 0,
        iva: Number(iva) || 0,
      });
      setResultado(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const r = resultado?.resumen;

  return (
    <div className="perm-simulacro">
      <h3>Prueba hacia atrás · ¿habría funcionado esta selección?</h3>
      <p className="sim-linea">
        Para cada día, arma la selección solo con lo que se sabía hasta el día anterior y la
        compara con lo que cayó ese día.
      </p>

      <div className="perm-filtros">
        <label>
          Días a probar:
          <input type="number" min="1" max="730" value={dias} onChange={(e) => setDias(e.target.value)} />
        </label>
        <label>
          Total de números:
          <input type="number" min="1" max="1000" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label>
          No han caído en (días):
          <input type="number" min="0" value={diasReciente} onChange={(e) => setDiasReciente(e.target.value)} />
        </label>
        <label>
          Apuesta por número ($):
          <input type="number" min="0" value={apuesta} onChange={(e) => setApuesta(e.target.value)} />
        </label>
        <label>
          Paga por peso:
          <input type="number" min="0" value={multiplicador} onChange={(e) => setMultiplicador(e.target.value)} />
        </label>
        <label>
          Encime (%):
          <input type="number" min="0" value={encime} onChange={(e) => setEncime(e.target.value)} />
        </label>
        <label>
          IVA (%):
          <input type="number" min="0" value={iva} onChange={(e) => setIva(e.target.value)} />
        </label>
        <button type="button" className="perm-limpiar" onClick={correr} disabled={cargando}>
          {cargando ? "⏳ Calculando..." : "▶ Correr prueba"}
        </button>
      </div>

      {cargando && <p className="sim-rehaciendo">⏳ Calculando la prueba...</p>}
      {error && <p className="formulario-error">{error}</p>}

      {r && (
        <>
          <div className="sim-tarjetas">
            <div className="sim-tarjeta">
              <span>Días probados</span>
              <strong>{r.dias_evaluados}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Días con premio</span>
              <strong>
                {r.dias_con_premio} de {r.dias_evaluados}
              </strong>
            </div>
            <div className="sim-tarjeta">
              <span>Aciertos reales</span>
              <strong>{r.aciertos}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Aciertos esperados al azar</span>
              <strong>{r.aciertos_esperados_azar}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Total jugado</span>
              <strong>{dinero(r.jugado)}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Total ganado</span>
              <strong>{dinero(r.ganado)}</strong>
            </div>
            <div className={`sim-tarjeta ${r.neto >= 0 ? "sim-positivo" : "sim-negativo"}`}>
              <span>Neto</span>
              <strong>{dinero(r.neto)}</strong>
            </div>
          </div>

          <p className="sim-linea">
            Tu selección acertó <strong>{r.aciertos}</strong> veces; jugando el mismo número de
            cifras al azar se esperaban <strong>{r.aciertos_esperados_azar}</strong>. Premio por
            acierto: <strong>{dinero(resultado.premio_por_acierto)}</strong>.
          </p>

          <div className="perm-scroll sim-historial">
            <table className="tabla-permutantes">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Jugados</th>
                  <th>Cayeron</th>
                  <th>Aciertos</th>
                  <th>Ganadores</th>
                  <th>Jugado</th>
                  <th>Ganado</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {resultado.detalle.map((d) => {
                  const neto = d.premio - d.costo;
                  return (
                    <tr key={d.fecha}>
                      <td>{formatoFecha(d.fecha)}</td>
                      <td>{d.jugados}</td>
                      <td>{d.cayeron}</td>
                      <td>{d.aciertos > 0 ? `🎉 ${d.aciertos}` : "0"}</td>
                      <td>{d.ganadores.join(" · ") || "—"}</td>
                      <td className="perm-cantidad">{dinero(d.costo)}</td>
                      <td className="perm-cantidad">{dinero(d.premio)}</td>
                      <td className={`perm-cantidad ${neto >= 0 ? "sim-positivo" : "sim-negativo"}`}>
                        {dinero(neto)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}