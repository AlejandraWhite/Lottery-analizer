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
      <th className="col-ang">#</th>
      <th className="col-ang">Número</th>
      <th className="col-ang">Veces</th>
      <th className="col-ang" title="Promedio de días entre caídas">Prom. días</th>
      <th className="col-ang">Mín</th>
      <th className="col-ang">Máx</th>
      <th
        className="col-ang"
        title="Desviación / promedio. Cerca de 0 = muy regular; cerca de 1 = comportamiento aleatorio"
      >
        Regul.
      </th>
      <th>Última vez</th>
      <th className="col-ang">Días sin caer</th>
      <th className="col-ang" title="Días sin caer menos su promedio">Atraso</th>
      <th className="col-ang" title="Días sin caer / su promedio">× prom.</th>
      <th title="De la más antigua a la más reciente. Entre paréntesis: días desde la caída anterior">
        Todas las veces que cayó (antigua → reciente)
      </th>
    </tr>
  );

  const fila = (t, i) => (
    <tr key={t.combinacion} className={coincideBusqueda(t) ? "fila-busqueda" : ""}>
      <td className="col-ang">{i + 1}</td>
      <td className="col-ang perm-grupo-cron">
        <strong>{t.combinacion}</strong>
      </td>
      <td className="col-ang perm-cantidad">{t.cantidad}</td>
      <td className="col-ang">{entero(t.promedio)}</td>
      <td className="col-ang">{entero(t.min)}</td>
      <td className="col-ang">{entero(t.max)}</td>
      <td className="col-ang">{decimal(t.cv)}</td>
      <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
      <td className="col-ang">{entero(t.diasSinCaer)}</td>
      <td className="col-ang">{entero(t.atraso)}</td>
      <td className="col-ang perm-porcentaje">
        {t.veces != null ? `${t.veces.toFixed(2)}×` : "—"}
      </td>
      <td className="col-fechas">
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
      {/* Columnas angostas */}
      <style>{`
        .tabla-intervalos-3 th,
        .tabla-intervalos-3 td {
          padding: 4px 6px;
          font-size: 0.85rem;
        }
        .tabla-intervalos-3 th.col-ang,
        .tabla-intervalos-3 td.col-ang {
          width: 56px;
          min-width: 0;
          max-width: 64px;
          text-align: center;
          white-space: normal;
          line-height: 1.1;
        }
        .tabla-intervalos-3 td.col-fechas {
          min-width: 380px;
          white-space: normal;
          text-align: left;
        }
      `}</style>

      <h3>
        Intervalos y números atrasados (3 cifras)
        {hayBusqueda && ` · ${stats.filter(coincideBusqueda).length} coinciden`}
      </h3>
      <p>
        Para cada número 000-999: cuántas veces ha caído y cada cuántos días cae en promedio.
        Basado en {totalHistorico.toLocaleString()} números del histórico. Promedio general
        entre caídas: {entero(promedioGlobal)} días · Nunca han caído: {nuncaHanCaido}
      </p>

      {error && <p className="formulario-error">{error}</p>}


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
        <table className="tabla-permutantes tabla-cron tabla-intervalos-3">
          <thead>{encabezado}</thead>
          <tbody>{todos.map(fila)}</tbody>
        </table>
      </div>
    </div>
  );
}