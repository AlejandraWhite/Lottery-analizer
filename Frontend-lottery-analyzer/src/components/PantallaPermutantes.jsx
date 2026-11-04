import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes, obtenerFechasCombinaciones4 } from "../api";
import { terminosBusqueda } from "../utils";
import "./PantallaPermutantes.css";

// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 24; // 4! = máximo de permutaciones distintas
const MS_DIA = 86400000;

// Tipos de grupo según los dígitos repetidos (suman los 715 grupos)
const TIPOS = [
  { id: "diferentes", nombre: "Todos diferentes (ej: 1234)", posibles: 5040, meta: 100 },
  { id: "par", nombre: "Un dígito repetido 2 veces (ej: 1123)", posibles: 4320, meta: 40 },
  { id: "dospares", nombre: "Dos pares (ej: 1122)", posibles: 270, meta: 10 },
  { id: "trio", nombre: "Tres iguales (ej: 1112)", posibles: 360, meta: 10 },
  { id: "cuatro", nombre: "Cuatro iguales (ej: 1111)", posibles: 10, meta: 2 },
];

function clasificar(digitos) {
  const conteo = {};
  digitos.forEach((d) => (conteo[d] = (conteo[d] || 0) + 1));
  const patron = Object.values(conteo)
    .sort((a, b) => b - a)
    .join("");
  return { 1111: "diferentes", 211: "par", 22: "dospares", 31: "trio", 4: "cuatro" }[patron];
}

function generarGrupos() {
  const grupos = [];
  for (let a = 1; a <= 10; a++)
    for (let b = a; b <= 10; b++)
      for (let c = b; c <= 10; c++)
        for (let d = c; d <= 10; d++) {
          grupos.push([a, b, c, d].map((v) => v % 10)); // 10 -> 0
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
    for (let i = 0; i < 4; i++) {
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

  return { fechas, cantidadFechas: cantidad, promedio, min, max, cv, diasSinCaer, atraso, veces };
}

export default function PantallaPermutantes({ busqueda, busquedaFecha, modoBusqueda = "cualquiera" }) {
  const [conteos, setConteos] = useState({});
  const [ultimasFechas, setUltimasFechas] = useState({});
  const [fechas, setFechas] = useState({}); // todas las fechas de cada número 0000-9999
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [filtroCantidad, setFiltroCantidad] = useState("");
  const [orden, setOrden] = useState("grupo");
  const [diasReciente, setDiasReciente] = useState(30);
  const [metas, setMetas] = useState(() =>
    Object.fromEntries(TIPOS.map((t) => [t.id, t.meta]))
  );
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([obtenerConteosPermutantes(), obtenerFechasCombinaciones4()])
      .then(([data, f]) => {
        setFechas(f.fechas || {});
        setConteos(data.conteos);
        setUltimasFechas(data.ultimas_fechas || {});
        setTotalHistorico(data.total);
        setError("");
      })
      .catch((e) => setError(e.message));
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
          tipo: clasificar(digitos),
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

  // Coincidencia a nivel de fila (grupo)
  const coincideBusqueda = (g) => {
    const porFecha = fechaCoincide(g.ultimaFecha);

    // En modo "últimas cifras" la fila NO se pinta por dígitos:
    // solo se marcan las celdas (combinaciones) que terminan en lo buscado.
    const porDigitos =
      terminos.length > 0 && !ultimasCifras && grupoCoincide(g.digitos, terminos);

    return porDigitos || porFecha;
  };

  // Grupos con al menos una combinación que termina en alguno de los términos
  const grupoTieneFinal = (g) =>
    terminos.length > 0 &&
    g.permutaciones.some((p) => terminos.some((t) => p.endsWith(t)));

  const totalBusqueda =
    terminos.length > 0 || terminosFecha.length > 0
      ? visibles.filter(
          (g) => coincideBusqueda(g) || (ultimasCifras && grupoTieneFinal(g))
        ).length
      : 0;

  const coincideCantidad = (cantidad) =>
    filtroCantidad !== "" && cantidad === Number(filtroCantidad);

  // Solo en modo "últimas cifras": la combinación termina en alguno de los términos
  const terminaEnBusqueda = (combinacion) =>
    ultimasCifras &&
    terminos.length > 0 &&
    Boolean(combinacion) &&
    terminos.some((t) => combinacion.endsWith(t));

  const totalCoinciden =
    filtroCantidad === ""
      ? 0
      : visibles.filter((g) => g.cantidad === Number(filtroCantidad)).length;

  // Suma de todas las veces que ha caído cada grupo
  const totalCantidad = useMemo(
    () => grupos.reduce((s, g) => s + g.cantidad, 0),
    [grupos]
  );

  const porcentaje = (cantidad, dec = 3) =>
    totalCantidad > 0 ? `${((cantidad / totalCantidad) * 100).toFixed(dec)}%` : "0%";

  // ============ INTERVALOS Y ATRASADOS DE LOS 715 GRUPOS ============
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
      case "ultima": // cayó hace más tiempo primero (los que nunca han caído al final)
        return copia.sort((a, b) => {
          if (!a.ultimaFecha && !b.ultimaFecha) return a.etiqueta.localeCompare(b.etiqueta);
          if (!a.ultimaFecha) return 1;
          if (!b.ultimaFecha) return -1;
          return a.ultimaFecha.localeCompare(b.ultimaFecha) || a.etiqueta.localeCompare(b.etiqueta);
        });
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

  // Resumen: veces y % real vs % esperado por tipo
  const resumenTipos = useMemo(
    () =>
      TIPOS.map((t) => {
        const delTipo = grupos.filter((g) => g.tipo === t.id);
        return {
          ...t,
          grupos: delTipo.length,
          cantidad: delTipo.reduce((s, g) => s + g.cantidad, 0),
        };
      }),
    [grupos]
  );

  // Selección por tipo: los que más caen primero, sin los que cayeron
  // dentro del intervalo de días indicado
  const seleccion = useMemo(() => {
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - (Number(diasReciente) || 0));

    const cayoReciente = (iso) => {
      if (!iso) return false; // nunca ha caído: no es reciente
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d) >= limite;
    };

    // Más veces primero; si empatan, el que cayó hace más tiempo
    const ordenar = (a, b) =>
      b.cantidad - a.cantidad ||
      (a.ultimaFecha || "").localeCompare(b.ultimaFecha || "") ||
      a.etiqueta.localeCompare(b.etiqueta);

    return Object.fromEntries(
      TIPOS.map((t) => [
        t.id,
        grupos
          .filter((g) => g.tipo === t.id && !cayoReciente(g.ultimaFecha))
          .sort(ordenar)
          .slice(0, Number(metas[t.id]) || 0),
      ])
    );
  }, [grupos, diasReciente, metas]);

  const todosLosElegidos = TIPOS.flatMap((t) => seleccion[t.id]);

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
        Permutantes de 4 cifras ({grupos.length})
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

      {/* ============ INTERVALOS Y ATRASADOS (715 GRUPOS) ============ */}
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
            <option value="cantidad">Veces que ha caído</option>
            <option value="ultima">Última vez (más antigua primero)</option>
            <option value="promedio">Promedio entre caídas (menor primero)</option>
            <option value="sinCaer">Días sin caer (cronologico)</option>
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

      {/* ============ ZONA INFERIOR ============ */}
      <div className="perm-inferior">
        {/* % por tipo de repetición */}
        <div className="perm-scroll perm-resumen-tipos">
          <table className="tabla-permutantes">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Grupos</th>
                <th>Veces</th>
                <th>% real</th>
                <th>% esperado</th>
              </tr>
            </thead>
            <tbody>
              {resumenTipos.map((t) => (
                <tr key={t.id}>
                  <td>{t.nombre}</td>
                  <td className="perm-cantidad">{t.grupos}</td>
                  <td className="perm-cantidad">{t.cantidad.toLocaleString()}</td>
                  <td className="perm-porcentaje">{porcentaje(t.cantidad, 2)}</td>
                  <td className="perm-porcentaje">{(t.posibles / 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="perm-cantidad">{grupos.length}</td>
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