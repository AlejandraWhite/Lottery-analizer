import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  obtenerFechasCombinaciones3,
  guardarJugada3,
  listarJugadas3,
  eliminarJugada3,
  marcarJugada3Vista,
} from "../api";
import { terminosBusqueda } from "../utils";
import { calcularStats, NOMBRE_TIPO } from "../statsIntervalos3";
import BacktestSimulacro3 from "./BacktestSimulacro3";
import "./PantallaPermutantes.css";

function formatoFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const pesos = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-CO") : "");
const entero = (v) => (v == null ? "—" : Math.round(v).toLocaleString());

const porNumero = (a, b) => a.combinacion.localeCompare(b.combinacion);

// Cómo se ordenan los números según el criterio elegido
const ORDENADORES = {
  frecuentes: (a, b) =>
    b.cantidad - a.cantidad ||
    (a.ultimaFecha || "").localeCompare(b.ultimaFecha || "") ||
    porNumero(a, b),
  ratio: (a, b) => b.veces - a.veces || porNumero(a, b),
  atraso: (a, b) => b.atraso - a.atraso || porNumero(a, b),
  sinCaer: (a, b) => b.diasSinCaer - a.diasSinCaer || porNumero(a, b),
};
const CRITERIOS = [
  { id: "frecuentes", texto: "Los que más caen (más veces en el histórico)" },
  { id: "ratio", texto: "Más atrasados según su promedio (× su promedio)" },
  { id: "atraso", texto: "Más atrasados según su promedio (días de atraso)" },
  { id: "sinCaer", texto: "Los que llevan más tiempo sin caer" },
  { id: "mezcla", texto: "Mezcla: los que más caen + los más atrasados" },
];

export default function PantallaSeleccion3({
  busqueda,
  busquedaFecha,
  modoBusqueda = "cualquiera",
  versionSync = 0, // App lo incrementa después de sincronizar
}) {
  const [fechas, setFechas] = useState({});
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState(false);

  // Criterios de selección
  const [criterio, setCriterio] = useState("frecuentes");
  const [minVeces, setMinVeces] = useState(3);
  const [diasReciente, setDiasReciente] = useState(365);
  const [repartir, setRepartir] = useState(true);
  const [metas, setMetas] = useState({ diferentes: 108, repetidos: 40, pacha: 2 });
  const [texto, setTexto] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const [pctFrecuencia, setPctFrecuencia] = useState(50);
  const areaRef = useRef(null);

useLayoutEffect(() => {
  const el = areaRef.current;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}, [texto]);

  // Prueba hacia adelante
  const [jugadas, setJugadas] = useState([]);
  const [nombre, setNombre] = useState("");
  const [params, setParams] = useState({ apuesta: 3000, multiplicador: 400, encime: 80 });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const ultimasCifras = modoBusqueda === "ultimas2";
  const terminos = terminosBusqueda(busqueda);
  const terminosFecha = terminosBusqueda(busquedaFecha);
  const hayBusqueda = terminos.length > 0 || terminosFecha.length > 0;

  const cargarDatos = async () => {
    setActualizando(true);
    try {
      const data = await obtenerFechasCombinaciones3();
      setFechas(data.fechas || {});
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setActualizando(false);
    }
  };

  const cargarJugadas = async () => {
    try {
      setJugadas(await listarJugadas3());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Al abrir la pantalla y cada vez que se sincroniza: trae las jugadas y el
  // servidor las evalúa contra los resultados nuevos.
  useEffect(() => {
    cargarJugadas();
    if (versionSync > 0) cargarDatos();
  }, [versionSync]);

  const stats = useMemo(() => calcularStats(fechas), [fechas]);
  const totalHistorico = useMemo(() => stats.reduce((s, t) => s + t.cantidad, 0), [stats]);

  const totalMetas =
    (Number(metas.diferentes) || 0) +
    (Number(metas.repetidos) || 0) +
    (Number(metas.pacha) || 0);

  // Reparte un total en la misma proporción de 108 / 40 / 2
  const repartirTotal = (valorTotal) => {
    const n = Math.max(0, Math.min(1000, Math.floor(Number(valorTotal) || 0)));
    const pacha = Math.round((n * 2) / 150);
    const repetidos = Math.round((n * 40) / 150);
    setMetas({ diferentes: n - pacha - repetidos, repetidos, pacha });
  };

  // Genera la selección según el criterio y la deja en el cuadro de texto
const generar = () => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() - (Number(diasReciente) || 0));
  const cayoReciente = (iso) => {
    if (!iso) return false;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d) >= limite;
  };

  const elegiblePara = (crit) => (t) => {
    if (crit === "frecuentes") return !(t.distintos !== 1 && cayoReciente(t.ultimaFecha));
    if (crit === "sinCaer") return t.diasSinCaer != null && t.cantidad >= 1;
    return (
      t.promedio != null &&
      t.cantidad >= Number(minVeces) &&
      t[crit === "ratio" ? "veces" : "atraso"] != null
    );
  };

  const seleccionar = (tipo, cuantos) => {
    const delTipo = tipo ? stats.filter((t) => t.distintos === tipo) : stats;
    const n = Number(cuantos) || 0;
    if (criterio === "mezcla") {
      const nf = Math.round((n * Number(pctFrecuencia)) / 100);
      const a = delTipo
        .filter(elegiblePara("frecuentes"))
        .sort(ORDENADORES.frecuentes)
        .slice(0, nf);
      const usados = new Set(a.map((t) => t.combinacion));
      const b = delTipo
        .filter((t) => !usados.has(t.combinacion) && elegiblePara("ratio")(t))
        .sort(ORDENADORES.ratio)
        .slice(0, n - a.length);
      return [...a, ...b];
    }
    return delTipo.filter(elegiblePara(criterio)).sort(ORDENADORES[criterio]).slice(0, n);
  };

  const elegidos = repartir
    ? [
        ...seleccionar(3, metas.diferentes),
        ...seleccionar(2, metas.repetidos),
        ...seleccionar(1, metas.pacha),
      ]
    : seleccionar(null, totalMetas);

  setTexto(elegidos.map((t) => t.combinacion).join(" "));
};

  // Primera selección automática cuando llegan los datos
  useEffect(() => {
    if (!iniciado && stats.some((t) => t.cantidad > 0)) {
      generar();
      setIniciado(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  // Números válidos del cuadro de texto (3 cifras, sin repetir)
  const { numeros, ignorados } = useMemo(() => {
    const vistos = new Set();
    const lista = [];
    let malos = 0;
    for (const tok of texto.split(/[\s,;]+/).filter(Boolean)) {
      if (/^\d{3}$/.test(tok)) {
        if (!vistos.has(tok)) {
          vistos.add(tok);
          lista.push(tok);
        }
      } else malos++;
    }
    return { numeros: lista, ignorados: malos };
  }, [texto]);

  const filasSeleccion = useMemo(() => numeros.map((n) => stats[Number(n)]), [numeros, stats]);

  const fechaCoincide = (iso) => {
    if (terminosFecha.length === 0 || !iso) return false;
    const f = formatoFecha(iso);
    return terminosFecha.some((t) => f.includes(t));
  };

  const coincideBusqueda = (t) => {
    const porFecha = fechaCoincide(t.ultimaFecha);
    const porNum =
      terminos.length > 0 &&
      terminos.some((x) =>
        ultimasCifras ? t.combinacion.endsWith(x) : t.combinacion.includes(x)
      );
    return porNum || porFecha;
  };

  const coincidenEnSeleccion = hayBusqueda ? filasSeleccion.filter(coincideBusqueda).length : 0;

  // ---------- Prueba hacia adelante ----------
  const guardar = async () => {
    setGuardando(true);
    setMensaje("");
    try {
      await guardarJugada3({
        numeros,
        nombre: nombre.trim() || null,
        apuesta: Number(params.apuesta) || 0,
        multiplicador: Number(params.multiplicador) || 0,
        encime: Number(params.encime) || 0,
      });
      setMensaje(
        `Jugada guardada con ${numeros.length} números. Se evaluará con los próximos resultados que lleguen.`
      );
      setNombre("");
      await cargarJugadas();
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (id) => {
    try {
      await eliminarJugada3(id);
      await cargarJugadas();
    } catch (e) {
      setMensaje(e.message);
    }
  };

  const visto = async (id) => {
    try {
      await marcarJugada3Vista(id);
      await cargarJugadas();
    } catch (e) {
      setMensaje(e.message);
    }
  };

  const sinVer = jugadas.filter((j) => j.estado === "evaluada" && !j.vista);
  const pendientes = jugadas.filter((j) => j.estado === "pendiente");
  const evaluadas = jugadas.filter((j) => j.estado === "evaluada");

  const banner = (j) => {
    const gano = j.aciertos.length > 0;
    return (
      <div
        key={j.id}
        style={{
          margin: "12px 0",
          padding: "16px 20px",
          borderRadius: 10,
          border: `2px solid ${gano ? "#16a34a" : "#d97706"}`,
          background: gano ? "#dcfce7" : "#fef3c7",
          color: "#111",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          {gano ? `🎉 ¡Felicidades, ganaste ${pesos(j.premio)}!` : "Sigue intentando"}
        </div>
        <div style={{ marginTop: 6 }}>
          {j.nombre ? `${j.nombre} · ` : ""}
          Jugaste {j.cantidad_numeros} números · resultados evaluados del{" "}
          {formatoFecha(j.fecha_desde)}
          {j.fecha_hasta !== j.fecha_desde && ` al ${formatoFecha(j.fecha_hasta)}`} (
          {j.dias_evaluados} {j.dias_evaluados === 1 ? "día" : "días"}).
        </div>
        {gano ? (
          <div style={{ marginTop: 6 }}>
            Aciertos ({j.aciertos.length}):{" "}
            {j.aciertos
              .map(
                (a) =>
                  `${a.numero} (${formatoFecha(a.fecha)}${
                    a.loterias?.length ? ` · ${a.loterias.join(", ")}` : ""
                  })`
              )
              .join(" · ")}
            <br />
            Invertido {pesos(j.costo)} · Neto {pesos(j.neto)}
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            Ninguno de tus números cayó. Invertido {pesos(j.costo)}.
          </div>
        )}
        <button type="button" className="perm-limpiar" style={{ marginTop: 10 }} onClick={() => visto(j.id)}>
          Entendido
        </button>
      </div>
    );
  };

  return (
    <div className="permutantes">
      <h3>Selección de números (3 cifras)</h3>
      <p>Basado en {totalHistorico.toLocaleString()} números del histórico.</p>
      {error && <p className="formulario-error">{error}</p>}

      {/* Resultados de las jugadas guardadas, aún sin ver */}
      {sinVer.map(banner)}

      {/* ============ CRITERIOS DE SELECCIÓN ============ */}
      <div className="perm-seleccion">
        <h3>
          Selección de {numeros.length} números
          {hayBusqueda && ` · ${coincidenEnSeleccion} coinciden`}
        </h3>

        <div className="perm-filtros">
          <label>
            Criterio:
            <select value={criterio} onChange={(e) => setCriterio(e.target.value)}>
              {CRITERIOS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.texto}
                </option>
              ))}
            </select>
          </label>

          {criterio === "frecuentes" && (
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
          )}

          {(criterio === "ratio" || criterio === "atraso") && (
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
          )}

          {criterio === "mezcla" && (
  <>
    <label>
      % por los que más caen:
      <input
        type="number"
        min="0"
        max="100"
        inputMode="numeric"
        value={pctFrecuencia}
        onChange={(e) => setPctFrecuencia(e.target.value)}
      />
    </label>
    <label>
      No han caído en los últimos (días):
      <input type="number" min="0" inputMode="numeric" value={diasReciente} onChange={(e) => setDiasReciente(e.target.value)} />
    </label>
    <label>
      Mínimo de veces caído:
      <input type="number" min="2" inputMode="numeric" value={minVeces} onChange={(e) => setMinVeces(e.target.value)} />
    </label>
  </>
)}

          <label>
            Total de números:
            <input
              type="number"
              min="0"
              max="1000"
              inputMode="numeric"
              value={totalMetas}
              onChange={(e) => repartirTotal(e.target.value)}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={repartir}
              onChange={(e) => setRepartir(e.target.checked)}
            />
            Repartir por tipo (diferentes / un repetido / pacha)
          </label>
        </div>

        {repartir && (
          <div className="perm-filtros">
            <label>
              Diferentes:
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={metas.diferentes}
                onChange={(e) => setMetas((m) => ({ ...m, diferentes: e.target.value }))}
              />
            </label>
            <label>
              Un dígito repetido:
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={metas.repetidos}
                onChange={(e) => setMetas((m) => ({ ...m, repetidos: e.target.value }))}
              />
            </label>
            <label>
              Pacha:
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={metas.pacha}
                onChange={(e) => setMetas((m) => ({ ...m, pacha: e.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="perm-filtros">
          <button type="button" className="perm-limpiar" onClick={generar} disabled={actualizando}>
            ⚙️ Generar selección
          </button>
          <button type="button" className="perm-limpiar" onClick={cargarDatos} disabled={actualizando}>
            {actualizando ? "⏳ Actualizando..." : "🔄 Actualizar resultados"}
          </button>
        </div>

        <p style={{ margin: "8px 0 4px" }}>
          Números a jugar (puedes agregar o quitar a mano, separados por espacio o coma):
        </p>
        <textarea
  ref={areaRef}
  value={texto}
  onChange={(e) => setTexto(e.target.value)}
  rows={4}
  style={{
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "monospace",
    overflow: "hidden",
    resize: "none",
  }}
/>
        {ignorados > 0 && (
          <p className="formulario-error">
            {ignorados} elemento(s) ignorado(s): solo se aceptan números de 3 cifras.
          </p>
        )}

        <div className="perm-scroll perm-scroll-cron">
          <table className="tabla-permutantes tabla-cron">
            <thead>
              <tr>
                <th>#</th>
                <th>Número</th>
                <th>Tipo</th>
                <th>Veces</th>
                <th>Prom. días entre caídas</th>
                <th>Última vez</th>
                <th>Días sin caer</th>
                <th>× su promedio</th>
              </tr>
            </thead>
            <tbody>
              {filasSeleccion.map((t, i) => (
                <tr key={t.combinacion} className={coincideBusqueda(t) ? "fila-busqueda" : ""}>
                  <td>{i + 1}</td>
                  <td className="perm-grupo-cron">
                    <strong>{t.combinacion}</strong>
                  </td>
                  <td>{NOMBRE_TIPO[t.distintos]}</td>
                  <td className="perm-cantidad">{t.cantidad}</td>
                  <td>{entero(t.promedio)}</td>
                  <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
                  <td>{entero(t.diasSinCaer)}</td>
                  <td className="perm-porcentaje">
                    {t.veces != null ? `${t.veces.toFixed(2)}×` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ PRUEBA HACIA ADELANTE ============ */}
      <div className="perm-seleccion">
        <h3>Prueba hacia adelante</h3>
        <p>
          Guarda los números de arriba. Cuando lleguen resultados nuevos (al sincronizar o con la
          carga automática de las 7 am) se comparan con esta jugada y te dice si ganaste.
        </p>

        <div className="perm-filtros">
          <label>
            Nombre (opcional):
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label>
            Apuesta por número:
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={params.apuesta}
              onChange={(e) => setParams((p) => ({ ...p, apuesta: e.target.value }))}
            />
          </label>
          <label>
            Paga (× apuesta):
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={params.multiplicador}
              onChange={(e) => setParams((p) => ({ ...p, multiplicador: e.target.value }))}
            />
          </label>
          <label>
            Encime (%):
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={params.encime}
              onChange={(e) => setParams((p) => ({ ...p, encime: e.target.value }))}
            />
          </label>
          <button
            type="button"
            className="perm-limpiar"
            onClick={guardar}
            disabled={guardando || numeros.length === 0}
          >
            {guardando ? "Guardando..." : `💾 Guardar jugada (${numeros.length} números)`}
          </button>
          <button type="button" className="perm-limpiar" onClick={cargarJugadas}>
            🔄 Revisar resultados
          </button>
        </div>
        {mensaje && <p className="mensaje">{mensaje}</p>}

        {pendientes.length > 0 && (
          <>
            <h4>Esperando resultados ({pendientes.length})</h4>
            <div className="perm-scroll">
              <table className="tabla-permutantes">
                <thead>
                  <tr>
                    <th>Guardada</th>
                    <th>Nombre</th>
                    <th>Números</th>
                    <th>Apuesta</th>
                    <th>Histórico hasta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((j) => (
                    <tr key={j.id}>
                      <td>{fechaHora(j.creada_en)}</td>
                      <td>{j.nombre || "—"}</td>
                      <td className="perm-cantidad">{j.cantidad_numeros}</td>
                      <td>{pesos(j.apuesta)}</td>
                      <td>{formatoFecha(j.fecha_corte)}</td>
                      <td>
  <button type="button" className="perm-limpiar" onClick={() => setTexto(j.numeros.join(" "))}>
    Cargar
  </button>{" "}
  <button type="button" className="perm-limpiar" onClick={() => quitar(j.id)}>
    ✕ Eliminar
  </button>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {evaluadas.length > 0 && (
          <>
            <h4>Historial de jugadas evaluadas</h4>
            <div className="perm-scroll">
              <table className="tabla-permutantes">
                <thead>
                  <tr>
                    <th>Guardada</th>
                    <th>Nombre</th>
                    <th>Números</th>
                    <th>Días evaluados</th>
                    <th>Aciertos</th>
                    <th>Invertido</th>
                    <th>Premio</th>
                    <th>Neto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {evaluadas.map((j) => (
                    <tr key={j.id}>
                      <td>{fechaHora(j.creada_en)}</td>
                      <td>{j.nombre || "—"}</td>
                      <td className="perm-cantidad">{j.cantidad_numeros}</td>
                      <td>
                        {formatoFecha(j.fecha_desde)}
                        {j.fecha_hasta !== j.fecha_desde && ` – ${formatoFecha(j.fecha_hasta)}`}
                      </td>
                      <td>
                        {j.aciertos.length > 0
                          ? j.aciertos.map((a) => a.numero).join(" ")
                          : "Ninguno"}
                      </td>
                      <td>{pesos(j.costo)}</td>
                      <td>{pesos(j.premio)}</td>
                      <td>{pesos(j.neto)}</td>
                      <td>
                        <button
                          type="button"
                          className="perm-limpiar"
                          onClick={() => setTexto(j.numeros.join(" "))}
                        >
                          Cargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ============ PRUEBA HACIA ATRÁS ============ */}
      <BacktestSimulacro3
  config={{
    criterio,
    minVeces: Number(minVeces) || 2,
    diasReciente: Number(diasReciente) || 0,
    repartir,
    metas: {
      diferentes: Number(metas.diferentes) || 0,
      repetidos: Number(metas.repetidos) || 0,
      pacha: Number(metas.pacha) || 0,
    },
    total: totalMetas,
    pctFrecuencia: Number(pctFrecuencia) || 0,
  }}
/>
    </div>
  );
}