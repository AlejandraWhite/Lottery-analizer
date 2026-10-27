import { Fragment, useEffect, useMemo, useState } from "react";
import { obtenerAnalisisMiercoles2 } from "../api";
import { terminosBusqueda } from "../utils";
import { calcularStats2 } from "../statsIntervalos2";
import "./PantallaPermutantes.css";
import "./PantallaMiercolesAnalisis.css";

const LOTERIAS = [
  { clave: "meta", nombre: "Meta" },
  { clave: "valle", nombre: "Valle" },
  { clave: "manizales", nombre: "Manizales" },
];

function formatoFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const entero = (v) => (v == null ? "—" : Math.round(v).toLocaleString());
const decimal = (v) => (v == null ? "—" : v.toFixed(1));
const veces = (v) => (v == null ? "—" : `${v.toFixed(2)}×`);
const fmtGap = (g) => (Number.isInteger(g) ? g : g.toFixed(1));

// =========================================================
// Lista de fechas (con recorte opcional a las más recientes)
// =========================================================

function ListaFechas({ fechas, gaps, conteo, fechaCoincide, limite = 0 }) {
  const [todas, setTodas] = useState(false);
  const total = fechas.length;
  const recorta = limite > 0 && total > limite;
  const desde = recorta && !todas ? total - limite : 0;

  if (total === 0) return "Nunca";

  return (
    <>
      {recorta && !todas && (
        <button type="button" className="perm-limpiar" onClick={() => setTodas(true)}>
          … {desde} anteriores · ver todas
        </button>
      )}
      {fechas.slice(desde).map((f, j) => {
        const k = desde + j;
        const resaltada = fechaCoincide(f);
        return (
          <span
            key={f}
            style={{
              display: "inline-block",
              marginRight: 8,
              padding: "0 4px",
              borderRadius: 3,
              background: resaltada ? "#fde68a" : "transparent",
              color: resaltada ? "#000" : undefined,
            }}
          >
            {formatoFecha(f)}
            {conteo[f] > 1 && <small> ×{conteo[f]}</small>}
            {k > 0 && <small style={{ opacity: 0.6 }}> (+{fmtGap(gaps[k - 1])})</small>}
          </span>
        );
      })}
      {recorta && todas && (
        <button type="button" className="perm-limpiar" onClick={() => setTodas(false)}>
          ver menos
        </button>
      )}
    </>
  );
}

// =========================================================
// Tabla de intervalos (una sola tabla: orden + filtros)
// =========================================================

function FilaIntervalo({ t, indice, filtro, limiteFechas, atrasada }) {
  const coincide = filtro.numero(t.combinacion) || t.fechas.some(filtro.fecha);
  const claseAtraso = atrasada ? "celda-atrasada" : "";
  return (
    <tr className={coincide ? "fila-busqueda" : ""}>
      <td>{indice + 1}</td>
      <td className="perm-grupo-cron">
        <strong>{t.combinacion}</strong>
      </td>
      <td className="perm-cantidad">{t.cantidad}</td>
      <td>{entero(t.promedio)}</td>
      <td>{entero(t.min)}</td>
      <td>{entero(t.max)}</td>
      <td>{decimal(t.cv)}</td>
      <td>{t.ultimaFecha ? formatoFecha(t.ultimaFecha) : "Nunca"}</td>
      <td className={claseAtraso}>{entero(t.diasSinCaer)}</td>
      <td className={claseAtraso}>{entero(t.atraso)}</td>
      <td className={`perm-porcentaje ${claseAtraso}`}>{veces(t.veces)}</td>
      <td className="col-fechas">
        <ListaFechas
          fechas={t.fechas}
          gaps={t.gaps}
          conteo={t.conteo}
          fechaCoincide={filtro.fecha}
          limite={limiteFechas}
        />
      </td>
    </tr>
  );
}

function TablaIntervalos({ titulo, descripcion, stats, filtro, minVeces, umbral, unidad, limiteFechas = 12 }) {
  const [orden, setOrden] = useState("numero");
  const [soloAtrasados, setSoloAtrasados] = useState(false);
  const [soloBusqueda, setSoloBusqueda] = useState(false);

  const esAtrasada = (t) =>
    t.cantidad >= Number(minVeces) && t.veces != null && t.veces >= Number(umbral);

  const atrasados = useMemo(
    () =>
      stats
        .filter((t) => t.cantidad >= Number(minVeces) && t.veces != null && t.veces >= Number(umbral))
        .sort((a, b) => b.veces - a.veces || a.combinacion.localeCompare(b.combinacion)),
    [stats, minVeces, umbral]
  );

  const coincideBusqueda = (t) => filtro.numero(t.combinacion) || t.fechas.some(filtro.fecha);

  const filas = useMemo(() => {
    let copia = [...stats];
    if (soloAtrasados) {
      copia = copia.filter(
        (t) => t.cantidad >= Number(minVeces) && t.veces != null && t.veces >= Number(umbral)
      );
    }
    if (soloBusqueda && filtro.hayBusqueda) {
      copia = copia.filter(
        (t) => filtro.numero(t.combinacion) || t.fechas.some(filtro.fecha)
      );
    }
    const nulosAlFinal = (campo, desc) => (a, b) => {
      const x = a[campo], y = b[campo];
      if (x == null && y == null) return a.combinacion.localeCompare(b.combinacion);
      if (x == null) return 1;
      if (y == null) return -1;
      return (desc ? y - x : x - y) || a.combinacion.localeCompare(b.combinacion);
    };
    switch (orden) {
      case "cantidad": return copia.sort(nulosAlFinal("cantidad", true));
      case "veces": return copia.sort(nulosAlFinal("veces", true));
      case "sinCaer": return copia.sort(nulosAlFinal("diasSinCaer", true));
      case "atraso": return copia.sort(nulosAlFinal("atraso", true));
      case "cv": return copia.sort(nulosAlFinal("cv", false));
      default: return copia.sort((a, b) => a.combinacion.localeCompare(b.combinacion));
    }
  }, [stats, orden, soloAtrasados, soloBusqueda, minVeces, umbral, filtro]);

  const promedioGlobal = useMemo(() => {
    const con = stats.filter((t) => t.promedio != null);
    return con.length ? con.reduce((s, t) => s + t.promedio, 0) / con.length : null;
  }, [stats]);

  const encabezado = (
    <tr>
      <th>#</th>
      <th>Núm.</th>
      <th>Veces</th>
      <th>Prom. {unidad} entre caídas</th>
      <th>Mín</th>
      <th>Máx</th>
      <th title="Desviación / promedio. Cerca de 0 = muy regular; cerca de 1 = comportamiento aleatorio">
        Regularidad
      </th>
      <th>Última vez</th>
      <th>{unidad} sin caer</th>
      <th>Atraso ({unidad})</th>
      <th>× su promedio</th>
      <th title="De la más antigua a la más reciente. Entre paréntesis: intervalo desde la caída anterior">
        Fechas en que cayó (antigua → reciente)
      </th>
    </tr>
  );

  const coinciden = stats.filter(coincideBusqueda).length;

  return (
    <div>
      <h3>
        {titulo}
        {filtro.hayBusqueda && ` · ${coinciden} coinciden`}
      </h3>
      <p>
        {descripcion} Promedio general entre caídas: {entero(promedioGlobal)} {unidad}.
      </p>

      {atrasados.length > 0 && (
        <p className="perm-seleccion-copiar">
          <strong>Atrasados ({atrasados.length}):</strong> {atrasados.map((t) => t.combinacion).join(" ")}
        </p>
      )}

      <div className="perm-filtros">
        <label>
          Ordenar por:
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="numero">Número</option>
            <option value="cantidad">Veces que ha caído</option>
            <option value="sinCaer">{unidad} sin caer</option>
            <option value="atraso">cronologico ({unidad})</option>
            <option value="veces">× su promedio (más atrasado)</option>
            <option value="cv">Regularidad (más regular primero)</option>
          </select>
        </label>
        <label className="toggle-modo-busqueda">
          <input
            type="checkbox"
            checked={soloAtrasados}
            onChange={(e) => setSoloAtrasados(e.target.checked)}
          />
          Solo atrasados
        </label>
        {filtro.hayBusqueda && (
          <label className="toggle-modo-busqueda">
            <input
              type="checkbox"
              checked={soloBusqueda}
              onChange={(e) => setSoloBusqueda(e.target.checked)}
            />
            Solo los que coinciden con la búsqueda
          </label>
        )}
        <span>
          {filas.length} de {stats.length} terminaciones
        </span>
      </div>

      <div className="perm-scroll perm-scroll-cron">
        <table className="tabla-permutantes tabla-cron tabla-compacta">
          <thead>{encabezado}</thead>
          <tbody>
            {filas.map((t, i) => (
              <FilaIntervalo
                key={t.combinacion}
                t={t}
                indice={i}
                filtro={filtro}
                limiteFechas={limiteFechas}
                atrasada={esAtrasada(t)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================
// Meta · Valle · Manizales (columnas por lotería)
// =========================================================

const CAMPOS_ORDEN = [
  { v: "numero", t: "Número" },
  { v: "cantidad", t: "Veces que ha caído" },
  { v: "diasSinCaer", t: "Tiempo sin caer" },
  { v: "atraso", t: "Atraso" },
  { v: "veces", t: "× su promedio (más atrasado)" },
];
const ORDEN_DESC = new Set(["cantidad", "diasSinCaer", "atraso", "veces"]);

function TablaTres({ stats, filtro, minVeces, umbral, unidad }) {
  const [ordenLoteria, setOrdenLoteria] = useState("meta");
  const [ordenCampo, setOrdenCampo] = useState("numero");
  const [abierta, setAbierta] = useState(null);

  const filas = useMemo(() => {
    const base = Array.from({ length: 100 }, (_, i) => ({
      i,
      comb: String(i).padStart(2, "0"),
      por: Object.fromEntries(LOTERIAS.map((l) => [l.clave, stats[l.clave][i]])),
    }));
    if (ordenCampo === "numero") return base;
    const val = (f) => f.por[ordenLoteria][ordenCampo];
    return [...base].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return a.i - b.i;
      if (x == null) return 1;
      if (y == null) return -1;
      return (ORDEN_DESC.has(ordenCampo) ? y - x : x - y) || a.i - b.i;
    });
  }, [stats, ordenLoteria, ordenCampo]);

  const esAtrasada = (s) => s.cantidad >= Number(minVeces) && s.veces != null && s.veces >= Number(umbral);

  const resumenAtrasados = LOTERIAS.map((l) => ({
    ...l,
    lista: stats[l.clave]
      .filter(esAtrasada)
      .sort((a, b) => b.veces - a.veces || a.combinacion.localeCompare(b.combinacion)),
  }));

  return (
    <div>
      <h3>Meta · Valle · Manizales</h3>
      <p className="formulario-error">
        Ojo: el histórico de 20 años no guarda el nombre de la lotería, solo los resultados recientes
        (API y scraping). Por eso esta tabla está casi vacía; para el análisis completo usa las
        pestañas Tabla 1 y Tabla 2.
      </p>
      <p>
        Cuántas veces ha caído cada terminación en cada lotería, cada cuántos {unidad} cae en
        promedio y cuáles van atrasadas respecto a su propio promedio (celdas rojas). Haz clic en
        una fila para ver todas las fechas en que cayó en cada lotería.
      </p>

      <div className="resumen-atrasados">
        {resumenAtrasados.map((l) => (
          <div key={l.clave}>
            <strong>
              {l.nombre} atrasados ({l.lista.length}):
            </strong>{" "}
            <span className="perm-seleccion-copiar">
              {l.lista.length ? l.lista.map((t) => t.combinacion).join(" ") : "ninguno"}
            </span>
          </div>
        ))}
      </div>

      <div className="perm-filtros">
        <label>
          Ordenar por:
          <select value={ordenCampo} onChange={(e) => setOrdenCampo(e.target.value)}>
            {CAMPOS_ORDEN.map((c) => (
              <option key={c.v} value={c.v}>{c.t}</option>
            ))}
          </select>
        </label>
        <label>
          de la lotería:
          <select value={ordenLoteria} onChange={(e) => setOrdenLoteria(e.target.value)}>
            {LOTERIAS.map((l) => (
              <option key={l.clave} value={l.clave}>{l.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="perm-scroll perm-scroll-cron">
        <table className="tabla-permutantes tabla-cron tabla-compacta">
          <thead>
            <tr>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>Núm.</th>
              <th rowSpan={2}>Total</th>
              {LOTERIAS.map((l) => (
                <th key={l.clave} colSpan={6} className={`th-${l.clave}`}>
                  {l.nombre.toUpperCase()}
                </th>
              ))}
            </tr>
            <tr>
              {LOTERIAS.map((l) =>
                ["Veces", `Prom. ${unidad}`, "Última vez", `${unidad} sin caer`, "Atraso", "× prom."].map((h) => (
                  <th key={`${l.clave}-${h}`} className={`th-${l.clave}`}>{h}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, n) => {
              const total = LOTERIAS.reduce((s, l) => s + f.por[l.clave].cantidad, 0);
              const coincide =
                filtro.numero(f.comb) ||
                LOTERIAS.some((l) => f.por[l.clave].fechas.some(filtro.fecha));
              const expandida = abierta === f.comb;

              return (
                <Fragment key={f.comb}>
                  <tr
                    className={`fila-click ${coincide ? "fila-busqueda" : ""}`}
                    onClick={() => setAbierta(expandida ? null : f.comb)}
                  >
                    <td>{n + 1}</td>
                    <td className="perm-grupo-cron"><strong>{f.comb}</strong></td>
                    <td className="perm-cantidad">{total}</td>
                    {LOTERIAS.map((l) => {
                      const s = f.por[l.clave];
                      const atrasada = esAtrasada(s);
                      return [
                        <td key={`${l.clave}-c`} className="perm-cantidad">{s.cantidad}</td>,
                        <td key={`${l.clave}-p`}>{decimal(s.promedio)}</td>,
                        <td key={`${l.clave}-u`}>{s.ultimaFecha ? formatoFecha(s.ultimaFecha) : "Nunca"}</td>,
                        <td key={`${l.clave}-d`} className={atrasada ? "celda-atrasada" : ""}>{entero(s.diasSinCaer)}</td>,
                        <td key={`${l.clave}-a`} className={atrasada ? "celda-atrasada" : ""}>{decimal(s.atraso)}</td>,
                        <td key={`${l.clave}-v`} className={atrasada ? "celda-atrasada" : ""}>{veces(s.veces)}</td>,
                      ];
                    })}
                  </tr>
                  {expandida && (
                    <tr>
                      <td colSpan={3 + LOTERIAS.length * 6}>
                        <div className="detalle-fechas">
                          {LOTERIAS.map((l) => {
                            const s = f.por[l.clave];
                            return (
                              <div key={l.clave}>
                                <h5 className={`th-${l.clave}`}>
                                  {l.nombre} · {f.comb} · {s.cantidad} veces
                                </h5>
                                <ListaFechas
                                  fechas={s.fechas}
                                  gaps={s.gaps}
                                  conteo={s.conteo}
                                  fechaCoincide={filtro.fecha}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================
// Cada miércoles y los números que cayeron
// =========================================================

const ES_MIA = /meta|valle|manizales/i;

function PorMiercoles({ lista, filtro }) {
  const [limite, setLimite] = useState(30);

  const filtradas = useMemo(() => {
    if (!filtro.hayBusqueda) return lista;
    return lista.filter(
      (m) => filtro.fecha(m.fecha) || m.caidas.some((c) => filtro.numero(c.numero.slice(-2)))
    );
  }, [lista, filtro]);

  const visibles = filtro.hayBusqueda ? filtradas : filtradas.slice(0, limite);

  return (
    <div>
      <h3>
        Cada miércoles del histórico ({lista.length.toLocaleString()} miércoles)
        {filtro.hayBusqueda && ` · ${filtradas.length} coinciden`}
      </h3>
      <p>
        Todos los números (4 cifras) que cayeron en cada miércoles, de más reciente a más antiguo.
        En negrita las 2 últimas cifras; los chips azules son Meta, Valle y Manizales.
      </p>

      <div className="lista-miercoles">
        {visibles.map((m) => (
          <div key={m.fecha} className={`miercoles-card ${filtro.fecha(m.fecha) ? "fila-busqueda" : ""}`}>
            <div className="miercoles-fecha">{formatoFecha(m.fecha)}</div>
            <div className="miercoles-caidas">
              {m.caidas.map((c, i) => (
                <span
                  key={i}
                  className={`chip-caida ${ES_MIA.test(c.loteria || "") ? "chip-mia" : ""} ${
                    filtro.numero(c.numero.slice(-2)) ? "chip-coincide" : ""
                  }`}
                  title={c.loteria}
                >
                  <small>{c.loteria} </small>
                  {c.numero.slice(0, 2)}
                  <b>{c.numero.slice(2)}</b>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!filtro.hayBusqueda && limite < filtradas.length && (
        <button type="button" className="perm-limpiar" onClick={() => setLimite((l) => l + 50)}>
          Ver 50 más
        </button>
      )}
    </div>
  );
}

// =========================================================
// Pantalla principal
// =========================================================

export default function PantallaMiercolesAnalisis({ busqueda, busquedaFecha, modoBusqueda = "cualquiera" }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState(false);

  const [seccion, setSeccion] = useState("historico");
  const [minVeces, setMinVeces] = useState(3);
  const [umbral, setUmbral] = useState(1.5);
  const [divisorTres, setDivisorTres] = useState(7); // 7 = miércoles, 1 = días

  const cargar = async () => {
    setActualizando(true);
    try {
      setDatos(await obtenerAnalisisMiercoles2());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setActualizando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtro = useMemo(() => {
    const terminos = terminosBusqueda(busqueda);
    const terminosFecha = terminosBusqueda(busquedaFecha);
    const ultimas = modoBusqueda === "ultimas2";

    return {
      hayBusqueda: terminos.length > 0 || terminosFecha.length > 0,
      // comb = terminación de 2 cifras; el término puede tener 1 a 4 cifras
      numero: (comb) =>
        terminos.length > 0 &&
        terminos.some((x) =>
          x.length >= comb.length
            ? ultimas ? x.endsWith(comb) : x.includes(comb)
            : ultimas ? comb.endsWith(x) : comb.includes(x)
        ),
      fecha: (iso) => terminosFecha.length > 0 && !!iso && terminosFecha.some((t) => formatoFecha(iso).includes(t)),
    };
  }, [busqueda, busquedaFecha, modoBusqueda]);

  const statsTres = useMemo(() => {
    if (!datos) return null;
    return Object.fromEntries(
      LOTERIAS.map((l) => [l.clave, calcularStats2(datos[l.clave], { divisor: divisorTres })])
    );
  }, [datos, divisorTres]);

  const statsTodas = useMemo(() => (datos ? calcularStats2(datos.todas) : null), [datos]);
  const statsMiercoles = useMemo(() => (datos ? calcularStats2(datos.miercoles, { divisor: 7 }) : null), [datos]);

  const unidadTres = divisorTres === 7 ? "miércoles" : "días";

  return (
    <div className="permutantes analisis-mie">
      <h3>Análisis de miércoles · terminaciones de 2 cifras</h3>

      <div className="perm-filtros">
        <div className="pestanas">
          {[
            ["miercoles", "Miércoles 2 cifras"],
            ["historico", "Todo el histórico 2 cifras"],
            // ["porfecha", "Cada miércoles"],
            // ["tres", "Por lotería (solo datos recientes)"],
          ].map(([v, t]) => (
            <button key={v} className={seccion === v ? "activa" : ""} onClick={() => setSeccion(v)}>
              {t}
            </button>
          ))}
        </div>

        <label>
          Mínimo de veces caído:
          <input type="number" min="2" inputMode="numeric" value={minVeces} onChange={(e) => setMinVeces(e.target.value)} />
        </label>
        <label>
          Atrasado si lleva sin caer (× su promedio):
          <input type="number" min="0" step="0.1" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
        </label>
        {seccion === "tres" && (
          <label>
            Medir en:
            <select value={divisorTres} onChange={(e) => setDivisorTres(Number(e.target.value))}>
              <option value={7}>Miércoles (sorteos)</option>
              <option value={1}>Días</option>
            </select>
          </label>
        )}
        <button type="button" className="perm-limpiar" onClick={cargar} disabled={actualizando}>
          {actualizando ? "⏳ Actualizando..." : "🔄 Actualizar resultados"}
        </button>
      </div>

      {error && <p className="formulario-error">{error}</p>}
      {!datos && !error && <p className="cargando">Cargando análisis...</p>}

      {datos && seccion === "tres" && (
        <TablaTres stats={statsTres} filtro={filtro} minVeces={minVeces} umbral={umbral} unidad={unidadTres} />
      )}

      {datos && seccion === "historico" && (
        <TablaIntervalos
          titulo="Tabla 2 · Todo el histórico 2 cifras(todas las loterías, todos los días)"
          descripcion={`Basado en ${datos.total.toLocaleString()} números del histórico; se cuentan todas las veces que cayó cada terminación y los intervalos se miden entre fechas distintas.`}
          stats={statsTodas}
          filtro={filtro}
          minVeces={minVeces}
          umbral={umbral}
          unidad="días"
        />
      )}

      {datos && seccion === "miercoles" && (
        <TablaIntervalos
          titulo="Tabla 1 · Miércoles (solo los sorteos que cayeron en miércoles)"
          descripcion={`Basado en ${datos.total_miercoles.toLocaleString()} números del histórico que cayeron en miércoles (se detectan por la fecha); los intervalos se miden en miércoles.`}
          stats={statsMiercoles}
          filtro={filtro}
          minVeces={minVeces}
          umbral={umbral}
          unidad="miércoles"
        />
      )}

      {datos && seccion === "porfecha" && <PorMiercoles lista={datos.por_miercoles} filtro={filtro} />}
    </div>
  );
}