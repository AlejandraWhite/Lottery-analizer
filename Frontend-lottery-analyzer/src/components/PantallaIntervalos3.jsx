import { useEffect, useMemo, useState } from "react";
import { obtenerFechasCombinaciones3 } from "../api";
import { terminosBusqueda } from "../utils";
import { calcularStats } from "../statsIntervalos3";
import "./PantallaPermutantes.css";

function formatoFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const entero = (v) => (v == null ? "—" : Math.round(v).toLocaleString());
const decimal = (v) => (v == null ? "—" : v.toFixed(1));

export default function PantallaIntervalos3({ busqueda, busquedaFecha, modoBusqueda = "cualquiera" }) {
  const [fechas, setFechas] = useState({});
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState(false);

  const [minVeces, setMinVeces] = useState(3); // mínimo de apariciones para confiar en el promedio
  const [umbral, setUmbral] = useState(1.5); // atrasado = días sin caer >= umbral × su promedio
  const [orden, setOrden] = useState("numero");

  const cargarDatos = async () => {
    setActualizando(true);
    try {
      const data = await obtenerFechasCombinaciones3();
      setFechas(data.fechas || {});
      setTotalHistorico(data.total || 0);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setActualizando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const ultimasCifras = modoBusqueda === "ultimas2";
  const terminos = terminosBusqueda(busqueda);
  const terminosFecha = terminosBusqueda(busquedaFecha);

  const stats = useMemo(() => calcularStats(fechas), [fechas]);

  const fechaCoincide = (iso) => {
    if (terminosFecha.length === 0 || !iso) return false;
    const f = formatoFecha(iso);
    return terminosFecha.some((t) => f.includes(t));
  };

  const coincideBusqueda = (t) => {
    const porFecha = t.fechas.some(fechaCoincide);
    const porNumero =
      terminos.length > 0 &&
      terminos.some((x) =>
        ultimasCifras ? t.combinacion.endsWith(x) : t.combinacion.includes(x)
      );
    return porNumero || porFecha;
  };

  const atrasados = useMemo(
    () =>
      stats
        .filter(
          (t) =>
            t.cantidad >= Number(minVeces) &&
            t.veces != null &&
            t.veces >= Number(umbral)
        )
        .sort((a, b) => b.veces - a.veces || a.combinacion.localeCompare(b.combinacion)),
    [stats, minVeces, umbral]
  );

  const todos = useMemo(() => {
    const copia = [...stats];
    const nulosAlFinal = (campo, desc) => (a, b) => {
      const x = a[campo], y = b[campo];
      if (x == null && y == null) return a.combinacion.localeCompare(b.combinacion);
      if (x == null) return 1;
      if (y == null) return -1;
      return (desc ? y - x : x - y) || a.combinacion.localeCompare(b.combinacion);
    };
    switch (orden) {
      case "cantidad": return copia.sort(nulosAlFinal("cantidad", true));
      case "promedio": return copia.sort(nulosAlFinal("promedio", false));
      case "veces": return copia.sort(nulosAlFinal("veces", true));
      case "sinCaer": return copia.sort(nulosAlFinal("diasSinCaer", true));
      case "cv": return copia.sort(nulosAlFinal("cv", false));
      default: return copia; // ya vienen 000..999
    }
  }, [stats, orden]);

  const promedioGlobal = useMemo(() => {
    const con = stats.filter((t) => t.promedio != null);
    return con.length ? con.reduce((s, t) => s + t.promedio, 0) / con.length : null;
  }, [stats]);

  const nuncaHanCaido = stats.filter((t) => t.cantidad === 0).length;
  const hayBusqueda = terminos.length > 0 || terminosFecha.length > 0;

  const encabezado = (
    <tr>
      <th>#</th>
      <th>Número</th>
      <th>Veces</th>
      <th>Prom. días entre caídas</th>
      <th>Mediana</th>
      <th>Mín</th>
      <th>Máx</th>
      <th title="Desviación / promedio. Cerca de 0 = muy regular; cerca de 1 = comportamiento aleatorio">
        Regularidad
      </th>
      <th>Última vez</th>
      <th>Días sin caer</th>
      <th>Atraso (días)</th>
      <th>× su promedio</th>
      <th title="De la más antigua a la más reciente. Entre paréntesis: días desde la caída anterior">
        Todas las veces que cayó (antigua → reciente)
      </th>
    </tr>
  );

  const fila = (t, i) => (
    <tr key={t.combinacion} className={coincideBusqueda(t) ? "fila-busqueda" : ""}>
      <td>{i + 1}</td>
      <td className="perm-grupo-cron">
        <strong>{t.combinacion}</strong>
      </td>
      <td className="perm-cantidad">{t.cantidad}</td>
      <td>{entero(t.promedio)}</td>
      <td>{entero(t.mediana)}</td>
      <td>{entero(t.min)}</td>
      <td>{entero(t.max)}</td>
      <td>{decimal(t.cv)}</td>
      <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
      <td>{entero(t.diasSinCaer)}</td>
      <td>{entero(t.atraso)}</td>
      <td className="perm-porcentaje">{t.veces != null ? `${t.veces.toFixed(2)}×` : "—"}</td>
      <td style={{ minWidth: 460, whiteSpace: "normal", textAlign: "left" }}>
        {t.fechas.length === 0 && "Nunca"}
        {t.fechas.map((f, k) => (
          <span
            key={k}
            style={{
              display: "inline-block",
              marginRight: 8,
              padding: "0 4px",
              borderRadius: 3,
              background: fechaCoincide(f) ? "#fde68a" : "transparent",
              color: fechaCoincide(f) ? "#000" : undefined,
            }}
          >
            {formatoFecha(f)}
            {k > 0 && <small style={{ opacity: 0.6 }}> (+{t.gaps[k - 1]})</small>}
          </span>
        ))}
      </td>
    </tr>
  );

  return (
    <div className="permutantes">
      <h3>
        Intervalos y números atrasados (3 cifras)
        {hayBusqueda && ` · ${stats.filter(coincideBusqueda).length} coinciden`}
      </h3>
      <p>
        Para cada número 000-999: cuántas veces ha caído y cada cuántos días cae en promedio.
        Basado en {totalHistorico.toLocaleString()} números del histórico. Promedio general
        entre caídas: {entero(promedioGlobal)} días · Nunca han caído: {nuncaHanCaido}
      </p>

      <div className="perm-filtros">
        <label>
          Mínimo de veces caído:
          <input
            type="number"
            min="2"
            inputMode="numeric"
            value={minVeces}
            onChange={(e) => setMinVeces(e.target.value)}
          />
        </label>
        <label>
          Atrasado si lleva sin caer (× su promedio):
          <input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={umbral}
            onChange={(e) => setUmbral(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="perm-limpiar"
          onClick={cargarDatos}
          disabled={actualizando}
        >
          {actualizando ? "⏳ Actualizando..." : "🔄 Actualizar resultados"}
        </button>
      </div>
      {error && <p className="formulario-error">{error}</p>}

      <h4>Números atrasados ({atrasados.length})</h4>
      <div className="perm-scroll perm-scroll-cron">
        <table className="tabla-permutantes tabla-cron">
          <thead>{encabezado}</thead>
          <tbody>{atrasados.map(fila)}</tbody>
        </table>
      </div>
      {atrasados.length > 0 && (
        <p className="perm-seleccion-copiar">
          {atrasados.map((t) => t.combinacion).join(" ")}
        </p>
      )}

      <div className="perm-filtros">
        <h4 style={{ margin: 0 }}>Todos los números (000-999)</h4>
        <label>
          Ordenar por:
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="numero">Número</option>
            <option value="cantidad">Veces que ha caído</option>
            <option value="promedio">Promedio entre caídas (menor primero)</option>
            <option value="sinCaer">Días sin caer</option>
            <option value="veces">× su promedio (más atrasado)</option>
            <option value="cv">Regularidad (más regular primero)</option>
          </select>
        </label>
      </div>
      <div className="perm-scroll perm-scroll-cron">
        <table className="tabla-permutantes tabla-cron">
          <thead>{encabezado}</thead>
          <tbody>{todos.map(fila)}</tbody>
        </table>
      </div>
    </div>
  );
}