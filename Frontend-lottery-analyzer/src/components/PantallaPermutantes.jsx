import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes } from "../api";
import { terminosBusqueda } from "../utils";
import "./PantallaPermutantes.css";

// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 24; // 4! = máximo de permutaciones distintas

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

export default function PantallaPermutantes({ busqueda, busquedaFecha, modoBusqueda = "cualquiera" }) {
  const [conteos, setConteos] = useState({});
  const [ultimasFechas, setUltimasFechas] = useState({});
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [filtroCantidad, setFiltroCantidad] = useState("");
  const [diasReciente, setDiasReciente] = useState(30);
  const [metas, setMetas] = useState(() =>
    Object.fromEntries(TIPOS.map((t) => [t.id, t.meta]))
  );
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

  // Del que cayó hace más tiempo al más reciente (los que nunca han caído no aparecen)
  const cronologicos = useMemo(
    () =>
      visibles
        .filter((g) => g.ultimaFecha)
        .sort((a, b) => a.ultimaFecha.localeCompare(b.ultimaFecha)),
    [visibles]
  );

  // Del que más cae al que menos cae
  const porFrecuencia = useMemo(
    () =>
      [...visibles].sort((a, b) => {
        if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
        return a.etiqueta.localeCompare(b.etiqueta); // desempate estable
      }),
    [visibles]
  );

  // Suma de todas las veces que ha caído cada grupo
  const totalCantidad = useMemo(
    () => grupos.reduce((s, g) => s + g.cantidad, 0),
    [grupos]
  );

  const porcentaje = (cantidad, dec = 3) =>
    totalCantidad > 0 ? `${((cantidad / totalCantidad) * 100).toFixed(dec)}%` : "0%";

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
      <h3>
        Permutantes de 4 cifras ({grupos.length})
        {(terminos.length > 0 || terminosFecha.length > 0) && ` · ${totalBusqueda} coinciden`}
      </h3>
      <p>
        Ordenados del que más cae al que menos cae. Basado en{" "}
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
                  <td className={`perm-ultima-comb${terminaEnBusqueda(c.ultimaCombinacion) ? " celda-final" : ""}`}>
                    {c.ultimaCombinacion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ============ GRUPO 2: ORDEN POR FRECUENCIA + COMBINACIONES ============ */}
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

        {/* Selección por tipo */}
        <div className="perm-seleccion">
          <h3>Selección de {todosLosElegidos.length} grupos</h3>

          <div className="perm-filtros">
            <label>
              No han caído en los últimos (días):
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={diasReciente}
                onChange={(e) => setDiasReciente(e.target.value)}
              />
            </label>
          </div>

          <div className="perm-seleccion-grid perm-seleccion-grid-5">
            {TIPOS.map((t) => (
              <div key={t.id} className="perm-scroll perm-seleccion-bloque">
                <h4>
                  {t.nombre} ({seleccion[t.id].length}/{metas[t.id]})
                </h4>
                <label className="perm-meta">
                  Cuántos:
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={metas[t.id]}
                    onChange={(e) =>
                      setMetas((m) => ({ ...m, [t.id]: e.target.value }))
                    }
                  />
                </label>
                <table className="tabla-permutantes">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Grupo</th>
                      <th>Cant.</th>
                      <th>%</th>
                      <th>Comb.</th>
                      <th>Última vez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seleccion[t.id].map((g, i) => (
                      <tr key={g.etiqueta}>
                        <td>{i + 1}</td>
                        <td className="perm-grupo-cron">
                          <strong>{g.etiqueta}</strong>
                        </td>
                        <td className="perm-cantidad">{g.cantidad}</td>
                        <td className="perm-porcentaje">{porcentaje(g.cantidad)}</td>
                        <td>{g.permutaciones.length}</td>
                        <td>{g.ultimaFecha ? formatoFecha(g.ultimaFecha) : "Nunca"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <p className="perm-seleccion-copiar">
            {todosLosElegidos.map((g) => g.etiqueta).join(" ")}
          </p>
        </div>
      </div>
    </div>
  );
}