import { useEffect, useMemo, useState } from "react";
import { obtenerConteosPermutantes3 } from "../api";
import { terminosBusqueda } from "../utils";
import "./PantallaPermutantes.css"; // mismos estilos que la de 4 cifras

const CIFRAS = 3;
// El 0 vale como el mayor (10) para el orden
const valor = (d) => (d === 0 ? 10 : d);
const MAX_PERMUTACIONES = 6; // 3! = máximo de permutaciones distintas
const CLAVE_SIMULACROS = "simulacros_3cifras";

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

const dinero = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

function cargarSimulacros() {
  try {
    const raw = localStorage.getItem(CLAVE_SIMULACROS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [filtroCantidad, setFiltroCantidad] = useState("");
  const [diasReciente, setDiasReciente] = useState(30);
  const [error, setError] = useState("");

  // Parámetros del simulacro (Paga encime)
  const [apuesta, setApuesta] = useState(3000);
  const [multiplicador, setMultiplicador] = useState(400);
  const [encime, setEncime] = useState(80);
  const [simulacros, setSimulacros] = useState(cargarSimulacros);

  useEffect(() => {
    obtenerConteosPermutantes3()
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
        return {
          combinacion,
          cantidad: conteos[combinacion] || 0,
          ultimaFecha: ultimasFechas[combinacion] || null,
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
    [conteos, ultimasFechas]
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

  // Selección de 150 números: 108 todos diferentes, 40 con un dígito
  // repetido 2 veces y 2 pacha. Las más frecuentes primero, excluyendo
  // las que cayeron en los últimos `diasReciente` días (las pacha no
  // llevan ese filtro).
  const seleccion150 = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() - (Number(diasReciente) || 0));

    const cayoReciente = (iso) => {
      if (!iso) return false; // nunca ha caído: no es reciente
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d) >= limite;
    };

    // Más veces primero; si empatan, la que cayó hace más tiempo
    const ordenar = (a, b) =>
      b.cantidad - a.cantidad ||
      (a.ultimaFecha || "").localeCompare(b.ultimaFecha || "") ||
      a.combinacion.localeCompare(b.combinacion);

    const distintos = (t) => new Set(t.combinacion).size;

    return {
      diferentes: todas
        .filter((t) => distintos(t) === 3 && !cayoReciente(t.ultimaFecha))
        .sort(ordenar)
        .slice(0, 108),
      repetidos: todas
        .filter((t) => distintos(t) === 2 && !cayoReciente(t.ultimaFecha))
        .sort(ordenar)
        .slice(0, 40),
      pacha: todas
        .filter((t) => distintos(t) === 1)
        .sort(ordenar)
        .slice(0, 2),
    };
  }, [todas, diasReciente]);

  const numerosSeleccion = useMemo(
    () =>
      [
        ...seleccion150.diferentes,
        ...seleccion150.repetidos,
        ...seleccion150.pacha,
      ].map((t) => t.combinacion),
    [seleccion150]
  );

  const totalSeleccion = numerosSeleccion.length;

  // Cuántos de la selección coinciden con el buscador global
  const coincidenEnSeleccion =
    terminos.length > 0 || terminosFecha.length > 0
      ? [
          ...seleccion150.diferentes,
          ...seleccion150.repetidos,
          ...seleccion150.pacha,
        ].filter(coincideBusquedaTodas).length
      : 0;

  // ================= SIMULACRO =================

  // Fecha más reciente que hay en los resultados cargados
  const fechaBase = useMemo(
    () =>
      Object.values(ultimasFechas).reduce((max, f) => (f > max ? f : max), ""),
    [ultimasFechas]
  );

  const premioPorAcierto =
    (Number(apuesta) || 0) * (Number(multiplicador) || 0) * (1 + (Number(encime) || 0) / 100);
  const costoPorDia = (Number(apuesta) || 0) * totalSeleccion;

  // Guarda en el navegador cada vez que cambia el historial
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_SIMULACROS, JSON.stringify(simulacros));
    } catch {
      /* si el navegador no deja guardar, el simulacro sigue en memoria */
    }
  }, [simulacros]);

  // 1) Evalúa los simulacros pendientes cuando ya hay una fecha más nueva
  // 2) Registra el simulacro de hoy si todavía no existe
  useEffect(() => {
    if (!fechaBase || totalSeleccion === 0) return;

    setSimulacros((prev) => {
      let cambio = false;
      const lista = prev.map((s) => {
        if (s.resultado || fechaBase <= s.base) return s;
        const ganadores = s.numeros.filter((n) => (ultimasFechas[n] || "") > s.base);
        const premioUno = s.apuesta * s.multiplicador * (1 + s.encime / 100);
        cambio = true;
        return {
          ...s,
          resultado: {
            fecha: fechaBase,
            ganadores,
            premio: ganadores.length * premioUno,
          },
        };
      });

      if (!lista.some((s) => s.base === fechaBase)) {
        lista.push({
          base: fechaBase,
          creado: new Date().toISOString(),
          numeros: numerosSeleccion,
          apuesta: Number(apuesta) || 0,
          multiplicador: Number(multiplicador) || 0,
          encime: Number(encime) || 0,
          resultado: null,
        });
        cambio = true;
      }

      return cambio ? lista : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaBase, ultimasFechas, numerosSeleccion]);

  const pendiente = simulacros.find((s) => s.base === fechaBase && !s.resultado);

  // Vuelve a registrar el simulacro de hoy con la selección y valores actuales
  const rehacerHoy = () => {
    setSimulacros((prev) =>
      prev.map((s) =>
        s.base === fechaBase && !s.resultado
          ? {
              ...s,
              creado: new Date().toISOString(),
              numeros: numerosSeleccion,
              apuesta: Number(apuesta) || 0,
              multiplicador: Number(multiplicador) || 0,
              encime: Number(encime) || 0,
            }
          : s
      )
    );
  };

  const evaluados = useMemo(
    () =>
      simulacros
        .filter((s) => s.resultado)
        .sort((a, b) => a.base.localeCompare(b.base)),
    [simulacros]
  );

  const ultimoEvaluado = evaluados[evaluados.length - 1] || null;

  const acumulado = useMemo(() => {
    const jugado = evaluados.reduce((s, x) => s + x.apuesta * x.numeros.length, 0);
    const ganado = evaluados.reduce((s, x) => s + x.resultado.premio, 0);
    return {
      dias: evaluados.length,
      diasGanados: evaluados.filter((x) => x.resultado.ganadores.length > 0).length,
      jugado,
      ganado,
      neto: ganado - jugado,
    };
  }, [evaluados]);

  const columnasPerm = Array.from({ length: MAX_PERMUTACIONES });

  // Bloque de una categoría de la selección (con búsqueda global)
  const renderListaSeleccion = (titulo, lista, meta) => (
    <div className="perm-scroll perm-seleccion-bloque">
      <h4>
        {titulo} ({lista.length}/{meta})
      </h4>
      <table className="tabla-permutantes">
        <thead>
          <tr>
            <th>#</th>
            <th>Número</th>
            <th>Cantidad</th>
            <th>%</th>
            <th>Última vez</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((t, i) => (
            <tr
              key={t.combinacion}
              className={coincideBusquedaTodas(t) ? "fila-busqueda" : ""}
            >
              <td>{i + 1}</td>
              <td className="perm-grupo-cron">
                <strong>{t.combinacion}</strong>
              </td>
              <td className="perm-cantidad">{t.cantidad}</td>
              <td className="perm-porcentaje">{porcentaje(t.cantidad)}</td>
              <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="permutantes">
      {/* ============ AVISO DEL ÚLTIMO SIMULACRO ============ */}
      {ultimoEvaluado &&
        (ultimoEvaluado.resultado.ganadores.length > 0 ? (
          <div className="sim-banner sim-gano">
            <div className="sim-banner-titulo">🎉 ¡FELICIDADES, GANASTE! 🎉</div>
            <div className="sim-banner-monto">{dinero(ultimoEvaluado.resultado.premio)}</div>
            <div className="sim-banner-detalle">
              Acertaste {ultimoEvaluado.resultado.ganadores.length}{" "}
              {ultimoEvaluado.resultado.ganadores.length === 1 ? "número" : "números"}:{" "}
              <strong>{ultimoEvaluado.resultado.ganadores.join(" · ")}</strong>
            </div>
            <div className="sim-banner-detalle">
              Jugaste {dinero(ultimoEvaluado.apuesta * ultimoEvaluado.numeros.length)} → neto{" "}
              {dinero(
                ultimoEvaluado.resultado.premio -
                  ultimoEvaluado.apuesta * ultimoEvaluado.numeros.length
              )}
            </div>
            <div className="sim-banner-fecha">
              Simulacro del {formatoFecha(ultimoEvaluado.base)} · resultado del{" "}
              {formatoFecha(ultimoEvaluado.resultado.fecha)}
            </div>
          </div>
        ) : (
          <div className="sim-banner sim-perdio">
            <div className="sim-banner-titulo">💪 Sigue intentando</div>
            <div className="sim-banner-detalle">
              Ninguno de tus {ultimoEvaluado.numeros.length} números cayó esta vez. Habrías
              perdido {dinero(ultimoEvaluado.apuesta * ultimoEvaluado.numeros.length)}.
            </div>
            <div className="sim-banner-fecha">
              Simulacro del {formatoFecha(ultimoEvaluado.base)} · resultado del{" "}
              {formatoFecha(ultimoEvaluado.resultado.fecha)}
            </div>
          </div>
        ))}

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
                  <td className="perm-cantidad">{t.cantidad}</td>
                  <td className="perm-porcentaje">{porcentaje(t.cantidad)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="perm-cantidad">{totalCantidad.toLocaleString()}</td>
                <td className="perm-porcentaje">100%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

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

        {/* Selección de 150 números */}
        <div className="perm-seleccion">
          <h3>
            Selección de {totalSeleccion} números
            {(terminos.length > 0 || terminosFecha.length > 0) &&
              ` · ${coincidenEnSeleccion} coinciden`}
          </h3>
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

          <div className="perm-seleccion-grid">
            {renderListaSeleccion("Tres cifras diferentes", seleccion150.diferentes, 108)}
            {renderListaSeleccion("Un dígito repetido 2 veces", seleccion150.repetidos, 40)}
            {renderListaSeleccion("Pacha (tres iguales)", seleccion150.pacha, 2)}
          </div>

          <p className="perm-seleccion-copiar">{numerosSeleccion.join(" ")}</p>
        </div>

        {/* ============ SIMULACRO DE JUEGO ============ */}
        <div className="perm-simulacro">
          <h3>Simulacro de juego · Paga encime</h3>

          <div className="perm-filtros">
            <label>
              Apuesta por número ($):
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={apuesta}
                onChange={(e) => setApuesta(e.target.value)}
              />
            </label>
            <label>
              Paga por cada peso:
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={multiplicador}
                onChange={(e) => setMultiplicador(e.target.value)}
              />
            </label>
            <label>
              Encime (%):
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={encime}
                onChange={(e) => setEncime(e.target.value)}
              />
            </label>
            <button type="button" className="perm-limpiar" onClick={rehacerHoy} disabled={!pendiente}>
              Rehacer simulacro de hoy
            </button>
          </div>

          <p className="sim-linea">
            Premio por acierto: <strong>{dinero(premioPorAcierto)}</strong> · Costo por día (
            {totalSeleccion} números): <strong>{dinero(costoPorDia)}</strong>
          </p>

          {pendiente ? (
            <p className="sim-pendiente">
              ⏳ Simulacro registrado con datos hasta el {formatoFecha(pendiente.base)} (
              {pendiente.numeros.length} números). Cuando sincronices los resultados nuevos y
              vuelvas a abrir esta pantalla, se compara automáticamente.
            </p>
          ) : (
            <p className="sim-pendiente">Esperando resultados para registrar el simulacro.</p>
          )}

          <div className="sim-tarjetas">
            <div className="sim-tarjeta">
              <span>Días evaluados</span>
              <strong>{acumulado.dias}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Días con premio</span>
              <strong>{acumulado.diasGanados}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Total jugado</span>
              <strong>{dinero(acumulado.jugado)}</strong>
            </div>
            <div className="sim-tarjeta">
              <span>Total ganado</span>
              <strong>{dinero(acumulado.ganado)}</strong>
            </div>
            <div className={`sim-tarjeta ${acumulado.neto >= 0 ? "sim-positivo" : "sim-negativo"}`}>
              <span>Neto acumulado</span>
              <strong>{dinero(acumulado.neto)}</strong>
            </div>
          </div>

          {evaluados.length > 0 && (
            <div className="perm-scroll sim-historial">
              <table className="tabla-permutantes">
                <thead>
                  <tr>
                    <th>Jugada (datos al)</th>
                    <th>Resultado del</th>
                    <th>Estado</th>
                    <th>Acertados</th>
                    <th>Jugado</th>
                    <th>Ganado</th>
                    <th>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {[...evaluados].reverse().map((s) => {
                    const jugado = s.apuesta * s.numeros.length;
                    const neto = s.resultado.premio - jugado;
                    const gano = s.resultado.ganadores.length > 0;
                    return (
                      <tr key={s.base}>
                        <td>{formatoFecha(s.base)}</td>
                        <td>{formatoFecha(s.resultado.fecha)}</td>
                        <td>{gano ? "🎉 Ganó" : "Sigue intentando"}</td>
                        <td>{s.resultado.ganadores.join(" · ") || "—"}</td>
                        <td className="perm-cantidad">{dinero(jugado)}</td>
                        <td className="perm-cantidad">{dinero(s.resultado.premio)}</td>
                        <td className={`perm-cantidad ${neto >= 0 ? "sim-positivo" : "sim-negativo"}`}>
                          {dinero(neto)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}