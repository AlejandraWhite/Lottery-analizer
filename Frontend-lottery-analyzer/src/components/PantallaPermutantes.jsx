import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes } from "../api";
import "./PantallaPermutantes.css";

// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 24; // 4! = máximo de permutaciones distintas

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

function grupoCoincide(digitos, busqueda) {
  if (!busqueda) return true;
  const disponibles = [...digitos];
  for (const ch of busqueda) {
    const idx = disponibles.indexOf(Number(ch));
    if (idx === -1) return false;
    disponibles.splice(idx, 1);
  }
  return true;
}

export default function PantallaPermutantes({ busqueda, busquedaFecha }) {
  const [conteos, setConteos] = useState({});
  const [ultimasFechas, setUltimasFechas] = useState({});
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [filtroCantidad, setFiltroCantidad] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerConteosPermutantes()
      .then((data) => {
        setConteos(data.conteos);
        setUltimasFechas(data.ultimas_fechas || {});
        setTotalHistorico(data.total);
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
        permutaciones,
        cantidad,
        ultimaFecha,
        ultimaCombinacion,
      };
    }),
  [conteos, ultimasFechas]
);

const visibles = grupos;

// Coincide por dígitos o por fecha (última vez que cayó el grupo)
const coincideBusqueda = (g) =>
  (Boolean(busqueda) && grupoCoincide(g.digitos, busqueda)) ||
  (Boolean(busquedaFecha) && formatoFecha(g.ultimaFecha).includes(busquedaFecha));

const totalBusqueda =
  busqueda || busquedaFecha ? visibles.filter(coincideBusqueda).length : 0;

const coincideCantidad = (cantidad) =>
  filtroCantidad !== "" && cantidad === Number(filtroCantidad);

const totalCoinciden =
  filtroCantidad === ""
    ? 0
    : visibles.filter((g) => g.cantidad === Number(filtroCantidad)).length;

  // Del que cayó hace más tiempo al más reciente (los que nunca han caído no aparecen)
  const cronologicos = useMemo(
    () =>
      visibles
        .filter((g) => g.ultimaFecha)
        .sort((a, b) => a.ultimaFecha.localeCompare(b.ultimaFecha)),
    [visibles]
  );

 const columnasPerm = Array.from({ length: MAX_PERMUTACIONES });

  return (
    <div className="permutantes">
      <h3>
  Permutantes de 4 cifras ({grupos.length})
  {(busqueda || busquedaFecha) && ` · ${totalBusqueda} coinciden`}
</h3>
      <p>
        Ordenados de menor a mayor, con el 0 como el mayor. Basado en{" "}
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
     
        {/* ============ GRUPO 1: CRONOLÓGICO ============ */}
        <div className="perm-scroll perm-scroll-cron">
          <table className="tabla-permutantes tabla-cron">
            <thead>
              <tr>
                <th className="sticky-1">#</th>
                <th>Grupo (cronológico)</th>
                <th>Cantidad</th>
                <th>Cayó como</th>
              </tr>
            </thead>
            <tbody>
              {cronologicos.map((c, i) => (
  <tr
  key={c.etiqueta}
  className={`${coincideBusqueda(c) ? "fila-busqueda" : ""} ${
    coincideCantidad(c.cantidad) ? "fila-cantidad" : ""
  }`}
>
    <td className="sticky-1">{i + 1}</td>
    <td className="perm-grupo-cron">
      <strong>{c.etiqueta}</strong>{" "}
      <span className="perm-veces">{formatoFecha(c.ultimaFecha)}</span>
    </td>
    <td className="perm-cantidad">{c.cantidad}</td>
    <td className="perm-ultima-comb">{c.ultimaCombinacion}</td>
  </tr>
))}
            </tbody>
          </table>
        </div>

        {/* ============ GRUPO 2: ORDEN NORMAL + COMBINACIONES ============ */}
        <div className="perm-scroll perm-scroll-normal">
          <table className="tabla-permutantes tabla-normal">
            <thead>
  <tr>
    <th className="sticky-1">#</th>
    <th className="sticky-2">Grupo</th>
    <th className="sticky-3">Cantidad</th>
    <th className="sticky-4">Combinaciones</th>
    {columnasPerm.map((_, i) => (
      <th key={i}>{i + 1}</th>
    ))}
  </tr>
</thead>
           <tbody>
  {visibles.map((g, i) => (
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
      {columnasPerm.map((_, j) => {
        const p = g.permutaciones[j];
        return (
          <td key={j} className={p ? "perm-celda" : "perm-celda perm-vacia"}>
            {p ?? ""}
            {p && <span className="perm-veces">{conteos[p] || 0}</span>}
          </td>
        );
      })}
    </tr>
  ))}
</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}