import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes3, obtenerFechasCombinaciones3 } from "../api";
import { terminosBusqueda } from "../utils";
import "./PantallaPermutantes.css"; // mismos estilos que la de 4 cifras


const CIFRAS = 3;
// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 6; // 3! = máximo de permutaciones distintas

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

export default function PantallaPermutantes3({ busqueda, busquedaFecha, modoBusqueda = "cualquiera" }) {
  const [conteos, setConteos] = useState({});
  const [ultimasFechas, setUltimasFechas] = useState({});
  const [fechas, setFechas] = useState({}); // todas las fechas de cada número 000-999
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [filtroCantidad, setFiltroCantidad] = useState("");
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

  // Del que más cae al que menos cae
  const porFrecuencia = useMemo(
    () =>
      [...visibles].sort((a, b) => {
        if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
        return a.etiqueta.localeCompare(b.etiqueta);
      }),
    [visibles]
  );

  // Las 1000 combinaciones exactas (000 a 999), de la que cayó hace más
  // tiempo a la más reciente. Las que nunca han caído van al final.
  const todas = useMemo(
    () =>
      Array.from({ length: 1000 }, (_, i) => {
        const combinacion = String(i).padStart(3, "0");
        const fs = fechas[combinacion] || []; // vienen en orden ascendente
        const n = fs.length;
        return {
          combinacion,
          cantidad: conteos[combinacion] || 0,
          ultimaFecha: fs[n - 1] || ultimasFechas[combinacion] || null,
          penultimaFecha: fs[n - 2] || null,
          antepenultimaFecha: fs[n - 3] || null,
        };
      }).sort((a, b) => {
        if (a.ultimaFecha && b.ultimaFecha) {
          if (a.ultimaFecha !== b.ultimaFecha)
            return a.ultimaFecha.localeCompare(b.ultimaFecha); // más antigua primero
          return a.combinacion.localeCompare(b.combinacion); // mismo día: por número
        }
        if (a.ultimaFecha) return -1; // las que sí han caído primero
        if (b.ultimaFecha) return 1;
        return a.combinacion.localeCompare(b.combinacion); // nunca han caído
      }),
    [conteos, ultimasFechas, fechas]
  );

  // Las mismas 1000 combinaciones, del que más cae al que menos cae
  const todasPorFrecuencia = useMemo(
    () =>
      [...todas].sort((a, b) => {
        if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
        return a.combinacion.localeCompare(b.combinacion); // desempate estable
      }),
    [todas]
  );

  // Suma de todas las veces que ha caído cada combinación 000-999
  const totalCantidad = useMemo(
    () => todas.reduce((s, t) => s + t.cantidad, 0),
    [todas]
  );

  const porcentaje = (cantidad) =>
    totalCantidad > 0 ? `${((cantidad / totalCantidad) * 100).toFixed(3)}%` : "0%";

  const coincideBusquedaTodas = (t) => {
    const porFecha = fechaCoincide(t.ultimaFecha);
    const porNumero =
      terminos.length > 0 &&
      terminos.some((x) =>
        ultimasCifras ? t.combinacion.endsWith(x) : t.combinacion.includes(x)
      );
    return porNumero || porFecha;
  };

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

      <div className="permutantes-dos-grupos">

        {/* ============ TODAS LAS COMBINACIONES 000-999 ============ */}
        <div className="perm-scroll perm-scroll-cron">
          <table className="tabla-permutantes tabla-cron">
            <thead>
              <tr>
                <th className="sticky-1">#</th>
                <th>Combinación</th>
                <th>Última vez</th>
                <th>Penúltima</th>
                <th>Antepenúltima</th>
                <th>Cantidad</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {todas.map((t, i) => (
                <tr
                  key={t.combinacion}
                  className={`${coincideBusquedaTodas(t) ? "fila-busqueda" : ""} ${
                    coincideCantidad(t.cantidad) ? "fila-cantidad" : ""
                  }`}
                >
                  <td className="sticky-1">{i + 1}</td>
                  <td className="perm-grupo-cron">
                    <strong>{t.combinacion}</strong>
                  </td>
                  <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
                  <td>{t.penultimaFecha ? formatoFecha(t.penultimaFecha) : "—"}</td>
                  <td>{t.antepenultimaFecha ? formatoFecha(t.antepenultimaFecha) : "—"}</td>
                  <td className="perm-cantidad">{t.cantidad}</td>
                  <td className="perm-porcentaje">{porcentaje(t.cantidad)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total</td>
                <td className="perm-cantidad">{totalCantidad.toLocaleString()}</td>
                <td className="perm-porcentaje">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ============ TODAS 000-999: DEL QUE MÁS CAE AL QUE MENOS CAE ============ */}
        <div className="perm-scroll perm-scroll-cron">
          <table className="tabla-permutantes tabla-cron">
            <thead>
              <tr>
                <th className="sticky-1">#</th>
                <th>Combinación</th>
                <th>Cantidad</th>
                <th>%</th>
                <th>Última vez</th>
                <th>Penúltima</th>
                <th>Antepenúltima</th>
              </tr>
            </thead>
            <tbody>
              {todasPorFrecuencia.map((t, i) => (
                <tr
                  key={t.combinacion}
                  className={`${coincideBusquedaTodas(t) ? "fila-busqueda" : ""} ${
                    coincideCantidad(t.cantidad) ? "fila-cantidad" : ""
                  }`}
                >
                  <td className="sticky-1">{i + 1}</td>
                  <td className="perm-grupo-cron">
                    <strong>{t.combinacion}</strong>
                  </td>
                  <td className="perm-cantidad">{t.cantidad}</td>
                  <td className="perm-porcentaje">{porcentaje(t.cantidad)}</td>
                  <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
                  <td>{t.penultimaFecha ? formatoFecha(t.penultimaFecha) : "—"}</td>
                  <td>{t.antepenultimaFecha ? formatoFecha(t.antepenultimaFecha) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="perm-cantidad">{totalCantidad.toLocaleString()}</td>
                <td className="perm-porcentaje">100%</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ============ ZONA INFERIOR ============ */}
      <div className="perm-inferior">
        {/* Resumen por tipo de repetición */}
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

      {/* ============ GRUPOS Y SUS COMBINACIONES (abajo) ============ */}
      <div className="perm-grupos-abajo">
        <h4>Grupos y sus combinaciones</h4>
        {/* ============ POR FRECUENCIA + COMBINACIONES ============ */}
        <div className="perm-scroll perm-scroll-normal">
          <table className="tabla-permutantes tabla-normal">
            <thead>
              <tr>
                <th className="sticky-1">#</th>
                <th className="sticky-2">Grupo</th>
                <th className="sticky-3">Cantidad</th>
                <th className="sticky-4">Combinaciones</th>
                <th>%</th>
                {columnasPerm.map((_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porFrecuencia.map((g, i) => (
                <tr
                  key={g.etiqueta}
                  className={`${coincideBusqueda(g) ? "fila-busqueda" : ""} ${
                    coincideCantidad(g.cantidad) ? "fila-cantidad" : ""
                  }`}
                >
                  <td className="sticky-1">{i + 1}</td>
                  <td className="sticky-2 perm-grupo">{g.etiqueta}</td>
                  <td className="sticky-3 perm-cantidad">{g.cantidad}</td>
                  <td className="sticky-4">{g.permutaciones.length}</td>
                  <td className="perm-porcentaje">{porcentaje(g.cantidad)}</td>
                  {columnasPerm.map((_, j) => {
                    const p = g.permutaciones[j];
                    return (
                      <td
                        key={j}
                        className={`${p ? "perm-celda" : "perm-celda perm-vacia"}${
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
                <td></td>
                <td className="perm-porcentaje">100%</td>
                <td colSpan={MAX_PERMUTACIONES}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}