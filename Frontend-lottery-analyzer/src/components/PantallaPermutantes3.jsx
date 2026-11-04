import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes3, obtenerFechasCombinaciones3 } from "../api";
import { terminosBusqueda } from "../utils";
import "./PantallaPermutantes.css"; // mismos estilos que la de 4 cifras


const CIFRAS = 3;
// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 6; // 3! = máximo de permutaciones distintas
const MS_DIA = 86400000;

// Todos los grupos de 3 dígitos sin importar el orden: 220 en total
function generarGrupos() {
  const grupos = [];
  for (let a = 1; a <= 10; a++)
    for (let b = a; b <= 10; b++)
      for (let c = b; c <= 10; c++) {
        grupos.push([a, b, c].map((v) => v % 10)); // 10 -> 0
      }
  return grupos;
}

function formatoFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const aDias = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DIA);
};

const entero = (v) => (v == null ? "—" : Math.round(v).toLocaleString());
const decimal = (v) => (v == null ? "—" : v.toFixed(1));

function permutacionesUnicas(digitos) {
  const resultado = new Set();
  const usar = (resto, actual) => {
    if (resto.length === 0) {
      resultado.add(actual.join(""));
      return;
    }
    resto.forEach((d, i) => {
      usar([...resto.slice(0, i), ...resto.slice(i + 1)], [...actual, d]);
    });
  };
  usar(digitos, []);
  return [...resultado].sort((x, y) => {
    for (let i = 0; i < CIFRAS; i++) {
      const diff = valor(Number(x[i])) - valor(Number(y[i]));
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

// Un grupo coincide con un término si contiene todos sus dígitos
function grupoCoincideUno(digitos, termino) {
  const disponibles = [...digitos];
  for (const ch of termino) {
    const idx = disponibles.indexOf(Number(ch));
    if (idx === -1) return false;
    disponibles.splice(idx, 1);
  }
  return true;
}

// Coincide si cumple CUALQUIERA de los términos
function grupoCoincide(digitos, terminos) {
  return terminos.some((t) => grupoCoincideUno(digitos, t));
}

// Estadísticas de intervalos a partir de una lista de fechas (ISO, cualquier orden)
function statsDeFechas(listaFechas, hoy) {
  const fechas = [...listaFechas].sort();
  const dias = fechas.map(aDias);
  const gaps = [];
  for (let i = 1; i < dias.length; i++) gaps.push(dias[i] - dias[i - 1]);

  const cantidad = fechas.length;
  const ultimaFecha = cantidad ? fechas[cantidad - 1] : null;
  const promedio = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;
  const min = gaps.length ? Math.min(...gaps) : null;
  const max = gaps.length ? Math.max(...gaps) : null;
  let cv = null;
  if (promedio) {
    const varianza = gaps.reduce((s, g) => s + (g - promedio) ** 2, 0) / gaps.length;
    cv = Math.sqrt(varianza) / promedio;
  }
  const diasSinCaer = cantidad ? hoy - dias[cantidad - 1] : null;
  const atraso = diasSinCaer != null && promedio != null ? diasSinCaer - promedio : null;
  const veces = diasSinCaer != null && promedio ? diasSinCaer / promedio : null;

  return { fechas, gaps, cantidad, ultimaFecha, promedio, min, max, cv, diasSinCaer, atraso, veces };
}

export default function PantallaPermutantes3({ busqueda, busquedaFecha, modoBusqueda = "cualquiera" }) {
  const [conteos, setConteos] = useState({});
  const [ultimasFechas, setUltimasFechas] = useState({});
  const [fechas, setFechas] = useState({}); // todas las fechas de cada número 000-999
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [filtroCantidad, setFiltroCantidad] = useState("");
  const [orden, setOrden] = useState("grupo");
  const [error, setError] = useState("");

  // Carga los resultados desde el servidor
  const cargarDatos = async () => {
    try {
      const [data, f] = await Promise.all([
        obtenerConteosPermutantes3(),
        obtenerFechasCombinaciones3(),
      ]);
      setFechas(f.fechas || {});
      setConteos(data.conteos);
      setUltimasFechas(data.ultimas_fechas || {});
      setTotalHistorico(data.total);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const grupos = useMemo(
    () =>
      generarGrupos().map((digitos) => {
        const permutaciones = permutacionesUnicas(digitos);
        const cantidad = permutaciones.reduce((s, p) => s + (conteos[p] || 0), 0);

        // Permutación que cayó más recientemente y su fecha
        let ultimaFecha = null;
        let ultimaCombinacion = null;
        for (const p of permutaciones) {
          const f = ultimasFechas[p];
          if (f && (!ultimaFecha || f > ultimaFecha)) {
            ultimaFecha = f;
            ultimaCombinacion = p;
          }
        }

        return {
          digitos,
          etiqueta: digitos.join(""),
          permutaciones,
          cantidad,
          ultimaFecha,
          ultimaCombinacion,
        };
      }),
    [conteos, ultimasFechas]
  );

  const visibles = grupos;

  const ultimasCifras = modoBusqueda === "ultimas2";

  const terminos = terminosBusqueda(busqueda);
  const terminosFecha = terminosBusqueda(busquedaFecha);

  const fechaCoincide = (iso) => {
    if (terminosFecha.length === 0 || !iso) return false;
    const f = formatoFecha(iso);
    return terminosFecha.some((t) => f.includes(t));
  };

  const coincideBusqueda = (g) => {
    const porFecha = fechaCoincide(g.ultimaFecha);
    const porDigitos =
      terminos.length > 0 && !ultimasCifras && grupoCoincide(g.digitos, terminos);
    return porDigitos || porFecha;
  };

  const grupoTieneFinal = (g) =>
    terminos.length > 0 &&
    g.permutaciones.some((p) => terminos.some((t) => p.endsWith(t)));

  const totalBusqueda =
    terminos.length > 0 || terminosFecha.length > 0
      ? visibles.filter(
          (g) => coincideBusqueda(g) || (ultimasCifras && grupoTieneFinal(g))
        ).length
      : 0;

  const terminaEnBusqueda = (combinacion) =>
    ultimasCifras &&
    terminos.length > 0 &&
    Boolean(combinacion) &&
    terminos.some((t) => combinacion.endsWith(t));

  // Filtro por cantidad (local, no viene de utils)
  const coincideCantidad = (cantidad) =>
    filtroCantidad !== "" && cantidad === Number(filtroCantidad);

  const totalCoinciden =
    filtroCantidad === ""
      ? 0
      : visibles.filter((g) => g.cantidad === Number(filtroCantidad)).length;

  // Las 1000 combinaciones exactas (000 a 999) con su cantidad
  const todas = useMemo(
    () =>
      Array.from({ length: 1000 }, (_, i) => {
        const combinacion = String(i).padStart(3, "0");
        return { combinacion, cantidad: conteos[combinacion] || 0 };
      }),
    [conteos]
  );

  // Suma de todas las veces que ha caído cada combinación 000-999
  const totalCantidad = useMemo(
    () => todas.reduce((s, t) => s + t.cantidad, 0),
    [todas]
  );

  // ============ INTERVALOS Y ATRASADOS DE LOS 220 GRUPOS ============
  // Las fechas de un grupo son las de todas sus permutaciones juntas.
  const statsGrupos = useMemo(() => {
    const hoy = Math.floor(Date.now() / MS_DIA);
    return grupos.map((g) => {
      const fs = g.permutaciones.flatMap((p) => fechas[p] || []);
      return { ...g, ...statsDeFechas(fs, hoy) };
    });
  }, [grupos, fechas]);

  const tablaIntervalos = useMemo(() => {
    const copia = [...statsGrupos];
    const nulosAlFinal = (campo, desc) => (a, b) => {
      const x = a[campo], y = b[campo];
      if (x == null && y == null) return a.etiqueta.localeCompare(b.etiqueta);
      if (x == null) return 1;
      if (y == null) return -1;
      return (desc ? y - x : x - y) || a.etiqueta.localeCompare(b.etiqueta);
    };
    switch (orden) {
      case "cantidad": return copia.sort(nulosAlFinal("cantidad", true));
      case "promedio": return copia.sort(nulosAlFinal("promedio", false));
      case "veces": return copia.sort(nulosAlFinal("veces", true));
      case "sinCaer": return copia.sort(nulosAlFinal("diasSinCaer", true));
      case "cv": return copia.sort(nulosAlFinal("cv", false));
      default: return copia; // orden natural de los grupos
    }
  }, [statsGrupos, orden]);

  const promedioGlobal = useMemo(() => {
    const con = statsGrupos.filter((t) => t.promedio != null);
    return con.length ? con.reduce((s, t) => s + t.promedio, 0) / con.length : null;
  }, [statsGrupos]);

  const nuncaHanCaido = statsGrupos.filter((t) => t.cantidad === 0).length;

  const coincideBusquedaIntervalos = (g) =>
    coincideBusqueda(g) ||
    g.fechas.some(fechaCoincide) ||
    (ultimasCifras && grupoTieneFinal(g));

  const porcentaje = (cantidad) =>
    totalCantidad > 0 ? `${((cantidad / totalCantidad) * 100).toFixed(3)}%` : "0%";

  // Clasifica cada combinación 000-999 según sus dígitos repetidos
  const tiposRepeticion = useMemo(() => {
    const tipos = [
      { nombre: "Todos diferentes (ej: 123)", posibles: 720, cantidad: 0 },
      { nombre: "Un dígito repetido 2 veces (ej: 112)", posibles: 270, cantidad: 0 },
      { nombre: "Pacha, tres iguales (ej: 111)", posibles: 10, cantidad: 0 },
    ];
    for (const t of todas) {
      const distintos = new Set(t.combinacion).size; // 3, 2 o 1
      const idx = distintos === 3 ? 0 : distintos === 2 ? 1 : 2;
      tipos[idx].cantidad += t.cantidad;
    }
    return tipos;
  }, [todas]);

  const columnasPerm = Array.from({ length: MAX_PERMUTACIONES });

  return (
    <div className="permutantes">
      {/* Columnas angostas para la tabla de intervalos de grupos */}
      <style>{`
        .tabla-intervalos-grupos th,
        .tabla-intervalos-grupos td {
          padding: 4px 6px;
          font-size: 0.85rem;
        }
        .tabla-intervalos-grupos th.col-ang,
        .tabla-intervalos-grupos td.col-ang {
          width: 56px;
          min-width: 0;
          max-width: 64px;
          text-align: center;
          white-space: normal;
          line-height: 1.1;
        }
        .tabla-intervalos-grupos th.col-perm,
        .tabla-intervalos-grupos td.col-perm {
          width: 60px;
          min-width: 0;
          max-width: 70px;
          text-align: center;
          white-space: nowrap;
        }
      `}</style>

      <h3>
        Permutantes de 3 cifras ({grupos.length})
        {(terminos.length > 0 || terminosFecha.length > 0) && ` · ${totalBusqueda} coinciden`}
      </h3>
      <p>
        Cantidad de veces que ha caído cada grupo y cuándo cayó por última vez. Basado en{" "}
        {totalHistorico.toLocaleString()} números del histórico.
      </p>
      <div className="perm-filtros">
        <label>
          Cantidad:
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Ej: 5"
            value={filtroCantidad}
            onChange={(e) => setFiltroCantidad(e.target.value)}
          />
        </label>
        {filtroCantidad !== "" && (
          <button type="button" className="perm-limpiar" onClick={() => setFiltroCantidad("")}>
            ✕ Limpiar
          </button>
        )}
        {filtroCantidad !== "" && (
          <span className="perm-contador">{totalCoinciden} coinciden</span>
        )}
      </div>
      {error && <p className="formulario-error">{error}</p>}

      {/* ============ INTERVALOS Y ATRASADOS (220 GRUPOS) ============ */}
      <h4>Intervalos y grupos atrasados ({grupos.length})</h4>
      <p>
        Para cada grupo: cuántas veces ha caído (cualquiera de sus permutaciones) y cada
        cuántos días cae en promedio. Promedio general entre caídas: {entero(promedioGlobal)}{" "}
        días · Nunca han caído: {nuncaHanCaido}
      </p>
      <div className="perm-filtros">
        <label>
          Ordenar por:
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="grupo">Grupo</option>
            <option value="cantidad">Veces que ha caído (cronologico)</option>
            <option value="promedio">Promedio entre caídas (menor primero)</option>
            <option value="sinCaer">Días sin caer</option>
            <option value="veces">× su promedio (más atrasado)</option>
            <option value="cv">Regularidad (más regular primero)</option>
          </select>
        </label>
      </div>
      <div className="perm-scroll perm-scroll-cron">
        <table className="tabla-permutantes tabla-cron tabla-intervalos-grupos">
          <thead>
            <tr>
              <th className="col-ang">#</th>
              <th className="col-ang">Grupo</th>
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
              {columnasPerm.map((_, i) => (
                <th
                  key={i}
                  className="col-perm"
                  title="Número que cayó de este grupo y las veces que cayó"
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tablaIntervalos.map((g, i) => (
              <tr
                key={g.etiqueta}
                className={`${coincideBusquedaIntervalos(g) ? "fila-busqueda" : ""} ${
                  coincideCantidad(g.cantidad) ? "fila-cantidad" : ""
                }`}
              >
                <td className="col-ang">{i + 1}</td>
                <td className="col-ang perm-grupo-cron">
                  <strong>{g.etiqueta}</strong>
                </td>
                <td className="col-ang perm-cantidad">{g.cantidad}</td>
                <td className="col-ang">{entero(g.promedio)}</td>
                <td className="col-ang">{entero(g.min)}</td>
                <td className="col-ang">{entero(g.max)}</td>
                <td className="col-ang">{decimal(g.cv)}</td>
                <td>{g.ultimaFecha ? formatoFecha(g.ultimaFecha) : "Nunca"}</td>
                <td className="col-ang">{entero(g.diasSinCaer)}</td>
                <td className="col-ang">{entero(g.atraso)}</td>
                <td className="col-ang perm-porcentaje">
                  {g.veces != null ? `${g.veces.toFixed(2)}×` : "—"}
                </td>
                {columnasPerm.map((_, j) => {
                  const p = g.permutaciones[j];
                  return (
                    <td
                      key={j}
                      className={`col-perm ${p ? "perm-celda" : "perm-celda perm-vacia"}${
                        terminaEnBusqueda(p) ? " celda-final" : ""
                      }`}
                    >
                      {p ?? ""}
                      {p && <span className="perm-veces">{conteos[p] || 0}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="perm-cantidad">{totalCantidad.toLocaleString()}</td>
              <td colSpan={8 + MAX_PERMUTACIONES}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ============ RESUMEN POR TIPO DE REPETICIÓN ============ */}
      <div className="perm-inferior">
        <div className="perm-scroll perm-resumen-tipos">
          <table className="tabla-permutantes">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Veces</th>
                <th>% real</th>
                <th>% esperado</th>
              </tr>
            </thead>
            <tbody>
              {tiposRepeticion.map((t) => (
                <tr key={t.nombre}>
                  <td>{t.nombre}</td>
                  <td className="perm-cantidad">{t.cantidad.toLocaleString()}</td>
                  <td className="perm-porcentaje">{porcentaje(t.cantidad)}</td>
                  <td className="perm-porcentaje">
                    {((t.posibles / 1000) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="perm-cantidad">{totalCantidad.toLocaleString()}</td>
                <td className="perm-porcentaje">100%</td>
                <td className="perm-porcentaje">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}